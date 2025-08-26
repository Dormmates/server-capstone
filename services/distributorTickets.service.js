import prisma from "../utils/primsa.connection.js";

export const getDistributorAllocatedTickets = async ({ distributorId, scheduleId }) => {
  const allocatedTickets = await prisma.ticket.findMany({
    where: {
      distributorId,
      scheduleId,
      status: "allocated",
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
    const remittedLog = ticket.logtickets.find((lt) => lt.ticketactionlog.actionType === "remit");

    return {
      ticketId: ticket.ticketId,
      status: ticket.status,
      ticketPrice: ticket.ticketPrice,
      controlNumber: ticket.controlNumber,
      seatNumber: ticket.showseats[0]?.seatNumber ?? null,
      ticketSection: ticket.ticketSection,
      isRemitted: !!remittedLog,
      dateAllocated: allocationLog?.ticketactionlog.actionDate ?? null,
      allocatedBy: allocationLog?.ticketactionlog.actionBy ?? null,
      distributor:
        allocationLog?.ticketactionlog.users_ticketactionlog_distributorIdTousers.firstName +
          " " +
          allocationLog?.ticketactionlog.users_ticketactionlog_distributorIdTousers.lastName ?? null,
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
