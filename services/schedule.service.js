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

export const getSchedule = async (scheduleId) => {
  return await prisma.showschedules.findUnique({ where: { scheduleId } });
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

  return tickets;
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
  return await prisma.showschedules.findMany({
    where: { showId },
    orderBy: { datetime: "asc" },
  });
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
      logtickets: {
        none: {
          ticketactionlog: {
            actionType: "remit",
          },
        },
      },
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
  const distributors = await prisma.users.findMany({
    where: {
      distributor: {
        isNot: null,
      },
      ticketactionlog_ticketactionlog_distributorIdTousers: {
        some: {
          scheduleId,
        },
      },
    },
    select: {
      userId: true,
      firstName: true,
      lastName: true,
      email: true,
      distributor: {
        select: {
          department: { select: { name: true } },
          distributortypes: { select: { name: true } },
        },
      },
      ticketactionlog_ticketactionlog_distributorIdTousers: {
        where: { scheduleId },
        select: {
          actionType: true,
          logtickets: {
            select: {
              ticket: {
                select: { status: true },
              },
            },
          },
        },
      },
    },
  });

  return distributors.map((dist) => {
    const logs = dist.ticketactionlog_ticketactionlog_distributorIdTousers;

    const allocationCount = new Set(
      logs.filter((log) => log.actionType === "allocate").map((log) => log) // one per allocation action
    ).size;

    const totalAllocated = logs.filter((log) => log.actionType === "allocate").reduce((count, log) => count + log.logtickets.length, 0);

    const totalSold = logs.reduce((count, log) => count + log.logtickets.filter((lt) => ["sold", "remitted"].includes(lt.ticket.status)).length, 0);

    return {
      userId: dist.userId,
      name: `${dist.firstName} ${dist.lastName}`,
      allocationCount,
      totalAllocated,
      totalSold,
      email: dist.email,
      department: dist.distributor?.department?.name ?? null,
      distributorType: dist.distributor?.distributortypes?.name ?? null,
    };
  });
};

export const getScheduleSeatMap = async (scheduleId) => {
  const schedules = await prisma.showschedules.findMany({
    where: {
      scheduleId,
    },
    select: {
      showseats: {
        select: {
          seatNumber: true,
          x: true,
          y: true,
          seatSection: true,
          status: true,
        },
      },
      ticket: {
        select: {
          controlNumber: true,
          ticketPrice: true,
          isComplimentary: true,
          seatNumber: true,
        },
      },
    },
  });

  const formattedSeats = schedules
    .map((schedule) => {
      return schedule.showseats.map((seat) => ({
        seatNumber: seat.seatNumber,
        x: seat.x,
        y: seat.y,
        row: seat.seatNumber.replace(/[0-9]/g, ""),
        section: seat.seatSection,
        status: seat.status,
        ticketControlNumber: schedule.ticket.find((ticket) => ticket.seatNumber === seat.seatNumber)?.controlNumber ?? 0,
        ticketPrice: schedule.ticket.find((ticket) => ticket.seatNumber === seat.seatNumber)?.ticketPrice ?? null,
        isComplimentary: schedule.ticket.find((ticket) => ticket.seatNumber === seat.seatNumber)?.isComplimentary,
      }));
    })
    .flat();

  return formattedSeats;
};

export const allocateTicketByControlNumber = async ({ scheduleId, distributorId, allocatedBy, controlNumbers }) => {
  return await prisma.$transaction(async (prisma) => {
    // Validate distributor exists and is active
    const distributor = await prisma.users.findFirst({
      where: {
        userId: distributorId,
        role: "distributor",
        isArchived: false,
        isLocked: false,
      },
      include: {
        distributor: true,
      },
    });

    if (!distributor) {
      throw new AppError("Distributor not found or not active", HttpStatusCodes.NotFound);
    }

    // Validate schedule exists and is open
    const schedule = await prisma.showschedules.findFirst({
      where: {
        scheduleId,
        isOpen: true,
        isArchived: false,
      },
    });

    if (!schedule) {
      throw new AppError("Schedule not found or not available for allocation", HttpStatusCodes.NotFound);
    }

    // Find and validate tickets
    const tickets = await prisma.ticket.findMany({
      where: {
        scheduleId,
        controlNumber: {
          in: controlNumbers,
        },
      },
      include: {
        showschedules: true,
      },
    });

    if (tickets.length === 0) {
      throw new AppError("No tickets found with the given control numbers", HttpStatusCodes.NotFound);
    }

    // Check for invalid tickets
    const invalidTickets = [];
    const validTickets = [];

    for (const ticket of tickets) {
      if (ticket.status !== "not_allocated") {
        invalidTickets.push({
          controlNumber: ticket.controlNumber,
          reason: `Already ${ticket.status}`,
        });
        continue;
      }

      if (ticket.isComplimentary) {
        invalidTickets.push({
          controlNumber: ticket.controlNumber,
          reason: "Complimentary tickets cannot be allocated",
        });
        continue;
      }

      validTickets.push(ticket);
    }

    // Check for duplicate control numbers in request vs found tickets
    const foundControlNumbers = tickets.map((t) => t.controlNumber);
    const missingControlNumbers = controlNumbers.filter((cn) => !foundControlNumbers.includes(cn));

    // If there are invalid tickets or missing control numbers, throw error with data
    if (invalidTickets.length > 0 || missingControlNumbers.length > 0) {
      const ticketsByReason = invalidTickets.reduce((acc, ticket) => {
        if (!acc[ticket.reason]) {
          acc[ticket.reason] = [];
        }
        acc[ticket.reason].push(ticket.controlNumber);
        return acc;
      }, {});

      const messages = [];

      if (missingControlNumbers.length > 0) {
        messages.push(`${missingControlNumbers.length} control numbers not found`);
      }

      Object.entries(ticketsByReason).forEach(([reason, tickets]) => {
        const count = tickets.length;
        const exampleNumbers = tickets.slice(0, 3).join(", ");
        const moreText = count > 3 ? ` and ${count - 3} more` : "";
        messages.push(`${count} tickets ${reason.toLowerCase()} (e.g., ${exampleNumbers}${moreText})`);
      });

      const errorMessage = `Allocation failed: ${messages.join("; ")}.`;

      throw new AppError(errorMessage, HttpStatusCodes.Conflict);
    }

    if (validTickets.length === 0) {
      throw new AppError("No valid tickets available for allocation", HttpStatusCodes.Conflict);
    }

    // Create allocation log with allocated tickets
    await prisma.ticketactionlog.create({
      data: {
        actionLogId: crypto.randomUUID(),
        scheduleId,
        distributorId,
        actionBy: allocatedBy,
        actionDate: new Date(),
        actionType: "allocate",
        logtickets: {
          create: validTickets.map((ticket) => ({
            ticketId: ticket.ticketId,
          })),
        },
      },
    });

    // Update the tickets status
    await prisma.ticket.updateMany({
      where: {
        ticketId: {
          in: validTickets.map((ticket) => ticket.ticketId),
        },
      },
      data: {
        status: "allocated",
        distributorId: distributorId,
      },
    });

    if (schedule.seatingType === "controlledSeating") {
      const ticketsWithSeats = validTickets.filter((ticket) => ticket.seatNumber);
      if (ticketsWithSeats.length > 0) {
        await prisma.showseats.updateMany({
          where: {
            scheduleId,
            seatNumber: {
              in: ticketsWithSeats.map((ticket) => ticket.seatNumber),
            },
          },
          data: {
            status: "reserved",
          },
        });
      }
    }

    return {
      success: true,
      message: `Successfully allocated ${validTickets.length} tickets`,
    };
  });
};
