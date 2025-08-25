import prisma from "../utils/primsa.connection.js";

export const getDistributorTicketsSummary = async ({ distributorId, scheduleId }) => {
  const allocatedTickets = await prisma.allocatedtickets.findMany({
    where: {
      allocationlog: {
        distributorId,
        scheduleId,
      },
    },
    include: {
      ticket: {
        select: {
          ticketId: true,
          status: true,
          ticketPrice: true,
          controlNumber: true,
          remittedtickets: {
            select: {
              remittanceId: true,
            },
          },
        },
      },
    },
    orderBy: {
      ticket: {
        controlNumber: "asc",
      },
    },
  });

  return allocatedTickets;
};

export const getDistributorAllocatedTickets = async ({ distributorId, scheduleId }) => {
  const log = await prisma.ticketactionlog.findMany({
    where: { scheduleId, distributorId, actionType: "allocate" },
    include: {
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
      logtickets: {
        select: {
          ticket: {
            select: {
              logtickets: {
                where: {
                  ticketactionlog: {
                    actionType: "remit",
                  },
                },
              },
              ticketId: true,
              status: true,
              ticketPrice: true,
              controlNumber: true,
              showseats: {
                select: {
                  seatNumber: true,
                  ticketId: true,
                },
              },
              ticketSection: true,
            },
          },
        },
        orderBy: { ticket: { controlNumber: "asc" } },
      },
    },
  });

  const mapped = log.flatMap((data) =>
    data.logtickets.map((t) => ({
      ticketId: t.ticket.ticketId,
      status: t.ticket.status,
      ticketPrice: t.ticket.ticketPrice,
      controlNumber: t.ticket.controlNumber,
      seatNumber: t.ticket.showseats.find((seat) => seat.ticketId === t.ticket.ticketId).seatNumber,
      ticketSection: t.ticket.ticketSection,
      isRemitted: t.ticket.logtickets.length !== 0,
      dateAllocated: data.dateAllocated,
      allocatedBy: data.users_ticketactionlog_actionByTousers,
      distributor: data.users_ticketactionlog_distributorIdTousers,
    }))
  );

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
    where: { distributorId, scheduleId, actionType: "allocate" },
    select: {
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
  });

  const grouped = allocationHistory.map((log) => ({
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
