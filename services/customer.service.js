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
