import prisma from "../utils/primsa.connection.js";

export const autoClosePastSchedules = async () => {
  const now = new Date();

  const result = await prisma.showSchedule.updateMany({
    where: {
      isOpen: true,
      datetime: {
        lt: now,
      },
    },
    data: {
      isOpen: false,
    },
  });

  console.log(`Closed ${result.count} past schedules.`);
};
