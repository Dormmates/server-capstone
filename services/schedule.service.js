import { AppError, HttpStatusCodes } from "../middleware/errorHandler.middleware.js";
import prisma from "../utils/primsa.connection.js";
import { getDistributorAllocatedTickets } from "./distributorTickets.service.js";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import { DistributorTicketNotification, sendTicketNotificationsToDistributor } from "../utils/sendNotification.js";

dayjs.extend(utc);
dayjs.extend(timezone);

export const addShowSchedule = async ({
  dates = [],
  showId,
  seatingType,
  ticketType,
  contactNumber = null,
  facebookLink = null,
  ticketPricing = null,
  tx = prisma,
}) => {
  const nowPH = dayjs().tz("Asia/Manila");

  const invalidDates = dates
    .filter(({ datetime }) => dayjs(datetime).tz("Asia/Manila").isBefore(nowPH))
    .map(({ datetime }) => dayjs(datetime).tz("Asia/Manila").format("YYYY-MM-DD HH:mm A"));

  if (invalidDates.length > 0) {
    throw new AppError(`Cannot add schedules in the past (PH time): ${invalidDates.join(", ")}`, HttpStatusCodes.BadRequest);
  }

  const schedules = dates.map(({ datetime }) => ({
    scheduleId: crypto.randomUUID(),
    showId,
    datetime,
    ticketPricingId: ticketPricing ? ticketPricing.id : null,
    seatingType,
    ticketType,
    contactNumber,
    facebookLink,
  }));

  const conflicts = await tx.showSchedule.findMany({
    where: {
      datetime: {
        in: schedules.map((s) => s.datetime),
      },
    },
  });

  if (conflicts.length > 0) {
    const conflictDetails = conflicts.map((s) => dayjs(s.datetime).tz("Asia/Manila").format("YYYY-MM-DD HH:mm A"));
    throw new AppError(`Conflicting schedules already exist for: ${conflictDetails.join(", ")}`, HttpStatusCodes.Conflict);
  }

  await tx.showSchedule.createMany({
    data: schedules,
  });

  return schedules.map(({ scheduleId, datetime }) => ({
    scheduleId,
    datetime,
  }));
};

export const getSchedule = async (scheduleId) => {
  return await prisma.showSchedule.findUnique({ where: { scheduleId } });
};

export const closeSchedule = async (scheduleId) => {
  const schedule = await prisma.showSchedule.findUnique({
    where: { scheduleId },
    select: { isOpen: true },
  });

  if (!schedule) {
    throw new AppError("Schedule not found", HttpStatusCodes.NotFound);
  }
  return await prisma.showSchedule.update({ where: { scheduleId }, data: { isOpen: false } });
};

export const openSchedule = async (scheduleId) => {
  const schedule = await prisma.showSchedule.findUnique({
    where: { scheduleId },
    select: { isOpen: true, datetime: true },
  });

  if (!schedule) {
    throw new AppError("Schedule not found", HttpStatusCodes.NotFound);
  }

  const nowPH = dayjs().tz("Asia/Manila");

  if (dayjs(schedule.datetime).tz("Asia/Manila").isBefore(nowPH)) {
    throw new AppError("Cannot open a schedule that is already in the past", HttpStatusCodes.BadRequest);
  }

  return await prisma.showSchedule.update({
    where: { scheduleId },
    data: { isOpen: true },
  });
};

export const deleteSchedule = async (scheduleId) => {
  const schedule = await prisma.showSchedule.findUnique({
    where: { scheduleId },
    select: { isOpen: true },
  });

  if (!schedule) {
    throw new AppError("Schedule not found", HttpStatusCodes.NotFound);
  }

  // if (schedule.isOpen) {
  //   throw new AppError("Cannot delete an open schedule", HttpStatusCodes.BadRequest);
  // }

  return await prisma.showSchedule.delete({ where: { scheduleId } });
};

export const reschedule = async ({ scheduleId, newDateTime }) => {
  const schedule = await prisma.showSchedule.findUnique({
    where: { scheduleId },
    select: { isOpen: true, showId: true },
  });

  if (!schedule) {
    throw new AppError("Schedule not found", HttpStatusCodes.NotFound);
  }

  // if (!schedule.isOpen) {
  //   throw new AppError("Cannot reschedule a closed schedule", HttpStatusCodes.BadRequest);
  // }

  const nowPH = dayjs().tz("Asia/Manila");
  const newDatePH = dayjs(newDateTime).tz("Asia/Manila");

  if (newDatePH.isBefore(nowPH)) {
    throw new AppError(`Cannot reschedule to a past date/time (PH time): ${newDatePH.format("YYYY-MM-DD HH:mm A")}`, HttpStatusCodes.BadRequest);
  }

  const conflicts = await prisma.showSchedule.findMany({
    where: {
      datetime: newDateTime,
      NOT: { scheduleId },
    },
  });

  if (conflicts.length > 0) {
    const conflictDetails = conflicts.map((s) => dayjs(s.datetime).tz("Asia/Manila").format("YYYY-MM-DD HH:mm A"));
    throw new AppError(`Conflicting schedules already exist for: ${conflictDetails.join(", ")}`, HttpStatusCodes.Conflict);
  }

  return await prisma.showSchedule.update({
    where: { scheduleId },
    data: { datetime: newDateTime },
  });
};

export const copySchedule = async ({ scheduleId, newDateTime }) => {
  const nowPH = dayjs().tz("Asia/Manila");
  const newDatePH = dayjs(newDateTime).tz("Asia/Manila");

  if (newDatePH.isBefore(nowPH)) {
    throw new AppError(`Cannot copy schedule to a past date/time (PH time): ${newDatePH.format("YYYY-MM-DD hh:mm A")}`, HttpStatusCodes.BadRequest);
  }

  const existingSchedule = await prisma.showSchedule.findUnique({
    where: { scheduleId },
    include: {
      tickets: true,
      seats: {
        include: {
          ticket: {
            select: {
              controlNumber: true,
            },
          },
        },
      },
      ticketPricing: true,
    },
  });

  if (!existingSchedule) {
    throw new AppError("Schedule not found", HttpStatusCodes.NotFound);
  }

  const conflicts = await prisma.showSchedule.findMany({
    where: {
      datetime: newDateTime,
      NOT: { scheduleId },
    },
  });

  if (conflicts.length > 0) {
    const conflictDetails = conflicts.map((s) => dayjs(s.datetime).tz("Asia/Manila").format("YYYY-MM-DD HH:mm A"));
    throw new AppError(`Conflicting schedules already exist for: ${conflictDetails.join(", ")}`, HttpStatusCodes.Conflict);
  }

  return await prisma.$transaction(async (tx) => {
    // Create new schedule
    const newSchedule = await tx.showSchedule.create({
      data: {
        datetime: newDatePH,
        showId: existingSchedule.showId,
        seatingType: existingSchedule.seatingType,
        scheduleId: crypto.randomUUID(),
        ticketType: existingSchedule.ticketType,
        ticketPricingId: existingSchedule.ticketPricingId,
      },
    });

    if (existingSchedule.ticketType === "ticketed") {
      const orchestraControlNumbers = existingSchedule.tickets.filter((t) => t.ticketSection === "orchestra").map((t) => t.controlNumber);
      const balconyControlNumbers = existingSchedule.tickets.filter((t) => t.ticketSection === "balcony").map((t) => t.controlNumber);
      const complimentaryControlNumbers = existingSchedule.tickets.filter((t) => t.isComplimentary).map((t) => t.controlNumber);

      await generateScheduleTicketsAndSeats({
        tx,
        scheduleId: newSchedule.scheduleId,
        ticketPricing: existingSchedule.ticketPricing,
        seatPricing: existingSchedule.ticketPricing.type || "fixed",
        controlNumbers: {
          orchestra: orchestraControlNumbers,
          balcony: balconyControlNumbers,
          complimentary: complimentaryControlNumbers,
        },
        seatingConfiguration: existingSchedule.seatingType,
        seats: existingSchedule.seats
          ? existingSchedule.seats.map((seat) => ({
              ...seat,
              section: seat.seatSection,
              ticketControlNumber: seat.ticket ? seat.ticket.controlNumber : 0,
            }))
          : [],
      });
    }

    return { ...newSchedule, ticketPricing: existingSchedule.ticketPricing };
  });
};

export const generateScheduleTicketsAndSeats = async ({
  tx = prisma,
  scheduleId,
  seatPricing,
  seats,
  ticketPricing,
  controlNumbers,
  seatingConfiguration,
}) => {
  const tickets = [];
  const seatsData = [];

  const orchestra = controlNumbers?.orchestra || [];
  const balcony = controlNumbers?.balcony || [];
  const complimentary = controlNumbers?.complimentary || [];

  const isControlled = seatingConfiguration === "controlledSeating";
  const isFixedPrice = seatPricing === "fixed";

  const createTicketAndLinkSeat = (num, ticketSection, complimentaryTicket = false) => {
    let price = ticketPricing.fixedPrice;
    let seat = null;

    if (isControlled) {
      seat = seats.find((s) => s.ticketControlNumber === num);
      if (!seat) throw new AppError(`No matching seat for control number ${num}`);
      if (!isFixedPrice && !complimentaryTicket) price = seat.ticketPrice;
    }

    const ticketId = crypto.randomUUID();

    tickets.push({
      ticketId,
      scheduleId,
      controlNumber: num,
      ticketPrice: complimentaryTicket ? 0 : price,
      isComplimentary: complimentaryTicket,
      ticketSection,
    });

    if (seat) {
      const seatIndex = seatsData.findIndex((s) => s.seatNumber === seat.seatNumber);
      if (seatIndex !== -1) {
        seatsData[seatIndex].ticketId = ticketId;
      }
    }
  };

  if (isControlled) {
    seats.forEach((s) => {
      seatsData.push({
        scheduleId,
        seatNumber: s.seatNumber,
        seatSection: s.section,
        rotation: s.rotation,
        x: s.x,
        y: s.y,
        ticketId: null,
      });
    });
  }

  orchestra.forEach((num) => createTicketAndLinkSeat(num, "orchestra"));
  balcony.forEach((num) => createTicketAndLinkSeat(num, "balcony"));
  complimentary.forEach((num) => createTicketAndLinkSeat(num, null, true));

  await tx.ticket.createMany({ data: tickets });
  await tx.showSeat.createMany({ data: seatsData });

  return tickets;
};

export const getShowSchedules = async ({ showId, excludeClosed = false, excludeReservationOff = false }) => {
  const schedules = await prisma.showSchedule.findMany({
    where: {
      showId,
      ...(excludeClosed && { isOpen: true }),
    },
    include: {
      ticketPricing: true,
    },
    orderBy: { datetime: "asc" },
  });

  return schedules;
};

export const getScheduleDetails = async (scheduleId) => {
  const schedule = await prisma.showSchedule.findUnique({
    where: { scheduleId },
    include: {
      ticketPricing: true,
    },
  });

  return schedule;
};

export const getScheduleSummary = async (scheduleId) => {
  const schedule = await prisma.showSchedule.findUnique({ where: { scheduleId }, include: { ticketPricing: true } });

  if (!schedule) {
    throw new AppError("Schedule Not Found");
  }

  // Tickets Summary
  const scheduleTickets = await prisma.ticket.findMany({ where: { scheduleId } });

  const summarizeTickets = (tickets) => {
    return tickets.reduce(
      (acc, t) => {
        acc.total += 1;

        if (["sold", "remitted", "lost"].includes(t.status)) {
          acc.sold += 1;
        }

        if (["allocated", "not_allocated"].includes(t.status)) {
          acc.remaining += 1;
        }

        return acc;
      },
      { total: 0, sold: 0, remaining: 0 }
    );
  };

  const complimentaryTickets = scheduleTickets.filter((t) => t.isComplimentary).length;
  const balconyTickets = summarizeTickets(scheduleTickets.filter((t) => t.ticketSection === "balcony" && !t.isComplimentary));
  const orchestraTickets = summarizeTickets(scheduleTickets.filter((t) => t.ticketSection === "orchestra" && !t.isComplimentary));

  // Distributor Summary
  const distributors = await prisma.user.findMany({
    where: {
      distributor: { isNot: null },
      tickets: { some: { scheduleId } },
    },
    select: {
      userId: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  });

  const mappedDistributors = await Promise.all(
    distributors.map(async (d) => {
      const data = await getDistributorAllocatedTickets({ distributorId: d.userId, scheduleId });

      const totalAllocatedTickets = data.length;
      const soldTickets = data.filter((t) => t.status === "sold" || t.isRemitted).length;
      const remittedTickets = data.filter((t) => t.isRemitted).length;
      const unsoldTickets = totalAllocatedTickets - soldTickets;
      const pendingRemittance = soldTickets - remittedTickets;

      const expected = data.reduce((acc, t) => acc + (Number(t.ticketPrice) - schedule.ticketPricing.commissionFee), 0);
      const remitted = data.filter((t) => t.isRemitted).reduce((acc, t) => acc + (Number(t.ticketPrice) - schedule.ticketPricing.commissionFee), 0);

      const balanceDue = expected - remitted;

      return {
        ...d,
        totalAllocatedTickets,
        soldTickets,
        unsoldTickets,
        remittedTickets,
        pendingRemittance,
        expected,
        remitted,
        balanceDue,
      };
    })
  );

  //Ticket Prices
  let ticketPrice;
  let ticketPricesBySection;

  if (schedule.seatingType === "controlledSeating") {
    const seats = await prisma.showSeat.findMany({
      where: { scheduleId },
      include: {
        ticket: {
          select: { ticketPrice: true },
        },
      },
    });

    ticketPricesBySection = seats.reduce((acc, seat) => {
      const section = seat.seatSection;
      const price = seat.ticket?.ticketPrice || 0;

      if (price > 0 && !acc[section]) {
        acc[section] = price;
      }

      return acc;
    }, {});
  } else {
    ticketPrice = scheduleTickets.find((ticket) => ticket.ticketPrice > 0)?.ticketPrice || 0;
  }

  // Distributor Totals
  const distributorsTotal = mappedDistributors.reduce(
    (acc, d) => {
      acc.allocated += d.totalAllocatedTickets;
      acc.sold += d.soldTickets;
      acc.unsold += d.unsoldTickets;
      acc.remitted += d.remitted;
      return acc;
    },
    { allocated: 0, sold: 0, unsold: 0, remitted: 0 }
  );

  // Sales Summary
  const expectedAgg = await prisma.ticket.aggregate({
    where: { scheduleId, isComplimentary: false },
    _sum: { ticketPrice: true },
  });

  const currentAgg = await prisma.ticket.aggregate({
    where: {
      scheduleId,
      status: { in: ["lost", "sold", "remitted"] },
      isComplimentary: false,
    },
    _sum: { ticketPrice: true },
  });

  // gross totals
  const grossExpected = expectedAgg._sum.ticketPrice || 0;
  const grossCurrent = currentAgg._sum.ticketPrice || 0;

  // commission totals
  const commissionExpected = schedule.ticketPricing.commissionFee * (balconyTickets.total + orchestraTickets.total);
  const commissionCurrent = schedule.ticketPricing.commissionFee * (balconyTickets.sold + orchestraTickets.sold);

  // net values
  const expectedSales = grossExpected - commissionExpected;
  const currentSales = grossCurrent - commissionCurrent;
  const remainingSales = expectedSales - currentSales;

  return {
    ticketsSummary: {
      total: scheduleTickets.length,
      complimentary: complimentaryTickets,
      orchestraTickets,
      balconyTickets,
    },
    distributorSummary: {
      distributors: mappedDistributors,
      distributorsTotal,
    },
    salesSummary: {
      expected: expectedSales,
      current: currentSales,
      remaining: remainingSales,
      netAfterCommission: currentSales - schedule.commissionFee * (orchestraTickets.sold + balconyTickets.sold),
    },
    schedulePrices: {
      ticketPrice,
      ticketPricesBySection,
    },
  };
};

export const getScheduleTickets = async (scheduleId) => {
  const tickets = await prisma.ticket.findMany({
    where: { scheduleId },
    orderBy: {
      controlNumber: "asc",
    },
    include: {
      seats: {
        select: {
          seatNumber: true,
        },
        take: 1,
      },
      logs: {
        select: {
          action: {
            select: {
              metaData: true,
              actionType: true,
            },
          },
        },
      },
    },
  });

  const mapped = tickets.map((ticket) => {
    const transferLogs = ticket.logs.filter((l) => l.action.actionType === "transfer").map((l) => l.action.metaData);

    return {
      ...ticket,
      seatNumber: ticket.seats[0]?.seatNumber ?? null,
      isRemitted: ticket.status === "lost" || ticket.status === "sold" || ticket.status === "remitted",
      ticketTransferMetaData: transferLogs.length > 0 ? transferLogs : null,
    };
  });

  return mapped;
};

export const getDistributorsForTicketAllocation = async ({ departmentId, scheduleId }) => {
  const result = await prisma.distributor.findMany({
    where: {
      ...(departmentId
        ? {
            OR: [{ departmentId }, { departmentId: null }],
          }
        : {}),
      user: {
        isArchived: false,
      },
    },
    select: {
      user: {
        select: {
          firstName: true,
          userId: true,
          lastName: true,
          distributor: {
            select: {
              distributorType: true,
              department: {
                select: {
                  name: true,
                },
              },
            },
          },
          tickets: {
            where: {
              scheduleId,
            },
            select: {
              controlNumber: true,
              status: true,
            },
          },
        },
      },
    },
    orderBy: {
      user: {
        lastName: "asc",
      },
    },
  });

  return result.map((distributor) => ({
    userId: distributor.user.userId,
    department: distributor.user.distributor.department?.name ?? "No Department",
    distributorType: distributor.user.distributor.distributorType,
    firstName: distributor.user.firstName,
    lastName: distributor.user.lastName,
    tickets: distributor.user.tickets,
  }));
};

export const getScheduleDistributors = async (scheduleId) => {
  // Get all distributors who have allocations for this schedule
  const distributors = await prisma.user.findMany({
    where: {
      distributor: { isNot: null },
      tickets: { some: { scheduleId } }, // tickets linked to this distributor for this schedule
    },
    select: {
      userId: true,
      firstName: true,
      lastName: true,
      email: true,
      distributor: {
        select: {
          department: { select: { name: true } },
          distributorType: true,
        },
      },
      tickets: {
        where: { scheduleId },
        select: {
          ticketId: true,
          status: true,
        },
      },
    },
    orderBy: {
      lastName: "asc",
    },
  });

  return distributors.map((dist) => {
    const allocatedTickets = dist.tickets.filter((t) => t.status === "allocated");
    const totalAllocated = allocatedTickets.length;
    const totalSold = dist.tickets.filter((t) => ["sold", "remitted", "lost"].includes(t.status)).length;

    return {
      userId: dist.userId,
      name: `${dist.lastName}, ${dist.firstName}`,
      totalAllocated,
      totalSold,
      email: dist.email,
      department: dist.distributor?.department?.name ?? null,
      distributorType: dist.distributor.distributorType,
    };
  });
};

export const getScheduleSeatMap = async (scheduleId) => {
  const seatMap = await prisma.showSeat.findMany({
    where: { scheduleId },
    select: {
      seatNumber: true,
      seatSection: true,
      status: true,
      x: true,
      y: true,
      rotation: true,
      ticket: {
        select: {
          controlNumber: true,
          ticketPrice: true,
          isComplimentary: true,
          distributor: {
            select: {
              firstName: true,
              lastName: true,
              distributor: {
                select: {
                  distributorType: {
                    select: {
                      name: true,
                    },
                  },
                  department: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const formattedSeats = seatMap.map((seat) => ({
    seatNumber: seat.seatNumber,
    x: seat.x,
    y: seat.y,
    row: seat.seatNumber.replace(/[0-9]/g, ""),
    section: seat.seatSection,
    rotation: seat.rotation,
    status: seat.status,
    ticketControlNumber: seat.ticket?.controlNumber ?? 0,
    ticketPrice: seat.ticket?.ticketPrice ?? 0,
    isComplimentary: seat.ticket?.isComplimentary ?? false,
    distributor: seat.ticket?.distributor
      ? {
          name: `${seat.ticket.distributor.firstName} ${seat.ticket.distributor.lastName}`,
          type: seat.ticket.distributor.distributor?.distributorType?.name ?? null,
          department: seat.ticket.distributor.distributor?.department?.name ?? null,
        }
      : null,
  }));

  return formattedSeats;
};

export const allocateTicket = async ({ scheduleId, distributorId, allocatedBy, controlNumbers }) => {
  const res = await prisma.$transaction(async (tx) => {
    // Validate distributor exists and is active
    const distributor = await tx.user.findFirst({
      where: {
        userId: distributorId,
        isArchived: false,
      },
      include: {
        distributor: true,
      },
    });

    if (!distributor) {
      throw new AppError("Distributor not found or not active", HttpStatusCodes.NotFound);
    }

    // Validate schedule exists and is open
    const schedule = await tx.showSchedule.findFirst({
      where: {
        scheduleId,
        isOpen: true,
      },
    });

    if (!schedule) {
      throw new AppError("Schedule not found or not available for allocation", HttpStatusCodes.NotFound);
    }

    // Find and validate tickets
    const tickets = await tx.ticket.findMany({
      where: {
        scheduleId,
        controlNumber: {
          in: controlNumbers,
        },
      },
      include: {
        schedule: true,
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
    await tx.ticketActionLog.create({
      data: {
        actionLogId: crypto.randomUUID(),
        scheduleId,
        distributorId,
        actionBy: allocatedBy,
        actionDate: new Date(),
        actionType: "allocate",
        logs: {
          create: validTickets.map((ticket) => ({
            ticketId: ticket.ticketId,
          })),
        },
      },
    });

    // Update the tickets status
    await tx.ticket.updateMany({
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
      const seatNumbers = await prisma.showSeat.findMany({
        where: {
          scheduleId,
          ticketId: {
            in: validTickets.map((ticket) => ticket.ticketId),
          },
        },
        select: {
          seatNumber: true,
        },
      });

      if (seatNumbers.length > 0) {
        await tx.showSeat.updateMany({
          where: {
            scheduleId,
            seatNumber: {
              in: seatNumbers.map((s) => s.seatNumber),
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

  if (res.success) {
    sendTicketNotificationsToDistributor({
      actionBy: allocatedBy,
      distributorId,
      scheduleId,
      totalTickets: controlNumbers.length,
      action: DistributorTicketNotification.ALLOCATE,
    });
  }
};

export const unallocateTicket = async ({ scheduleId, distributorId, unallocatedBy, controlNumbers }) => {
  const res = await prisma.$transaction(async (tx) => {
    // Validate distributor exists and is active
    const distributor = await tx.user.findFirst({
      where: {
        userId: distributorId,
        isArchived: false,
      },
      include: {
        distributor: true,
      },
    });

    if (!distributor) {
      throw new AppError("Distributor not found or not active", HttpStatusCodes.NotFound);
    }

    // Validate schedule exists and is open
    const schedule = await tx.showSchedule.findFirst({
      where: {
        scheduleId,
        isOpen: true,
      },
    });

    if (!schedule) {
      throw new AppError("Schedule not found or not available for allocation", HttpStatusCodes.NotFound);
    }

    // Find and validate tickets
    const tickets = await tx.ticket.findMany({
      where: {
        scheduleId,
        controlNumber: {
          in: controlNumbers,
        },
      },
      include: {
        schedule: true,
      },
    });

    if (tickets.length === 0) {
      throw new AppError("No tickets found with the given control numbers", HttpStatusCodes.NotFound);
    }

    // Check for invalid tickets
    const invalidTickets = [];
    const validTickets = [];

    for (const ticket of tickets) {
      if (ticket.status !== "allocated") {
        invalidTickets.push({
          controlNumber: ticket.controlNumber,
          reason: `Ticket does not have allocation status`,
        });
        continue;
      }

      if (ticket.isComplimentary) {
        invalidTickets.push({
          controlNumber: ticket.controlNumber,
          reason: "Complimentary tickets cannot be unallocated",
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
      throw new AppError("No valid tickets available for unallocation", HttpStatusCodes.Conflict);
    }

    // Create allocation log with allocated tickets
    await tx.ticketActionLog.create({
      data: {
        actionLogId: crypto.randomUUID(),
        scheduleId,
        distributorId,
        actionBy: unallocatedBy,
        actionDate: new Date(),
        actionType: "unallocate",
        logs: {
          create: validTickets.map((ticket) => ({
            ticketId: ticket.ticketId,
          })),
        },
      },
    });

    // Update the tickets status
    await tx.ticket.updateMany({
      where: {
        ticketId: {
          in: validTickets.map((ticket) => ticket.ticketId),
        },
      },
      data: {
        status: "not_allocated",
        distributorId: null,
      },
    });

    if (schedule.seatingType === "controlledSeating") {
      const seatNumbers = await tx.showSeat.findMany({
        where: {
          scheduleId,
          ticketId: {
            in: validTickets.map((ticket) => ticket.ticketId),
          },
        },
        select: {
          seatNumber: true,
        },
      });

      if (seatNumbers.length > 0) {
        await tx.showSeat.updateMany({
          where: {
            scheduleId,
            seatNumber: {
              in: seatNumbers.map((s) => s.seatNumber),
            },
          },
          data: {
            status: "available",
          },
        });
      }
    }

    return {
      success: true,
      message: `Successfully unallocated ${validTickets.length} tickets`,
    };
  });

  if (res.success) {
    sendTicketNotificationsToDistributor({
      actionBy: unallocatedBy,
      distributorId,
      scheduleId,
      totalTickets: controlNumbers.length,
      action: DistributorTicketNotification.UNALLOCATE,
    });
  }
};

export const remitTicketSales = async ({
  sold,
  lost,
  discounted = [],
  discountPercentage = null,
  scheduleId,
  distributorId,
  actionBy,
  remarks = null,
}) => {
  const schedule = await prisma.showSchedule.findUnique({
    where: { scheduleId },
    include: { ticketPricing: true },
  });

  if (!schedule) {
    throw new AppError("Provided Schedule does not exist");
  }

  const distributor = await prisma.user.findUnique({
    where: { userId: distributorId },
    include: {
      distributor: {
        select: {
          hasCommission: true,
        },
      },
    },
  });

  if (!distributor) {
    throw new AppError("Distributor not found");
  }

  const allControlNumbers = [...sold, ...lost, ...discounted];

  const tickets = await prisma.ticket.findMany({
    where: { scheduleId, controlNumber: { in: allControlNumbers } },
    select: { ticketId: true, controlNumber: true, ticketPrice: true },
  });

  const ticketIdMap = Object.fromEntries(tickets.map((t) => [t.controlNumber, t.ticketId]));

  const commissionFee = Number(schedule.ticketPricing.commissionFee);
  const hasCommission = distributor.distributor.hasCommission ?? false;

  let totalAmount = 0;
  let totalCommission = 0;

  for (const ticket of tickets) {
    let price = Number(ticket.ticketPrice);

    if (discounted.includes(ticket.controlNumber) && discountPercentage) {
      price = price - price * (discountPercentage / 100);
    }

    totalAmount += price;

    if (hasCommission) {
      totalCommission += commissionFee;
    }
  }

  // Action log ID
  const actionLogId = crypto.randomUUID();

  const res = await prisma.$transaction(async (tx) => {
    // Sold → remitted
    if (sold.length > 0) {
      await tx.ticket.updateMany({
        where: { scheduleId, controlNumber: { in: sold } },
        data: { status: "remitted" },
      });

      // Update seat status to sold
      await tx.showSeat.updateMany({
        where: { scheduleId, ticketId: { in: sold.map((cn) => ticketIdMap[cn]) } },
        data: { status: "sold" },
      });
    }

    // Lost → lost
    if (lost.length > 0) {
      await tx.ticket.updateMany({
        where: { scheduleId, controlNumber: { in: lost } },
        data: { status: "lost" },
      });

      // Update seat status to sold
      await tx.showSeat.updateMany({
        where: { scheduleId, ticketId: { in: sold.map((cn) => ticketIdMap[cn]) } },
        data: { status: "sold" },
      });
    }

    // Discounted tickets → set discount
    if (discounted.length > 0 && discountPercentage !== null) {
      await tx.ticket.updateMany({
        where: { scheduleId, controlNumber: { in: discounted } },
        data: { discountPercentage },
      });

      // Update seat status to sold
      await tx.showSeat.updateMany({
        where: { scheduleId, ticketId: { in: sold.map((cn) => ticketIdMap[cn]) } },
        data: { status: "sold" },
      });
    }

    // Create ticket action log
    await tx.ticketActionLog.create({
      data: {
        actionLogId,
        actionBy,
        distributorId,
        scheduleId,
        remarks,
        actionType: "remit",
        logs: {
          createMany: {
            data: [
              ...sold.map((cn) => ({
                ticketId: ticketIdMap[cn],
              })),
              ...lost.map((cn) => ({
                ticketId: ticketIdMap[cn],
              })),
            ],
          },
        },
      },
    });

    return true;
  });

  if (res) {
    console.log({
      amountRemitted: totalAmount - totalCommission,
      totalCommission,
    });

    sendTicketNotificationsToDistributor({
      actionBy,
      distributorId,
      scheduleId,
      totalTickets: allControlNumbers.length,
      action: DistributorTicketNotification.REMIT,
      metaData: {
        amountRemitted: totalAmount - totalCommission,
        totalCommission,
        remarks,
      },
    });
  }
};

export const unremitTicketSales = async ({ remittedTickets, scheduleId, distributorId, actionBy, remarks = null }) => {
  const schedule = await prisma.showSchedule.findUnique({
    where: { scheduleId },
  });

  if (!schedule) {
    throw new AppError("Provided Schedule does not exist");
  }

  const distributor = await prisma.user.findUnique({
    where: { userId: distributorId },
  });

  if (!distributor) {
    throw new AppError("Distributor not found");
  }

  const tickets = await prisma.ticket.findMany({
    where: { scheduleId, controlNumber: { in: remittedTickets } },
    select: { ticketId: true, controlNumber: true, status: true },
  });

  const lostTickets = tickets.filter((t) => t.status == "lost");

  if (lostTickets.length > 0) {
    throw new AppError(
      "Unremittance Failed because ticket control number(s) - (" +
        lostTickets.map((t) => t.controlNumber).join(", ") +
        ")  are marked as lost ticket(s) and cannot be unremitted. If you think this is a mistake you could navigate to tickets section and mark this tickets as not lost"
    );
  }

  const ticketIdMap = Object.fromEntries(tickets.map((t) => [t.controlNumber, t.ticketId]));

  const actionLogId = crypto.randomUUID();

  const res = await prisma.$transaction(async (tx) => {
    await tx.ticket.updateMany({
      where: {
        scheduleId,
        controlNumber: { in: remittedTickets },
        status: "remitted",
      },
      data: { status: "allocated" },
    });

    await tx.showSeat.updateMany({
      where: {
        scheduleId,
        ticket: {
          controlNumber: {
            in: remittedTickets,
          },
        },
        status: "sold",
      },
      data: {
        status: "reserved",
      },
    });

    await tx.ticketActionLog.create({
      data: {
        actionLogId,
        actionBy,
        distributorId,
        scheduleId,
        remarks,
        actionType: "unremit",
        logs: {
          createMany: {
            data: remittedTickets.map((cn) => ({
              ticketId: ticketIdMap[cn],
            })),
          },
        },
      },
    });

    return true;
  });

  if (res) {
    sendTicketNotificationsToDistributor({
      actionBy,
      distributorId,
      scheduleId,
      totalTickets: remittedTickets.length,
      action: DistributorTicketNotification.UNREMIT,
      metaData: {
        remarks,
      },
    });
  }
};

export const addTallyData = async ({ femaleCount, maleCount, scheduleId }) => {
  return await prisma.showSchedule.update({
    where: { scheduleId },
    data: {
      maleCount,
      femaleCount,
    },
    select: {
      scheduleId: true,
    },
  });
};

export const getTallyData = async (scheduleId) => {
  return await prisma.showSchedule.findUnique({ where: { scheduleId }, select: { femaleCount: true, maleCount: true } });
};

export const getDistributorTicketActivities = async (scheduleId) => {
  const logs = await prisma.ticketActionLog.findMany({
    where: {
      scheduleId,
      actionType: {
        in: ["soldTicket", "unsoldTicket"],
      },
    },
    select: {
      distributor: {
        select: {
          firstName: true,
          lastName: true,
          userId: true,
        },
      },
      metaData: true,
      actionLogId: true,
      actionType: true,
      actionDate: true,
    },
    orderBy: {
      actionDate: "desc",
    },
  });

  return logs;
};

export const transferTicket = async ({ reason, actionBy, scheduleId, controlNumber, newScheduleId, seatNumber = null }) => {
  const odlSchedule = await prisma.showSchedule.findUnique({
    where: { scheduleId },
    include: {
      show: {
        select: {
          showId: true,
          title: true,
        },
      },
    },
  });

  if (!odlSchedule) {
    throw new AppError("Schedule Not Found");
  }

  const newSchedule = await prisma.showSchedule.findUnique({
    where: { scheduleId: newScheduleId },
    include: {
      seats: {
        include: {
          ticket: true,
        },
      },
      show: {
        select: {
          showId: true,
          title: true,
        },
      },
    },
  });

  if (!newSchedule) {
    throw new AppError("Schedule Not Found");
  }

  if (newSchedule.seatingType === "controlledSeating" && newSchedule.seats && seatNumber) {
    const seat = newSchedule.seats.filter((seat) => seat.seatNumber == seatNumber && seat.status == "available");

    if (!seat) {
      throw new AppError("Selected seat is not available in the new schedule");
    }
  }

  const lastControlNumber = await prisma.ticket.findFirst({
    where: { scheduleId: newScheduleId },
    orderBy: { controlNumber: "desc" },
    select: { controlNumber: true },
  });

  return await prisma.$transaction(async (tx) => {
    const updatedTicket = await tx.ticket.update({
      where: {
        scheduleId,
        controlNumber,
      },
      data: {
        scheduleId: newScheduleId,
        controlNumber: lastControlNumber.controlNumber + 1,
      },
    });

    if (newSchedule.seatingType === "controlledSeating" && newSchedule.seats && seatNumber) {
      const updatedSeat = await tx.showSeat.update({
        where: {
          scheduleId,
          seatNumber,
        },
        data: {
          ticketId: updatedTicket.ticketId,
          status: "sold",
        },
      });

      await tx.ticket.update({
        where: {
          ticketId: updatedTicket.ticketId,
        },
        data: {
          ticketSection: updatedSeat.seatSection.includes("balcony") ? "balcony" : "orchestra",
        },
      });

      if (odlSchedule.seatingType === "controlledSeating") {
        await tx.showSeat.update({
          where: {
            scheduleId,
            ticketId: updatedTicket.ticketId,
          },
          data: {
            ticketId: null,
            status: "available",
          },
        });
      }
    }

    await tx.ticketActionLog.create({
      data: {
        actionLogId: crypto.randomUUID(),
        actionType: "transfer",
        actionBy,
        remarks: reason,
        metaData: {
          oldControlNumber: Number(controlNumber),
          oldShowId: odlSchedule.show.showId,
          oldShowTitle: odlSchedule.show.title,
          oldScheduleId: odlSchedule.scheduleId,
          oldScheduleDate: odlSchedule.datetime,
          newShowId: newSchedule.show.showId,
          newShowTitle: newSchedule.show.title,
          newScheduleId: newSchedule.scheduleId,
          newScheduleDate: newSchedule.datetime,
        },
      },
    });
  });
};
