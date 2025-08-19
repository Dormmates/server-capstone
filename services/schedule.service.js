import { AppError, HttpStatusCodes } from "../middleware/errorHandler.middleware.js";
import prisma from "../utils/primsa.connection.js";

export const addShowSchedule = async ({
  dates = [],
  showId,
  seatingType,
  ticketType,
  contactNumber = null,
  facebookLink = null,
  commissionFee = 0,
  tx = prisma,
}) => {
  const schedules = dates.map(({ datetime }) => ({
    scheduleId: crypto.randomUUID(),
    showId,
    datetime,
    commissionFee,
    seatingType,
    ticketType,
    contactNumber,
    facebookLink,
  }));

  const conflicts = await tx.showschedules.findMany({
    where: {
      showId,
      datetime: {
        in: schedules.map((s) => s.datetime),
      },
    },
  });

  if (conflicts.length > 0) {
    const conflictDetails = conflicts.map((s) => s.datetime.toISOString().replace("T", " ").slice(0, 16));
    throw new AppError(`Conflicting schedules already exist for: ${conflictDetails.join(", ")}`, HttpStatusCodes.Conflict);
  }

  await tx.showschedules.createMany({
    data: schedules,
  });

  return schedules.map(({ scheduleId, datetime }) => ({
    scheduleId,
    datetime,
  }));
};

export const generateScheduleTickets = async ({ tx, scheduleId, seatPricing, seats, ticketPrice, controlNumbers, seatingConfiguration }) => {
  const tickets = [];

  const orchestra = controlNumbers?.orchestra || [];
  const balcony = controlNumbers?.balcony || [];
  const complimentary = controlNumbers?.complimentary || [];

  const isControlled = seatingConfiguration === "controlledSeating";
  const isFixedPrice = seatPricing === "fixed";

  // Orchestra tickets
  for (const num of orchestra) {
    let seatNumber;
    let price = ticketPrice;

    if (isControlled) {
      const seat = seats.find((s) => s.ticketControlNumber === num);
      seatNumber = seat?.seatNumber;
      if (!isFixedPrice) price = seat?.ticketPrice;
    }

    tickets.push({
      ticketId: crypto.randomUUID(),
      scheduleId,
      controlNumber: num,
      seatNumber: isControlled ? seatNumber : undefined,
      ticketPrice: isFixedPrice ? ticketPrice : price,
      isComplimentary: false,
      ticketSection: "orchestra",
    });
  }

  // Balcony tickets
  for (const num of balcony) {
    let seatNumber;
    let price = ticketPrice;

    if (isControlled) {
      const seat = seats.find((s) => s.ticketControlNumber === num);
      seatNumber = seat?.seatNumber;
      if (!isFixedPrice) price = seat?.ticketPrice;
    }

    tickets.push({
      ticketId: crypto.randomUUID(),
      scheduleId,
      controlNumber: num,
      seatNumber: isControlled ? seatNumber : undefined,
      ticketPrice: isFixedPrice ? ticketPrice : price,
      isComplimentary: false,
      ticketSection: "balcony",
    });
  }

  // Complimentary tickets (no ticketSection)
  for (const num of complimentary) {
    let seatNumber;

    if (isControlled) {
      const seat = seats.find((s) => s.ticketControlNumber === num);
      seatNumber = seat?.seatNumber;
    }

    tickets.push({
      ticketId: crypto.randomUUID(),
      scheduleId,
      controlNumber: num,
      seatNumber: isControlled ? seatNumber : undefined,
      ticketPrice: 0,
      isComplimentary: true,
      ticketSection: null,
    });
  }

  await tx.ticket.createMany({ data: tickets });
};

export const generateSeats = async ({ tx, seats, schedId }) => {
  await tx.showseats.createMany({
    data: seats.map((s) => ({
      scheduleId: schedId,
      seatNumber: s.seatNumber,
      seatSection: s.section,
      x: s.x,
      y: s.y,
    })),
  });
};

export const getShowSchedules = async (showId) => {
  return await prisma.showschedules.findMany({ where: { showId } });
};

export const getScheduleDetails = async (scheduleId) => {
  return await prisma.showschedules.findUnique({ where: { scheduleId } });
};

export const getScheduleSummary = async (scheduleId) => {
  const expected = await prisma.ticket.aggregate({
    where: { scheduleId, isComplimentary: false },
    _sum: { ticketPrice: true },
  });

  const current = await prisma.ticket.aggregate({
    where: { scheduleId, status: "sold", isComplimentary: false },
    _sum: { ticketPrice: true },
  });

  const totalTicket = await prisma.ticket.count({
    where: { scheduleId },
  });

  const totalOrchestra = await prisma.ticket.count({
    where: { scheduleId, ticketSection: "orchestra" },
  });

  const totalBalcony = await prisma.ticket.count({
    where: { scheduleId, ticketSection: "balcony" },
  });

  const totalComplimentary = await prisma.ticket.count({
    where: { scheduleId, isComplimentary: true },
  });

  const sold = await prisma.ticket.count({
    where: { scheduleId, status: "sold", isComplimentary: false },
  });

  const notAllocated = await prisma.ticket.count({
    where: { scheduleId, status: "not_allocated" },
  });

  const unsold = await prisma.ticket.count({
    where: { scheduleId, status: "allocated" },
  });

  const pendingRemittance = await prisma.ticket.count({
    where: {
      scheduleId,
      status: "sold",
      remittedtickets: { none: {} },
    },
  });

  return {
    expectedSales: expected._sum.ticketPrice || 0,
    currentSales: current._sum.ticketPrice || 0,
    remainingSales: (expected._sum.ticketPrice || 0) - (current._sum.ticketPrice || 0),

    totalTicket,
    totalOrchestra,
    totalBalcony,
    totalComplimentary,

    sold,
    notAllocated,
    unsold,
    pendingRemittance,
  };
};

export const getScheduleTickets = async (scheduleId) => {
  const tickets = await prisma.ticket.findMany({
    where: { scheduleId },
    orderBy: {
      controlNumber: "asc",
    },
  });
  return tickets;
};

export const getScheduleDistributors = async (scheduleId) => {
  const distributors = await prisma.allocationlog.findMany({
    where: { scheduleId },
    select: {
      users_allocationlog_distributorIdTousers: {
        select: {
          distributor: {
            select: {
              users: {
                select: {
                  userId: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      },

      allocatedtickets: {
        select: {
          ticket: {
            select: {
              status: true,
            },
          },
        },
      },
    },
  });

  return distributors.map((dist) => {
    const user = dist.users_allocationlog_distributorIdTousers?.distributor?.users;

    const totalAllocated = dist.allocatedtickets.length;
    const totalSold = dist.allocatedtickets.filter((t) => t.status === "sold" || t.status === "remitted").length;

    return {
      userId: user?.userId,
      name: `${user?.firstName} ${user?.lastName}`,
      totalAllocated,
      totalSold,
    };
  });
};
