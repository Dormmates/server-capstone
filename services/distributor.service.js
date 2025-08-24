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
      isRemitted: t.ticket.remittedtickets.length !== 0,
      dateAllocated: data.dateAllocated,
      allocatedBy: data.users_allocationlog_allocatedByTousers,
      distributor: data.users_allocationlog_distributorIdTousers,
    }))
  );

  return mapped;
};

export const getDistributorRemittanceHistory = ({ distributor, scheduleId }) => {};
export const getDistributorAllocationHistory = ({ distributor, scheduleId }) => {};
