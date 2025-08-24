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
  const log = await prisma.allocationlog.findMany({
    where: { scheduleId, distributorId },
    include: {
      users_allocationlog_allocatedByTousers: {
        select: {
          firstName: true,
          lastName: true,
          userId: true,
        },
      },
      users_allocationlog_distributorIdTousers: {
        select: {
          firstName: true,
          lastName: true,
          userId: true,
        },
      },
      allocatedtickets: {
        select: {
          ticket: {
            select: {
              remittedtickets: {
                select: {
                  remittanceId: true,
                },
              },
              ticketId: true,
              status: true,
              ticketPrice: true,
              controlNumber: true,
              seatNumber: true,
              ticketSection: true,
            },
          },
        },
        orderBy: { ticket: { controlNumber: "asc" } },
      },
    },
  });

  const mapped = log.flatMap((data) =>
    data.allocatedtickets.map((t) => ({
      ticketId: t.ticket.ticketId,
      status: t.ticket.status,
      ticketPrice: t.ticket.ticketPrice,
      controlNumber: t.ticket.controlNumber,
      seatNumber: t.ticket.seatNumber,
      ticketSection: t.ticket.ticketSection,
      isRemitted: t.ticket.remittedtickets.length !== 0,
      dateAllocated: data.dateAllocated,
      allocatedBy: data.users_allocationlog_allocatedByTousers,
      distributor: data.users_allocationlog_distributorIdTousers,
    }))
  );

  return mapped;
};

export const getDistributorRemittanceHistory = async ({ distributorId, scheduleId }) => {
  const remittanceHistory = await prisma.remittancehistory.findMany({
    where: { remittedBy: distributorId, scheduleId },
    select: {
      users_remittancehistory_receivedByTousers: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      dateRemitted: true,
      totalRemittance: true,
      commission: true,
      remarks: true,
      remittanceId: true,
      remittedtickets: {
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
    receivedBy: log.users_remittancehistory_receivedByTousers.firstName + " " + log.users_remittancehistory_receivedByTousers.lastName,
    dateRemitted: log.dateRemitted,
    totalRemittance: log.totalRemittance,
    commission: log.commission,
    remarks: log.remarks,
    tickets: log.remittedtickets.map((rt) => ({
      controlNumber: rt.ticket.controlNumber,
      ticketPrice: rt.ticket.ticketPrice,
      status: rt.ticket.status,
    })),
  }));

  return grouped;
};

export const getDistributorAllocationHistory = async ({ distributorId, scheduleId }) => {
  const allocationHistory = await prisma.allocationlog.findMany({
    where: { distributorId, scheduleId },
    select: {
      allocationLogId: true,
      users_allocationlog_allocatedByTousers: {
        select: {
          firstName: true,
          lastName: true,
          userId: true,
        },
      },
      users_allocationlog_distributorIdTousers: {
        select: {
          firstName: true,
          lastName: true,
          userId: true,
        },
      },
      dateAllocated: true,
      allocatedtickets: {
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
    allocationLogId: log.allocationLogId,
    allocatedBy: log.users_allocationlog_allocatedByTousers,
    distributor: log.users_allocationlog_distributorIdTousers,
    dateAllocated: log.dateAllocated,
    tickets: log.allocatedtickets.map((at) => ({
      ticketId: at.ticket.ticketId,
      ticketPrice: at.ticket.ticketPrice,
      controlNumber: at.ticket.controlNumber,
    })),
  }));

  return grouped;
};
