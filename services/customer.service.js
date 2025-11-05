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
          showId: true,
        },
      });

      return {
        showId: show.showId,
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

export const getDepartmentShows = async ({ departmentId = null }) => {
  const now = new Date();

  const shows = await prisma.show.findMany({
    where: {
      ...(departmentId && { departmentId }),
    },
    include: {
      schedules: {
        orderBy: { datetime: "asc" },
        include: {
          ticketPricing: true,
        },
      },
      genres: {
        include: {
          genreFk: { select: { name: true } },
        },
      },
    },
  });

  const transformedShows = shows.map(({ schedules, genres, ...rest }) => {
    const upcomingSchedules = schedules.filter((s) => s.datetime >= now && s.isOpen == true);
    const pastSchedules = schedules.filter((s) => s.datetime < now);

    const nextSchedule = upcomingSchedules.length > 0 ? upcomingSchedules[0] : null;

    const remainingUpcomingSchedules = nextSchedule && upcomingSchedules.length > 1 ? upcomingSchedules.slice(1) : [];

    return {
      ...rest,
      genreNames: genres.map((g) => g.genreFk.name),
      nextSchedule,
      remainingUpcomingSchedules,
      pastSchedules,
    };
  });

  const showsWithUpcoming = transformedShows.filter((s) => s.nextSchedule);
  const featuredShow =
    showsWithUpcoming.length > 0
      ? showsWithUpcoming.reduce((earliest, current) => (current.nextSchedule.datetime < earliest.nextSchedule.datetime ? current : earliest))
      : null;

  const otherShows = transformedShows
    .filter((s) => !featuredShow || s.showId !== featuredShow.showId)
    .sort((a, b) => {
      if (!a.nextSchedule && !b.nextSchedule) return 0;
      if (!a.nextSchedule) return 1;
      if (!b.nextSchedule) return -1;
      return a.nextSchedule.datetime - b.nextSchedule.datetime;
    });

  return {
    featuredShow,
    otherShows,
  };
};

export const getShowWithSchedule = async (showId) => {
  const now = new Date();

  const show = await prisma.show.findUnique({
    where: { showId },
    include: {
      schedules: {
        orderBy: { datetime: "asc" },
        include: {
          ticketPricing: true,
        },
      },
      genres: {
        include: {
          genreFk: { select: { name: true } },
        },
      },
    },
  });

  if (!show) return null;

  const { schedules, genres, ...rest } = show;

  const upcomingSchedules = schedules.filter((s) => s.datetime >= now && s.isOpen === true);
  const pastSchedules = schedules.filter((s) => s.datetime < now);

  const nextSchedule = upcomingSchedules.length > 0 ? upcomingSchedules[0] : null;

  const remainingUpcomingSchedules = upcomingSchedules.length > 1 ? upcomingSchedules.slice(1) : [];

  return {
    ...rest,
    genreNames: genres.map((g) => g.genreFk.name),
    nextSchedule,
    remainingUpcomingSchedules,
    pastSchedules,
  };
};

export const getAvailableTickets = async (scheduleId) => {
  return await prisma.ticket.count({
    where: {
      scheduleId,
      status: { in: ["allocated", "not_allocated"] },
      isComplimentary: false,
    },
  });
};
