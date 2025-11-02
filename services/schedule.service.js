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

  await prisma.$transaction(async (tx) => {
    await tx.showSchedule.update({ where: { scheduleId }, data: { isOpen: false } });
    await tx.ticket.updateMany({
      where: {
        scheduleId,
        status: "paidToCCA",
      },
      data: {
        status: "remitted",
      },
    });
  });
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
      const controlNumbers = existingSchedule.tickets.filter((t) => !t.isComplimentary).map((t) => t.controlNumber);
      const complimentaryControlNumbers = existingSchedule.tickets.filter((t) => t.isComplimentary).map((t) => t.controlNumber);

      await generateScheduleTicketsAndSeats({
        tx,
        scheduleId: newSchedule.scheduleId,
        ticketPricing: existingSchedule.ticketPricing,
        seatPricing: existingSchedule.ticketPricing.type || "fixed",
        controlNumbers: {
          tickets: controlNumbers,
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

  const allTickets = controlNumbers?.tickets || [];
  const complimentary = controlNumbers?.complimentary || [];

  const isControlled = seatingConfiguration === "controlledSeating";
  const isFixedPrice = seatPricing === "fixed";

  const createTicketAndLinkSeat = (num, complimentaryTicket = false) => {
    let price = ticketPricing.fixedPrice;
    let seat = null;

    if (isControlled) {
      seat = seats.find((s) => s.ticketControlNumber === num);
      if (!seat) throw new AppError(`No matching seat for control number ${num}`);
      if (!isFixedPrice && !complimentaryTicket) price = seat.ticketPrice;
      complimentaryTicket = seat.isComplimentary;
    }

    const ticketId = crypto.randomUUID();

    tickets.push({
      ticketId,
      scheduleId,
      controlNumber: num,
      ticketPrice: complimentaryTicket ? 0 : price,
      isComplimentary: complimentaryTicket,
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

  allTickets.forEach((num) => createTicketAndLinkSeat(num));
  complimentary.forEach((num) => createTicketAndLinkSeat(num, true));

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
  const schedule = await prisma.showSchedule.findUnique({
    where: { scheduleId },
    include: { ticketPricing: true },
  });

  if (!schedule) throw new AppError("Schedule Not Found");

  const scheduleTickets = await prisma.ticket.findMany({ where: { scheduleId } });

  const summarizeTickets = (tickets) => {
    return tickets.reduce(
      (acc, t) => {
        acc.total += 1;

        if (["sold", "paidToCCA", "remitted"].includes(t.status)) acc.sold += 1;
        if (["allocated", "not_allocated"].includes(t.status)) acc.remaining += 1;
        if (t.status === "not_allocated") acc.notAllocated += 1;
        if (t.status === "allocated") acc.allocated += 1;
        if (t.status === "sold") acc.unpaid += 1;
        if (["paidToCCA", "remitted"].includes(t.status)) acc.paid += 1;

        return acc;
      },
      { total: 0, sold: 0, remaining: 0, notAllocated: 0, allocated: 0, unpaid: 0, paid: 0 }
    );
  };

  const complimentaryTickets = scheduleTickets.filter((t) => t.isComplimentary).length;
  const regularTickets = summarizeTickets(scheduleTickets.filter((t) => !t.isComplimentary));

  const distributorsWithTickets = await prisma.user.findMany({
    where: {
      tickets: { some: { scheduleId } },
    },
    select: {
      userId: true,
      firstName: true,
      lastName: true,
      email: true,
      tickets: {
        where: { scheduleId },
        select: {
          ticketId: true,
          ticketPrice: true,
          status: true,
          isComplimentary: true,
        },
      },
    },
  });

  const mappedDistributors = distributorsWithTickets.map((d) => {
    const tickets = d.tickets.filter((t) => !t.isComplimentary);

    const totalAllocatedTickets = tickets.length;

    const soldTickets = tickets.filter((t) => ["sold", "remitted", "paidToCCA"].includes(t.status)).length;
    const paidTickets = tickets.filter((t) => t.status === "paidToCCA").length;
    const unPaidTickets = tickets.filter((t) => t.status === "sold").length;
    const unsoldTickets = totalAllocatedTickets - soldTickets;
    const expected = tickets.reduce((acc, t) => acc + Number(t.ticketPrice - schedule.ticketPricing.commissionFee), 0);
    const paid = tickets
      .filter((t) => ["remitted", "paidToCCA"].includes(t.status))
      .reduce((acc, t) => acc + Number(t.ticketPrice - schedule.ticketPricing.commissionFee), 0);

    const balanceDue = expected - paid;

    return {
      userId: d.userId,
      firstName: d.firstName,
      lastName: d.lastName,
      email: d.email,
      totalAllocatedTickets,
      soldTickets,
      unsoldTickets,
      paidTickets,
      unPaidTickets,
      expected,
      paid,
      balanceDue,
    };
  });

  const distributorsTotal = mappedDistributors.reduce(
    (acc, d) => {
      acc.allocated += d.totalAllocatedTickets;
      acc.sold += d.soldTickets;
      acc.unsold += d.unsoldTickets;
      acc.paidToCCA += d.paid;
      return acc;
    },
    { allocated: 0, sold: 0, unsold: 0, paidToCCA: 0 }
  );

  const totalPaidToCCA = scheduleTickets
    .filter((t) => t.status === "paidToCCA")
    .reduce((acc, t) => acc + (Number(t.ticketPrice) - schedule.ticketPricing.commissionFee), 0);

  const totalRemittedToFinance = scheduleTickets
    .filter((t) => t.status === "remitted")
    .reduce((acc, t) => acc + (Number(t.ticketPrice) - schedule.ticketPricing.commissionFee), 0);

  const totalExpected = scheduleTickets
    .filter((t) => !t.isComplimentary)
    .reduce((acc, t) => acc + (Number(t.ticketPrice) - schedule.ticketPricing.commissionFee), 0);

  const cashOnHand = totalPaidToCCA;

  return {
    ticketsSummary: {
      total: scheduleTickets.length,
      complimentary: complimentaryTickets,
      regularTickets,
    },
    distributorSummary: {
      distributors: mappedDistributors,
      distributorsTotal,
    },
    salesSummary: {
      expected: totalExpected,
      cashOnHand,
      remittedToFinance: totalRemittedToFinance,
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
          seatSection: true,
        },
        take: 1,
      },
      distributor: {
        select: {
          firstName: true,
          lastName: true,
          distributor: {
            select: {
              distributorType: true,
            },
          },
        },
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
      distributorName: ticket?.distributor ? ticket.distributor.firstName + " " + ticket.distributor.lastName : null,
      distributorType: ticket?.distributor?.distributor?.distributorType ? ticket.distributor.distributor.distributorType : null,
      seatNumber: ticket.seats[0]?.seatNumber ?? null,
      seatSection: ticket.seats[0]?.seatSection ?? null,
      isPaid: ticket.status === "paidToCCA",
      ticketTransferMetaData: transferLogs.length > 0 ? transferLogs : null,
    };
  });

  return mapped;
};

export const getTicketLogs = async (scheduleId, controlNumber) => {
  const ticketLogs = await prisma.ticketActionLog.findMany({
    where: {
      scheduleId,
      logs: {
        some: {
          ticket: {
            controlNumber: Number(controlNumber),
          },
        },
      },
    },
    select: {
      actionType: true,
      actionDate: true,
      actionByUser: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      distributor: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      logs: {
        where: {
          ticket: {
            controlNumber: Number(controlNumber),
          },
        },
        select: {
          ticket: {
            select: {
              distributor: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      actionDate: "desc",
    },
  });

  return ticketLogs.map((log) => {
    const ticketInfo = log.logs[0]?.ticket;

    return {
      logType: log.actionType,
      actionBy: `${log.actionByUser.firstName} ${log.actionByUser.lastName}`,
      logDate: log.actionDate,
      distributorName: log?.distributor ? `${log.distributor.firstName} ${log.distributor.lastName}` : "Unassigned",
      currentDistributor: ticketInfo?.distributor ? `${ticketInfo.distributor.firstName} ${ticketInfo.distributor.lastName}` : "Unassigned",
    };
  });
};

export const generateTicketInformations = async (scheduleId) => {
  const result = await prisma.ticket.findMany({
    where: {
      scheduleId,
      isComplimentary: false,
    },
    select: {
      controlNumber: true,
      status: true,
      isComplimentary: true,
      distributor: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: {
      controlNumber: "asc",
    },
  });

  return result.map((ticket) => ({
    controlNumber: ticket.controlNumber,
    distributorName: ticket?.distributor ? ticket.distributor.firstName + " " + ticket.distributor.lastName : "",
    currentStatus: ticket.status,
    isComplimentary: ticket.isComplimentary,
  }));
};

export const getUnallocatedTickets = async (scheduleId) => {
  const unallocatedTickets = await prisma.ticket.findMany({
    where: { scheduleId, status: "not_allocated", isComplimentary: false },
    orderBy: { controlNumber: "asc" },
    select: { controlNumber: true, ticketId: true },
  });

  return unallocatedTickets;
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
                  departmentId: true,
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
    department: {
      name: distributor.user.distributor.department?.name ?? "No Department",
      id: distributor.user.distributor.department?.departmentId ?? null,
    },
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
          department: { select: { name: true, departmentId: true } },
          distributorType: true,
        },
      },
      tickets: {
        where: { scheduleId },
        select: {
          ticketId: true,
          controlNumber: true,
          status: true,
        },
      },
    },
    orderBy: {
      lastName: "asc",
    },
  });

  return distributors.map((dist) => {
    const totalAllocated = dist.tickets.length;
    const totalSold = dist.tickets.filter((t) => ["sold", "remitted", "lost"].includes(t.status)).length;

    return {
      userId: dist.userId,
      name: `${dist.lastName}, ${dist.firstName}`,
      totalAllocated,
      totalSold,
      email: dist.email,
      department: {
        name: dist.distributor?.department?.name ?? null,
        id: dist.distributor?.department?.departmentId ?? null,
      },
      ticketControlNumbers: dist.tickets.map((t) => t.controlNumber),
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

export const allocateTicketsToDistributorsService = async ({ scheduleId, allocatedBy, allocations }) => {
  return await prisma.$transaction(
    async (tx) => {
      const unallocatedTickets = await getUnallocatedTickets(scheduleId);

      const totalAvailable = unallocatedTickets.length;
      const totalRequested = allocations.reduce((sum, a) => sum + a.ticketCount, 0);

      if (totalRequested > totalAvailable) {
        throw new AppError(`Not enough tickets. Requested ${totalRequested}, but only ${totalAvailable} available.`);
      }

      let currentIndex = 0;
      const results = [];

      for (const { distributorId, ticketCount, name } of allocations) {
        const ticketsToAllocate = unallocatedTickets.slice(currentIndex, currentIndex + ticketCount);

        if (!ticketsToAllocate.length) {
          results.push({ distributorId, name, allocatedCount: 0, success: false, message: "No tickets available" });
          continue;
        }

        await tx.ticket.updateMany({
          where: { ticketId: { in: ticketsToAllocate.map((t) => t.ticketId) } },
          data: { status: "allocated", distributorId },
        });

        await tx.showSeat.updateMany({
          where: { scheduleId, ticketId: { in: ticketsToAllocate.map((t) => t.ticketId) } },
          data: { status: "reserved" },
        });

        await tx.ticketActionLog.create({
          data: {
            actionLogId: crypto.randomUUID(),
            scheduleId,
            distributorId,
            actionBy: allocatedBy,
            actionDate: new Date(),
            actionType: "allocate",
            logs: { create: ticketsToAllocate.map((t) => ({ ticketId: t.ticketId })) },
          },
        });

        currentIndex += ticketCount;
        results.push({ distributorId, name, allocatedCount: ticketsToAllocate.length, success: true });

        sendTicketNotificationsToDistributor({
          actionBy: allocatedBy,
          distributorId,
          scheduleId,
          totalTickets: ticketsToAllocate.length,
          action: DistributorTicketNotification.ALLOCATE,
        });
      }

      return results;
    },
    {
      timeout: 60000,
    }
  );
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

export const payTicketSales = async ({
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
    if (sold.length > 0) {
      await tx.ticket.updateMany({
        where: { scheduleId, controlNumber: { in: sold } },
        data: { status: "paidToCCA" },
      });

      // Update seat status to sold
      await tx.showSeat.updateMany({
        where: { scheduleId, ticketId: { in: sold.map((cn) => ticketIdMap[cn]) } },
        data: { status: "paidToCCA" },
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
        data: { status: "paidToCCA" },
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
        data: { status: "paidToCCA" },
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
        actionType: "payToCCA",
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

export const unPayTicketSales = async ({ remittedTickets, scheduleId, distributorId, actionBy, remarks = null }) => {
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
        status: "paidToCCA",
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
        status: "paidToCCA",
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
        actionType: "unPayToCCA",
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

export const trainerSellTicket = async (scheduleId, controlNumber, trainerId, customerName = null, customerEmail = null) => {
  const ticket = await prisma.ticket.findFirst({
    where: { scheduleId, controlNumber },
    select: { ticketId: true, controlNumber: true, ticketPrice: true, status: true, isComplimentary: true },
  });

  if (ticket.isComplimentary) {
    throw new AppError("Cannot sell/remit a complimentary ticket");
  }

  if (ticket.status !== "not_allocated") {
    throw new AppError("You can only directly sell/remit ticket that is not allocated");
  }

  const actionLogId = crypto.randomUUID();

  await prisma.$transaction(async (tx) => {
    await tx.ticket.update({
      where: { scheduleId, ticketId: ticket.ticketId },
      data: { status: "paidToCCA", customerEmail, customerName, distributorId: trainerId, trainerSold: true },
    });

    const seat = await tx.showSeat.findFirst({
      where: { scheduleId, ticketId: ticket.ticketId },
    });

    if (seat) {
      await tx.showSeat.update({
        where: {
          scheduleId_seatNumber: {
            scheduleId,
            seatNumber: seat.seatNumber,
          },
        },
        data: { status: "paidToCCA" },
      });
    }

    await tx.ticketActionLog.create({
      data: {
        actionLogId,
        actionBy: trainerId,
        distributorId: trainerId,
        scheduleId,
        actionType: "payToCCA",
        logs: {
          createMany: {
            data: {
              ticketId: ticket.ticketId,
            },
          },
        },
      },
    });

    return true;
  });
};

export const refundTicket = async (scheduleId, controlNumber, trainerId, distributorId, remarks = null) => {
  const ticket = await prisma.ticket.findFirst({
    where: { scheduleId, controlNumber },
    select: { ticketId: true, controlNumber: true, ticketPrice: true, isComplimentary: true, status: true, distributor: true },
  });

  if (ticket.isComplimentary) {
    throw new AppError("Cannot refund a complimentary ticket");
  }

  if (ticket.status !== "paidToCCA") {
    throw new AppError("You can only refund ticket that the payment still on the CCA");
  }

  const actionLogId = crypto.randomUUID();

  await prisma.$transaction(async (tx) => {
    await tx.ticket.update({
      where: { scheduleId, ticketId: ticket.ticketId },
      data: { status: "not_allocated", distributorId: null, customerEmail: null, customerName: null, trainerSold: false },
    });

    const seat = await tx.showSeat.findFirst({
      where: { scheduleId, ticketId: ticket.ticketId },
    });

    if (seat) {
      await tx.showSeat.update({
        where: {
          scheduleId_seatNumber: {
            scheduleId,
            seatNumber: seat.seatNumber,
          },
        },
        data: { status: "available" },
      });
    }

    await tx.ticketActionLog.create({
      data: {
        actionLogId,
        actionBy: trainerId,
        distributorId,
        scheduleId,
        actionType: "refund",
        remarks,
        logs: {
          createMany: {
            data: {
              ticketId: ticket.ticketId,
            },
          },
        },
      },
    });

    return true;
  });
};

export const getShowsWithAvailbleTicketTransfer = async ({ departmentId, scheduleId }) => {
  const shows = await prisma.show.findMany({
    where: {
      ...(departmentId && { departmentId }),
      schedules: {
        some: {
          scheduleId: {
            not: {
              equals: scheduleId,
            },
          },
          isOpen: true,
          datetime: {
            gte: new Date(),
          },
          tickets: {
            some: {
              status: "not_allocated",
            },
          },
        },
      },
    },
    include: {
      department: true,
      schedules: {
        where: {
          scheduleId: {
            not: scheduleId,
          },
          isOpen: true,
          datetime: {
            gte: new Date(),
          },
        },
        include: {
          ticketPricing: true,
          tickets: {
            where: {
              status: "not_allocated",
            },
            orderBy: {
              controlNumber: "asc",
            },
          },
        },
      },
    },
  });

  return shows.sort((a, b) => {
    const aDate = a.schedules[0]?.datetime ? new Date(a.schedules[0].datetime).getTime() : Infinity;
    const bDate = b.schedules[0]?.datetime ? new Date(b.schedules[0].datetime).getTime() : Infinity;
    return aDate - bDate;
  });
};

export const transferTicket = async ({ remarks, trainerId, scheduleId, controlNumber, newScheduleId, newControlNumber }) => {
  // Fetch old schedule with seats
  const oldSchedule = await prisma.showSchedule.findUnique({
    where: { scheduleId },
    include: {
      seats: {
        include: {
          ticket: true,
        },
      },
    },
  });

  if (!oldSchedule) {
    throw new AppError("Original schedule not found");
  }

  // Fetch new schedule with seats
  const newSchedule = await prisma.showSchedule.findUnique({
    where: { scheduleId: newScheduleId },
    include: {
      seats: {
        include: {
          ticket: true,
        },
      },
    },
  });

  if (!newSchedule) {
    throw new AppError("New schedule not found");
  }

  // Fetch old ticket
  const ticket = await prisma.ticket.findFirst({
    where: { scheduleId, controlNumber },
    include: { distributor: true },
  });

  if (!ticket) {
    throw new AppError("Original ticket not found");
  }

  // Fetch new ticket
  const newTicket = await prisma.ticket.findFirst({
    where: { scheduleId: newScheduleId, controlNumber: newControlNumber },
    include: { distributor: true },
  });

  if (!newTicket) {
    throw new AppError("Target ticket not found");
  }

  // Validations
  if (ticket.isComplimentary) {
    throw new AppError("Cannot transfer a complimentary ticket");
  }

  if (ticket.status !== "paidToCCA") {
    throw new AppError("Only ticket payment whose payment are still at CCA can be transferred");
  }

  if (newTicket.isComplimentary) {
    throw new AppError("Cannot transfer to a complimentary ticket");
  }

  if (newTicket.status !== "not_allocated") {
    throw new AppError("Target ticket is not available for allocation");
  }

  // Controlled seating validations
  if (newSchedule.seatingType === "controlledSeating") {
    const seat = newSchedule.seats.find((s) => s.ticket.controlNumber === newControlNumber && s.status === "available");

    if (!seat) {
      throw new AppError("Selected seat is not available in the new schedule");
    }
  }

  // Transaction for atomic transfer
  await prisma.$transaction(async (tx) => {
    // Revert old ticket
    await tx.ticket.update({
      where: { ticketId: ticket.ticketId },
      data: {
        status: "not_allocated",
        distributorId: null,
        customerEmail: null,
        customerName: null,
        trainerSold: false,
      },
    });

    // Assign new ticket
    await tx.ticket.update({
      where: { ticketId: newTicket.ticketId },
      data: {
        status: "paidToCCA",
        distributorId: ticket.distributorId ?? null,
        customerEmail: ticket.customerEmail,
        customerName: ticket.customerName,
        trainerSold: ticket.trainerSold,
      },
    });

    // Update old schedule seat if controlled
    if (oldSchedule.seatingType === "controlledSeating") {
      const oldSeat = oldSchedule.seats.find((s) => s.ticket.controlNumber === ticket.controlNumber);
      if (oldSeat) {
        await tx.showSeat.update({
          where: { scheduleId_seatNumber: { scheduleId, seatNumber: oldSeat.seatNumber } },
          data: { status: "available" },
        });
      }
    }

    // Update new schedule seat if controlled
    if (newSchedule.seatingType === "controlledSeating") {
      const newSeat = newSchedule.seats.find((s) => s.ticket.controlNumber === newControlNumber && s.status === "available");
      if (newSeat) {
        await tx.showSeat.update({
          where: { scheduleId_seatNumber: { scheduleId: newScheduleId, seatNumber: newSeat.seatNumber } },
          data: { status: "paidToCCA", ticketId: newTicket.ticketId },
        });
      }
    }

    // Log unremit old ticket
    await tx.ticketActionLog.create({
      data: {
        actionLogId: crypto.randomUUID(),
        actionBy: trainerId,
        distributorId: ticket.distributorId ?? null,
        scheduleId,
        actionType: "unPayToCCA",
        remarks,
        logs: { create: { ticketId: ticket.ticketId } },
      },
    });

    // Log transer old ticket
    await tx.ticketActionLog.create({
      data: {
        actionLogId: crypto.randomUUID(),
        actionBy: trainerId,
        distributorId: ticket.distributorId ?? null,
        scheduleId,
        actionType: "transfer",
        remarks,
        logs: { create: { ticketId: ticket.ticketId } },
      },
    });

    // Log transfer new ticket
    await tx.ticketActionLog.create({
      data: {
        actionLogId: crypto.randomUUID(),
        actionBy: trainerId,
        distributorId: ticket.distributorId ?? null,
        scheduleId: newScheduleId,
        actionType: "transfer",
        remarks,
        logs: { create: { ticketId: newTicket.ticketId } },
      },
    });

    // Log remit new ticket
    await tx.ticketActionLog.create({
      data: {
        actionLogId: crypto.randomUUID(),
        actionBy: trainerId,
        distributorId: ticket.distributorId ?? null,
        scheduleId: newScheduleId,
        actionType: "payToCCA",
        remarks,
        logs: { create: { ticketId: newTicket.ticketId } },
      },
    });
  });

  return true;
};

export const checkScheduleToBeClosed = async (scheduleId) => {
  const schedule = await prisma.showSchedule.findUnique({
    where: { scheduleId },
    select: {
      ticketPricing: {
        select: {
          commissionFee: true,
        },
      },
    },
  });

  const scheduleTickets = await prisma.ticket.findMany({
    where: { scheduleId, isComplimentary: false },
    select: {
      controlNumber: true,
      ticketPrice: true,
      status: true,
      distributor: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
          distributor: {
            select: {
              distributorType: true,
              department: {
                select: { name: true },
              },
            },
          },
        },
      },
    },
    orderBy: {
      distributor: {
        lastName: "asc",
      },
    },
  });

  if (!scheduleTickets.length) {
    return {
      message: "No tickets found for this schedule",
      distributors: [],
      allTickets: [],
      canBeClosed: true,
      summary: { totalDistributors: 0, withBalanceDue: 0, totalUnpaid: 0 },
    };
  }

  const distributorsMap = {};

  for (const ticket of scheduleTickets) {
    const distributorId = ticket.distributor?.userId || null;

    if (!distributorId) continue;
    const isPaid = (ticket.status === "paidToCCA") | (ticket.status === "remitted");
    const isSold = ticket.status === "sold";
    const commissionFee = Number(schedule?.ticketPricing?.commissionFee || 0);
    const ticketPrice = (Number(ticket.ticketPrice) || 0) - commissionFee;

    if (!distributorsMap[distributorId]) {
      distributorsMap[distributorId] = {
        distributorId,
        name: ticket.distributor ? `${ticket.distributor.lastName}, ${ticket.distributor.firstName}` : "Unassigned",
        department: ticket.distributor?.distributor?.department?.name || "N/A",
        distributorType: ticket.distributor?.distributor?.distributorType || "N/A",
        totalTickets: 0,
        markedSoldTickets: 0,
        paidTickets: 0,
        unpaidTickets: 0,
        unpaidAmount: 0,
        totalPaid: 0,
        tickets: [],
      };
    }

    const info = distributorsMap[distributorId];

    info.totalTickets++;
    info.tickets.push(ticket);

    if (isSold) info.markedSoldTickets++;
    if (isPaid) {
      info.paidTickets++;
      info.totalPaid += ticketPrice;
    } else {
      info.unpaidTickets++;
      info.unpaidAmount += ticketPrice;
    }
  }

  const distributors = Object.values(distributorsMap);
  const withBalanceDue = distributors.filter((d) => d.unpaidAmount > 0);
  const totalUnpaid = withBalanceDue.reduce((acc, d) => acc + d.unpaidAmount, 0);

  return {
    canBeClosed: withBalanceDue.length === 0,
    summary: {
      totalDistributors: distributors.length,
      withBalanceDue: withBalanceDue.length,
      totalUnpaid,
      notAllocatedTickets: scheduleTickets.filter((t) => t.status === "not_allocated"),
    },
    distributors,
    withBalanceDue,
    unAllocatedTickets: scheduleTickets.filter((t) => t.status === "not_allocated"),
  };
};
