import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import prisma from "../utils/primsa.connection.js";

dayjs.extend(utc);
dayjs.extend(timezone);

dayjs.tz.setDefault("Asia/Manila");

export const getUpcomingShows = async () => {
  const now = dayjs().tz("Asia/Manila");

  const schedules = await prisma.showSchedule.groupBy({
    by: ["showId"],
    where: {
      isOpen: true,
      show: {
        isArchived: false,
      },
      datetime: {
        gt: now.toDate(),
      },
    },
    _min: {
      datetime: true,
    },
  });

  const upcomingShows = await Promise.all(
    schedules.map(async (schedule) => {
      const show = await prisma.show.findUnique({
        where: { showId: schedule.showId },
        select: {
          title: true,
          description: true,
          showCover: true,
        },
      });

      return {
        date: schedule._min.datetime,
        title: show?.title,
        description: show?.description,
        showCover: show?.showCover,
      };
    })
  );

  return upcomingShows
    .filter((s) => s.date)
    .sort((a, b) => a.date - b.date)
    .slice(0, 3);
};

export const getDepartmentShows = async ({ departmentId = null, isArchived = false }) => {
  const now = new Date();

  const baseWhere = {
    isArchived,
    ...(departmentId && {
      OR: [{ departmentId }, { departmentId: null }],
    }),
  };

  const shows = await prisma.show.findMany({
    where: baseWhere,
    include: {
      schedules: {
        where: { isOpen: true },
        orderBy: { datetime: "asc" },
      },
      genres: {
        include: {
          genreFk: {
            select: { name: true },
          },
        },
      },
    },
  });

  const transformedShows = shows.map(({ schedules, genres, ...rest }) => {
    const upcomingSchedules = schedules.filter((s) => s.datetime >= now);
    const pastSchedules = schedules.filter((s) => s.datetime < now);

    // Find the next upcoming schedule (soonest)
    const nextSchedule =
      upcomingSchedules.length > 0
        ? upcomingSchedules.reduce((earliest, current) => (current.datetime < earliest.datetime ? current : earliest))
        : null;

    return {
      ...rest,
      genreNames: genres.map((g) => g.genreFk.name),
      upcomingSchedules,
      pastSchedules,
      nextSchedule,
    };
  });

  // Sort upcoming shows by soonest next schedule
  const upcomingShows = transformedShows
    .filter((s) => s.upcomingSchedules.length > 0)
    .sort((a, b) => a.nextSchedule.datetime.getTime() - b.nextSchedule.datetime.getTime());

  // Sort past shows by most recently finished schedule
  const pastShows = transformedShows
    .filter((s) => s.upcomingSchedules.length === 0 && s.pastSchedules.length > 0)
    .sort((a, b) => b.pastSchedules[b.pastSchedules.length - 1].datetime.getTime() - a.pastSchedules[a.pastSchedules.length - 1].datetime.getTime());

  return {
    upcomingShows,
    pastShows,
  };
};
