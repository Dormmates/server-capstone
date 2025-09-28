import { AppError } from "../middleware/errorHandler.middleware.js";
import prisma from "../utils/primsa.connection.js";

export const getDistributorAllocatedTickets = async ({ distributorId, scheduleId }) => {
  const allocatedTickets = await prisma.ticket.findMany({
    where: {
      distributorId,
      scheduleId,
    },
    select: {
      ticketId: true,
      controlNumber: true,
      ticketPrice: true,
      ticketSection: true,
      showseats: {
        select: { seatNumber: true, seatSection: true },
        take: 1,
      },
      status: true,
      logtickets: {
        select: {
          ticketactionlog: {
            select: {
              actionType: true,
              actionBy: true,
              distributorId: true,
              actionDate: true,
              users_ticketactionlog_distributorIdTousers: {
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
      controlNumber: "asc",
    },
  });

  const mapped = allocatedTickets.map((ticket) => {
    const allocationLog = ticket.logtickets.find((lt) => lt.ticketactionlog.actionType === "allocate");

    return {
      ticketId: ticket.ticketId,
      status: ticket.status,
      ticketPrice: ticket.ticketPrice,
      controlNumber: ticket.controlNumber,
      seatNumber: ticket.showseats[0]?.seatNumber ?? null,
      ticketSection: ticket.ticketSection,
      seatSection: ticket.showseats[0]?.seatSection ?? null,
      dateAllocated: allocationLog?.ticketactionlog.actionDate ?? null,
      allocatedBy: allocationLog?.ticketactionlog.actionBy ?? null,
      isRemitted: ["lost", "remitted"].includes(ticket.status),
      distributor: allocationLog?.ticketactionlog.users_ticketactionlog_distributorIdTousers
        ? `${allocationLog.ticketactionlog.users_ticketactionlog_distributorIdTousers.firstName} ${allocationLog.ticketactionlog.users_ticketactionlog_distributorIdTousers.lastName}`
        : null,
    };
  });

  return mapped;
};

export const getDistributorRemittanceHistory = async ({ distributorId, scheduleId }) => {
  const whereClause = {
    distributorId,
    actionType: { in: ["remit", "unremit"] },
    ...(scheduleId && { scheduleId }), // only add if provided
  };

  const remittanceHistory = await prisma.ticketactionlog.findMany({
    where: whereClause,
    select: {
      scheduleId: true,
      users_ticketactionlog_actionByTousers: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      actionDate: true,
      totalRemittance: true,
      commision: true,
      remarks: true,
      actionLogId: true,
      actionType: true,
      showschedules: {
        select: {
          datetime: true,
          seatingType: true,
          ticketpricing: {
            select: {
              commisionFee: true,
            },
          },
          shows: {
            select: {
              showCover: true,
              title: true,
              showId: true,
            },
          },
        },
      },
      logtickets: {
        select: {
          ticket: {
            select: {
              controlNumber: true,
              ticketPrice: true,
              status: true,
              discountPercentage: true,
              showseats: {
                select: {
                  seatSection: true,
                },
                take: 1,
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

  // Map and compute totals
  const mapped = remittanceHistory.map((log) => {
    const tickets = log.logtickets.map((rt) => ({
      controlNumber: rt.ticket.controlNumber,
      ticketPrice: Number(rt.ticket.ticketPrice || 0),
      discountPercentage: Number(rt.ticket.discountPercentage || 0),
      status: rt.ticket.status,
      seatSection: rt.ticket.showseats[0]?.seatSection ?? null,
    }));

    const commissionFee = Number(log.showschedules.ticketpricing.commisionFee || 0);
    const totalCommission = tickets.length * commissionFee;

    const totalRemittance = tickets.reduce((acc, t) => {
      const discount = t.discountPercentage ? (t.ticketPrice * t.discountPercentage) / 100 : 0;
      return acc + (t.ticketPrice - discount - commissionFee);
    }, 0);

    return {
      showId: log.showschedules.shows.showId,
      seatingType: log.showschedules.seatingType,
      showCover: log.showschedules.shows.showCover,
      showTitle: log.showschedules.shows.title,
      showDate: log.showschedules.datetime,
      remittanceId: log.actionLogId,
      scheduleId: log.scheduleId,
      actionType: log.actionType,
      receivedBy: log.users_ticketactionlog_actionByTousers.firstName + " " + log.users_ticketactionlog_actionByTousers.lastName,
      dateRemitted: log.actionDate,
      remarks: log.remarks,
      tickets,
      totalCommission,
      totalRemittance,
    };
  });

  return mapped;
};

export const getDistributorAllocationHistory = async ({ distributorId, scheduleId }) => {
  const whereClause = {
    distributorId,
    actionType: { in: ["allocate", "unallocate"] },
    ...(scheduleId && { scheduleId }),
  };

  const allocationHistory = await prisma.ticketactionlog.findMany({
    where: whereClause,
    select: {
      scheduleId: true,
      actionType: true,
      actionLogId: true,
      showschedules: {
        select: {
          datetime: true,
          shows: {
            select: {
              showId: true,
              showCover: true,
              title: true,
            },
          },
        },
      },
      users_ticketactionlog_actionByTousers: {
        select: {
          firstName: true,
          lastName: true,
          userId: true,
        },
      },
      users_ticketactionlog_distributorIdTousers: {
        select: {
          firstName: true,
          lastName: true,
          userId: true,
        },
      },
      remarks: true,
      actionDate: true,
      logtickets: {
        select: {
          ticket: {
            select: {
              ticketId: true,
              ticketPrice: true,
              controlNumber: true,
            },
          },
        },
      },
    },
    orderBy: {
      actionDate: "desc",
    },
  });

  const grouped = allocationHistory.map((log) => ({
    showId: log.showschedules.shows.showId,
    showCover: log.showschedules.shows.showCover,
    showTitle: log.showschedules.shows.title,
    showDate: log.showschedules.datetime,
    scheduleId: log.scheduleId,
    actionType: log.actionType,
    remarks: log.remarks,
    allocationLogId: log.actionLogId,
    allocatedBy: log.users_ticketactionlog_actionByTousers,
    distributor: log.users_ticketactionlog_distributorIdTousers,
    dateAllocated: log.actionDate,
    tickets: log.logtickets.map((at) => ({
      ticketId: at.ticket.ticketId,
      ticketPrice: at.ticket.ticketPrice,
      controlNumber: at.ticket.controlNumber,
    })),
  }));

  return grouped;
};

export const getDistributorShowsAndTicketsAllocated = async ({ distributorId }) => {
  const allocatedTickets = await prisma.ticket.findMany({
    where: {
      distributorId,
      showschedules: {
        isOpen: true,
        shows: {
          isArchived: false,
        },
      },
    },
    select: {
      ticketId: true,
      controlNumber: true,
      ticketPrice: true,
      ticketSection: true,
      showseats: {
        select: { seatNumber: true },
        take: 1,
      },
      showschedules: {
        select: {
          datetime: true,
          ticketpricing: {
            select: {
              commisionFee: true,
            },
          },
          scheduleId: true,
          seatingType: true,
          shows: {
            select: {
              showCover: true,
              showId: true,
              title: true,
            },
          },
        },
      },
      status: true,
      logtickets: {
        select: {
          ticketactionlog: {
            select: {
              actionType: true,
              actionBy: true,
              actionDate: true,
            },
          },
        },
      },
    },
    orderBy: {
      controlNumber: "asc",
    },
  });

  // Transform tickets
  const mappedTickets = allocatedTickets.map((ticket) => {
    const allocationLog = ticket.logtickets.find((lt) => lt.ticketactionlog.actionType === "allocate");

    return {
      scheduleId: ticket.showschedules?.scheduleId ?? null,
      datetime: ticket.showschedules?.datetime ?? null,
      commissionFee: ticket.showschedules?.ticketpricing.commisionFee ?? null,
      seatingType: ticket.showschedules?.seatingType ?? null,
      show: ticket.showschedules?.shows ?? null,
      ticketId: ticket.ticketId,
      status: ticket.status,
      ticketPrice: ticket.ticketPrice,
      controlNumber: ticket.controlNumber,
      seatNumber: ticket.showseats[0]?.seatNumber ?? null,
      ticketSection: ticket.ticketSection,
      isRemitted: ["lost", "remitted"].includes(ticket.status),
      dateAllocated: allocationLog?.ticketactionlog.actionDate ?? null,
      allocatedBy: allocationLog?.ticketactionlog.actionBy ?? null,
    };
  });

  // Group by scheduleId
  const groupedBySchedule = mappedTickets.reduce((acc, ticket) => {
    if (!ticket.scheduleId) return acc;

    if (!acc[ticket.scheduleId]) {
      acc[ticket.scheduleId] = {
        scheduleId: ticket.scheduleId,
        datetime: ticket.datetime,
        commissionFee: ticket.commissionFee,
        seatingType: ticket.seatingType,
        show: ticket.show,
        tickets: [],
      };
    }

    acc[ticket.scheduleId].tickets.push(ticket);
    return acc;
  }, {});

  return Object.values(groupedBySchedule);
};

export const markTicketAsSold = async ({ distributorId, scheduleId, controlNumbers, customerName, email, isIncluded }) => {
  await prisma.$transaction(async (tx) => {
    // Update ticket status
    const updatedTickets = await tx.ticket.findMany({
      where: {
        distributorId,
        scheduleId,
        controlNumber: { in: controlNumbers },
      },
      select: {
        ticketId: true,
      },
    });

    if (updatedTickets.length === 0) {
      throw new AppError("No tickets found to mark as sold");
    }

    const updateData = {
      status: "sold",
    };

    if (isIncluded) {
      updateData.customerName = customerName;
      updateData.customerEmail = email;
    }

    await tx.ticket.updateMany({
      where: {
        ticketId: { in: updatedTickets.map((t) => t.ticketId) },
      },
      data: updateData,
    });

    // Update seat status for controlled seating
    await tx.showseats.updateMany({
      where: {
        scheduleId,
        ticketId: { in: updatedTickets.map((t) => t.ticketId) },
      },
      data: {
        status: "sold", // mark seat as sold
      },
    });

    // Optional: Send notification to trainer here
  });
};

export const markTicketAsUnSold = async ({ distributorId, scheduleId, controlNumbers }) => {
  await prisma.$transaction(async (tx) => {
    // Find tickets first
    const tickets = await tx.ticket.findMany({
      where: {
        distributorId,
        scheduleId,
        controlNumber: { in: controlNumbers },
      },
      select: { ticketId: true },
    });

    if (tickets.length === 0) {
      throw new Error("No tickets found to mark as unsold");
    }

    // Update ticket status
    await tx.ticket.updateMany({
      where: { ticketId: { in: tickets.map((t) => t.ticketId) } },
      data: {
        status: "allocated",
        customerEmail: null,
        customerName: null,
      },
    });

    // Update seat status for controlled seating
    await tx.showseats.updateMany({
      where: {
        scheduleId,
        ticketId: { in: tickets.map((t) => t.ticketId) },
      },
      data: {
        status: "reserved", // mark seat as reserved
      },
    });

    // Optional: send notification to the trainer
  });
};
