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
        select: { seatNumber: true },
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
  const remittanceHistory = await prisma.ticketactionlog.findMany({
    where: { distributorId, scheduleId, actionType: "remit" },
    select: {
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
      logtickets: {
        select: {
          ticket: {
            select: {
              controlNumber: true,
              ticketPrice: true,
              status: true,
            },
          },
        },
      },
    },
  });

  const grouped = remittanceHistory.map((log) => ({
    remittanceId: log.remittanceId,
    receivedBy: log.users_ticketactionlog_actionByTousers.firstName + " " + log.users_ticketactionlog_actionByTousers.lastName,
    dateRemitted: log.actionDate,
    totalRemittance: log.totalRemittance,
    commission: log.commision,
    remarks: log.remarks,
    tickets: log.logtickets.map((rt) => ({
      controlNumber: rt.ticket.controlNumber,
      ticketPrice: rt.ticket.ticketPrice,
      status: rt.ticket.status,
    })),
  }));

  return grouped;
};

export const getDistributorAllocationHistory = async ({ distributorId, scheduleId }) => {
  const allocationHistory = await prisma.ticketactionlog.findMany({
    where: { distributorId, scheduleId, actionType: { in: ["allocate", "unallocate"] } },
    select: {
      actionType: true,
      actionLogId: true,
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
        orderBy: {
          ticket: {
            controlNumber: "asc",
          },
        },
      },
    },
    orderBy: {
      actionDate: "desc",
    },
  });

  const grouped = allocationHistory.map((log) => ({
    actionType: log.actionType,
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
        isArchived: false,
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
          commissionFee: true,
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
      commissionFee: ticket.showschedules?.commissionFee ?? null,
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
    const updateData = {
      status: "sold",
    };

    if (isIncluded) {
      updateData.customerName = customerName;
      updateData.customerEmail = email;
    }

    await tx.ticket.updateMany({
      where: {
        distributorId,
        scheduleId,
        controlNumber: {
          in: controlNumbers,
        },
      },
      data: updateData,
    });
  });
  //should also send notification to the trainer
};

export const markTicketAsUnSold = async ({ distributorId, scheduleId, controlNumbers }) => {
  await prisma.$transaction(async (tx) => {
    tx.ticket.updateMany({
      where: {
        distributorId,
        scheduleId,
        controlNumber: {
          in: controlNumbers,
        },
      },
      data: {
        status: "allocated",
        customerEmail: null,
        customerName: null,
      },
    });

    //should also send notification to the trainer
  });
};
