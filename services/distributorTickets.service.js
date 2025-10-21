import { AppError } from "../middleware/errorHandler.middleware.js";
import prisma from "../utils/primsa.connection.js";
import { pusher } from "../utils/pusher.instance.js";
import { DistributorNotification, sendDistributorActivityNotification } from "../utils/sendNotification.js";

// Get allocated tickets for a distributor
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
      seats: { select: { seatNumber: true, seatSection: true }, take: 1 },
      status: true,
      logs: {
        select: {
          action: {
            select: {
              actionType: true,
              actionBy: true,
              distributorId: true,
              actionDate: true,
              distributor: { select: { firstName: true, lastName: true } },
            },
          },
        },
      },
    },
    orderBy: { controlNumber: "asc" },
  });

  return allocatedTickets.map((ticket) => {
    const allocationLog = ticket.logs.find((lt) => lt.action.actionType === "allocate");

    return {
      ticketId: ticket.ticketId,
      status: ticket.status,
      ticketPrice: ticket.ticketPrice,
      controlNumber: ticket.controlNumber,
      seatNumber: ticket.seats[0]?.seatNumber ?? null,
      ticketSection: ticket.ticketSection,
      seatSection: ticket.seats[0]?.seatSection ?? null,
      dateAllocated: allocationLog?.action.actionDate ?? null,
      allocatedBy: allocationLog?.action.actionBy ?? null,
      isRemitted: ["lost", "remitted"].includes(ticket.status),
      distributor: allocationLog?.action.distributor
        ? `${allocationLog.action.distributor.firstName} ${allocationLog.action.distributor.lastName}`
        : null,
    };
  });
};

// Get remittance history for a distributor
export const getDistributorRemittanceHistory = async ({ distributorId, scheduleId }) => {
  const whereClause = {
    distributorId,
    actionType: { in: ["remit", "unremit"] },
    ...(scheduleId && { scheduleId }),
  };

  const remittanceHistory = await prisma.ticketActionLog.findMany({
    where: whereClause,
    select: {
      scheduleId: true,
      actionByUser: { select: { firstName: true, lastName: true } },
      actionDate: true,
      totalRemittance: true,
      commission: true,
      remarks: true,
      actionLogId: true,
      actionType: true,
      schedule: {
        select: {
          datetime: true,
          seatingType: true,
          ticketPricing: { select: { commissionFee: true } },
          show: { select: { showCover: true, title: true, showId: true } },
        },
      },
      logs: {
        select: {
          ticket: {
            select: {
              controlNumber: true,
              ticketPrice: true,
              status: true,
              discountPercentage: true,
              seats: { select: { seatSection: true }, take: 1 },
            },
          },
        },
      },
    },
    orderBy: { actionDate: "desc" },
  });

  return remittanceHistory.map((log) => {
    const tickets = log.logs.map((rt) => ({
      controlNumber: rt.ticket.controlNumber,
      ticketPrice: Number(rt.ticket.ticketPrice || 0),
      discountPercentage: Number(rt.ticket.discountPercentage || 0),
      status: rt.ticket.status,
      seatSection: rt.ticket.seats[0]?.seatSection ?? null,
    }));

    const commissionFee = Number(log.schedule.ticketPricing?.commissionFee || 0);
    const totalCommission = tickets.length * commissionFee;
    const totalRemittance = tickets.reduce((acc, t) => {
      const discount = t.discountPercentage ? (t.ticketPrice * t.discountPercentage) / 100 : 0;
      return acc + (t.ticketPrice - discount - commissionFee);
    }, 0);

    return {
      showId: log.schedule.show.showId,
      seatingType: log.schedule.seatingType,
      showCover: log.schedule.show.showCover,
      showTitle: log.schedule.show.title,
      showDate: log.schedule.datetime,
      remittanceId: log.actionLogId,
      scheduleId: log.scheduleId,
      actionType: log.actionType,
      receivedBy: `${log.actionByUser.firstName} ${log.actionByUser.lastName}`,
      dateRemitted: log.actionDate,
      remarks: log.remarks,
      tickets,
      totalCommission,
      totalRemittance,
    };
  });
};

// Get allocation/unallocation history
export const getDistributorAllocationHistory = async ({ distributorId, scheduleId }) => {
  const whereClause = {
    distributorId,
    actionType: { in: ["allocate", "unallocate"] },
    ...(scheduleId && { scheduleId }),
  };

  const allocationHistory = await prisma.ticketActionLog.findMany({
    where: whereClause,
    select: {
      scheduleId: true,
      actionType: true,
      actionLogId: true,
      schedule: { select: { datetime: true, show: { select: { showId: true, showCover: true, title: true } } } },
      actionByUser: { select: { firstName: true, lastName: true, userId: true } },
      distributor: { select: { firstName: true, lastName: true, userId: true } },
      remarks: true,
      actionDate: true,
      logs: { select: { ticket: { select: { ticketId: true, ticketPrice: true, controlNumber: true } } } },
    },
    orderBy: { actionDate: "desc" },
  });

  return allocationHistory.map((log) => ({
    showId: log.schedule.show.showId,
    showCover: log.schedule.show.showCover,
    showTitle: log.schedule.show.title,
    showDate: log.schedule.datetime,
    scheduleId: log.scheduleId,
    actionType: log.actionType,
    remarks: log.remarks,
    allocationLogId: log.actionLogId,
    allocatedBy: log.actionByUser,
    distributor: log.distributor,
    dateAllocated: log.actionDate,
    tickets: log.logs.map((at) => ({
      ticketId: at.ticket.ticketId,
      ticketPrice: at.ticket.ticketPrice,
      controlNumber: at.ticket.controlNumber,
    })),
  }));
};

// Get distributor's shows with allocated tickets
export const getDistributorShowsAndTicketsAllocated = async ({ distributorId }) => {
  const allocatedTickets = await prisma.ticket.findMany({
    where: {
      distributorId,
      schedule: { isOpen: true, show: { isArchived: false } },
    },
    select: {
      ticketId: true,
      controlNumber: true,
      ticketPrice: true,
      seats: { select: { seatNumber: true, seatSection: true }, take: 1 },
      status: true,
      logs: { select: { action: { select: { actionType: true, actionBy: true, actionDate: true } } } },
      schedule: {
        select: {
          datetime: true,
          ticketPricing: { select: { commissionFee: true } },
          scheduleId: true,
          seatingType: true,
          show: { select: { showCover: true, showId: true, title: true } },
        },
      },
    },
    orderBy: { controlNumber: "asc" },
  });

  const mappedTickets = allocatedTickets.map((ticket) => {
    const allocationLog = ticket.logs.find((lt) => lt.action.actionType === "allocate");

    return {
      scheduleId: ticket.schedule?.scheduleId ?? null,
      datetime: ticket.schedule?.datetime ?? null,
      commissionFee: ticket.schedule?.ticketPricing?.commissionFee ?? null,
      seatingType: ticket.schedule?.seatingType ?? null,
      show: ticket.schedule?.show ?? null,
      ticketId: ticket.ticketId,
      status: ticket.status,
      ticketPrice: ticket.ticketPrice,
      controlNumber: ticket.controlNumber,
      seatNumber: ticket.seats[0]?.seatNumber ?? null,
      ticketSection: ticket.seats[0]?.seatSection ?? null,
      isRemitted: ["lost", "remitted"].includes(ticket.status),
      dateAllocated: allocationLog?.action.actionDate ?? null,
      allocatedBy: allocationLog?.action.actionBy ?? null,
    };
  });

  return Object.values(
    mappedTickets.reduce((acc, ticket) => {
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
    }, {})
  );
};

// Mark tickets as sold
export const markTicketAsSold = async ({ distributorId, scheduleId, controlNumbers, customerName = null, email = null }) => {
  const result = await prisma.$transaction(async (tx) => {
    const ticketsToUpdate = await tx.ticket.findMany({
      where: { distributorId, scheduleId, controlNumber: { in: controlNumbers } },
      select: { ticketId: true, controlNumber: true },
    });

    if (!ticketsToUpdate.length) throw new AppError("No tickets found to mark as sold");

    await tx.ticket.updateMany({
      where: { ticketId: { in: ticketsToUpdate.map((t) => t.ticketId) } },
      data: {
        status: "sold",
        customerName,
        customerEmail: email,
      },
    });

    await tx.showSeat.updateMany({
      where: { scheduleId, ticketId: { in: ticketsToUpdate.map((t) => t.ticketId) } },
      data: { status: "sold" },
    });

    await tx.ticketActionLog.create({
      data: {
        actionLogId: crypto.randomUUID(),
        scheduleId,
        distributorId,
        actionBy: distributorId,
        actionDate: new Date(),
        actionType: "soldTicket",
        logs: {
          create: ticketsToUpdate.map((ticket) => ({
            ticketId: ticket.ticketId,
          })),
        },
        metaData: ticketsToUpdate.map((ticket) => ({
          ticketId: ticket.ticketId,
          controlNumber: ticket.controlNumber,
          customerName,
          customerEmail: email,
        })),
      },
    });

    return ticketsToUpdate;
  });

  if (result) {
    const customerMetaData = [
      {
        customerName: customerName || "No Customer Info",
        customerEmail: email || null,
      },
    ];

    sendDistributorActivityNotification({
      actionBy: distributorId,
      distributorId,
      scheduleId,
      customerMetaData,
      totalTickets: result.length,
      action: DistributorNotification.SOLD,
    });
  }
};

export const markTicketAsUnSold = async ({ distributorId, scheduleId, controlNumbers }) => {
  const result = await prisma.$transaction(async (tx) => {
    const ticketsToUpdate = await tx.ticket.findMany({
      where: { distributorId, scheduleId, controlNumber: { in: controlNumbers } },
      select: { ticketId: true, customerEmail: true, customerName: true, controlNumber: true },
    });

    if (!ticketsToUpdate.length) throw new AppError("No tickets found to mark as unsold");

    await tx.ticket.updateMany({
      where: { ticketId: { in: ticketsToUpdate.map((t) => t.ticketId) } },
      data: { status: "allocated", customerEmail: null, customerName: null },
    });

    await tx.showSeat.updateMany({
      where: { scheduleId, ticketId: { in: ticketsToUpdate.map((t) => t.ticketId) } },
      data: { status: "reserved" },
    });

    const unsoldMeta = ticketsToUpdate.map((t) => ({
      ticketId: t.ticketId,
      controlNumber: t.controlNumber,
      previousCustomerName: t.customerName,
      previousCustomerEmail: t.customerEmail,
      actionByDistributorId: distributorId,
    }));

    await tx.ticketActionLog.create({
      data: {
        actionLogId: crypto.randomUUID(),
        scheduleId,
        distributorId,
        actionBy: distributorId,
        actionDate: new Date(),
        actionType: "unsoldTicket",
        logs: {
          create: ticketsToUpdate.map((ticket) => ({
            ticketId: ticket.ticketId,
          })),
        },
        metaData: unsoldMeta,
      },
    });

    return ticketsToUpdate;
  });

  if (result) {
    const customerMetaData = result
      .filter((t) => t.customerName || t.customerEmail)
      .map((t) => ({
        customerName: t.customerName || "No Customer Info",
        customerEmail: t.customerEmail || null,
      }));

    sendDistributorActivityNotification({
      actionBy: distributorId,
      distributorId,
      scheduleId,
      customerMetaData,
      totalTickets: result.length,
      action: DistributorNotification.UNSOLD,
    });
  }
};
