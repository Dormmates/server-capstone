import { asyncHandler } from "../middleware/asyncHandler.middleware.js";
import { AppError, HttpStatusCodes } from "../middleware/errorHandler.middleware.js";
import {
  getDistributorAllocatedTickets,
  getDistributorAllocationHistory,
  getDistributorRemittanceHistory,
  markTicketAsSold,
  markTicketAsUnSold,
} from "../services/distributorTickets.service.js";
import {
  addShowSchedule,
  addTallyData,
  allocateTicket,
  closeSchedule,
  copySchedule,
  deleteSchedule,
  generateScheduleTicketsAndSeats,
  generateTicketInformations,
  getDistributorsForTicketAllocation,
  getDistributorTicketActivities,
  getScheduleDetails,
  getScheduleDistributors,
  getScheduleSeatMap,
  getScheduleSummary,
  getScheduleTickets,
  getShowSchedules,
  getTallyData,
  getTicketLogs,
  getUnallocatedTickets,
  openSchedule,
  remitTicketSales,
  reschedule,
  transferTicket,
  unallocateTicket,
  unremitTicketSales,
} from "../services/schedule.service.js";
import { doesShowExist } from "../services/show.service.js";
import { convertDates } from "../utils/convert.utils.js";
import prisma from "../utils/primsa.connection.js";

export const getShowSchedulesController = asyncHandler(async (req, res) => {
  const { showId, excludeClosed, excludeReservationOff } = req.query;

  const exists = doesShowExist(showId);

  if (!exists) {
    throw new AppError("Show Not Found", HttpStatusCodes.NotFound);
  }

  const schedules = await getShowSchedules({ showId, excludeReservationOff, excludeClosed });

  res.json(schedules);
});

export const addShowScheduleController = asyncHandler(async (req, res) => {
  const { ticketType, showId, dates, seatingConfiguration } = req.body;

  switch (ticketType) {
    case "ticketed": {
      const { ticketPricing, contactNumber, facebookLink, controlNumbers, seatPricing, seats } = req.body;

      const formattedDates = convertDates(dates);

      await prisma.$transaction(async (tx) => {
        const createdSchedules = await addShowSchedule({
          dates: formattedDates,
          showId,
          seatingType: seatingConfiguration,
          ticketType,
          ticketPricing,
          contactNumber,
          facebookLink,
          tx,
        });

        for (const sched of createdSchedules) {
          await generateScheduleTicketsAndSeats({
            tx,
            scheduleId: sched.scheduleId,
            seatPricing,
            seats,
            ticketPricing,
            controlNumbers,
            seatingConfiguration,
          });
        }
      });

      res.status(HttpStatusCodes.OK).json({ message: "Added Schedules" });
      break;
    }

    case "nonTicketed": {
      await addShowSchedule({
        dates: convertDates(dates),
        showId,
        seatingType: seatingConfiguration,
        ticketType,
      });

      res.status(HttpStatusCodes.OK).json({ message: "Added Schedules" });
      break;
    }

    default:
      throw new AppError("Invalid Ticket Type Value", HttpStatusCodes.BadRequest);
  }
});

export const closeScheduleController = asyncHandler(async (req, res, next) => {
  const { scheduleId } = req.body;

  if (!scheduleId) {
    throw new AppError("Missing Post Fields", HttpStatusCodes.BadRequest);
  }

  await closeSchedule(scheduleId);
  res.json({ message: "Closed Schedule" });
});

export const openScheduleController = asyncHandler(async (req, res, next) => {
  const { scheduleId } = req.body;

  if (!scheduleId) {
    throw new AppError("Missing Post Fields", HttpStatusCodes.BadRequest);
  }

  await openSchedule(scheduleId);
  res.json({ message: "Opened Schedule" });
});

export const deleteScheduleController = asyncHandler(async (req, res, next) => {
  const { scheduleId } = req.body;

  if (!scheduleId) {
    throw new AppError("Missing Post Fields", HttpStatusCodes.BadRequest);
  }

  await deleteSchedule(scheduleId);
  res.json({ message: "Closed Schedule" });
});

export const rescheduleController = asyncHandler(async (req, res, next) => {
  const { scheduleId, newDateTime } = req.body;

  if (!scheduleId) {
    throw new AppError("Missing Post Fields", HttpStatusCodes.BadRequest);
  }

  await reschedule({ scheduleId, newDateTime });
  res.json({ message: "ReSchedule" });
});

export const copyScheduleController = asyncHandler(async (req, res, next) => {
  const { scheduleId, newDateTime } = req.body;

  if (!scheduleId || !newDateTime) {
    throw new AppError("Missing Post Fields", HttpStatusCodes.BadRequest);
  }

  const copiedSchedule = await copySchedule({ scheduleId, newDateTime });
  res.json(copiedSchedule);
});

export const getScheduleInfoController = asyncHandler(async (req, res, next) => {
  const { scheduleId } = req.params;

  if (!scheduleId) {
    throw new AppError("Missing Post Fields", HttpStatusCodes.BadRequest);
  }

  const details = await getScheduleDetails(scheduleId);

  res.json(details);
});

export const getScheudleSummaryController = asyncHandler(async (req, res, nexr) => {
  const { scheduleId } = req.params;

  if (!scheduleId) {
    throw new AppError("Missing Post Fields", HttpStatusCodes.BadRequest);
  }

  const summary = await getScheduleSummary(scheduleId);
  res.json(summary);
});

export const getScheduleTicketsController = asyncHandler(async (req, res, next) => {
  const { scheduleId } = req.params;

  if (!scheduleId) {
    throw new AppError("Missing Post Fields", HttpStatusCodes.BadRequest);
  }

  const tickets = await getScheduleTickets(scheduleId);
  res.json(tickets);
});

export const getTicketLogsController = asyncHandler(async (req, res) => {
  const { scheduleId, controlNumber } = req.params;

  if (!scheduleId || !controlNumber) {
    throw new AppError("Missing Post Fields", HttpStatusCodes.BadRequest);
  }

  const logs = await getTicketLogs(scheduleId, controlNumber);
  res.json(logs);
});

export const generateTicketInformationsController = asyncHandler(async (req, res) => {
  const { scheduleId } = req.params;

  if (!scheduleId) {
    throw new AppError("Missing Post Fields", HttpStatusCodes.BadRequest);
  }

  const result = await generateTicketInformations(scheduleId);
  res.json(result);
});

export const getScheduleDistributorsController = asyncHandler(async (req, res, next) => {
  const { scheduleId } = req.params;

  if (!scheduleId) {
    throw new AppError("Missing Post Fields", HttpStatusCodes.BadRequest);
  }

  const distributors = await getScheduleDistributors(scheduleId);
  res.json(distributors);
});

export const getDistributorsForTicketAllocationController = asyncHandler(async (req, res) => {
  const { scheduleId } = req.params;
  const { departmentId } = req.query;

  if (!scheduleId) {
    throw new AppError("Missing Post Fields", HttpStatusCodes.BadRequest);
  }

  const result = await getDistributorsForTicketAllocation({ scheduleId, departmentId });
  res.json(result);
});

export const allocateTicketController = asyncHandler(async (req, res, next) => {
  const { distributorId, scheduleId, controlNumbers, allocatedBy } = req.body;

  if (!distributorId || !scheduleId || !controlNumbers || !allocatedBy) {
    throw new AppError("Missing Post Fields", HttpStatusCodes.BadRequest);
  }

  const response = await allocateTicket({ scheduleId, distributorId, allocatedBy, controlNumbers });

  res.json(response);
});

export const allocateTicketsToMultipleDistributorsController = asyncHandler(async (req, res) => {
  const { scheduleId, allocatedBy, allocations } = req.body;

  if (!scheduleId || !allocatedBy || !allocations || allocations.length === 0) {
    throw new AppError("Missing required fields", HttpStatusCodes.BadRequest);
  }

  const unallocatedTickets = await getUnallocatedTickets(scheduleId);

  const totalAvailable = unallocatedTickets.length;
  const totalRequested = allocations.reduce((sum, a) => sum + a.ticketCount, 0);

  if (totalRequested > totalAvailable) {
    throw new AppError(`Not enough tickets. Requested ${totalRequested}, but only ${totalAvailable} available.`, HttpStatusCodes.Conflict);
  }

  let currentIndex = 0;
  const results = [];

  for (const { distributorId, ticketCount, name } of allocations) {
    const controlNumbers = unallocatedTickets.slice(currentIndex, currentIndex + ticketCount).map((t) => t);

    if (controlNumbers.length === 0) {
      results.push({
        distributorId,
        name,
        allocatedCount: 0,
        success: false,
        message: "No available tickets to allocate",
      });
      continue;
    }

    try {
      const result = await allocateTicket({
        scheduleId,
        distributorId,
        allocatedBy,
        controlNumbers,
      });

      currentIndex += ticketCount;
      results.push({
        distributorId,
        name,
        allocatedCount: controlNumbers.length,
        success: true,
      });
    } catch (error) {
      results.push({
        distributorId,
        name,
        allocatedCount: 0,
        success: false,
      });
    }
  }

  res.status(200).json({
    success: true,
    message: "Ticket allocation process completed",
    results,
  });
});

export const unAllocateTicketController = asyncHandler(async (req, res, next) => {
  const { distributorId, scheduleId, controlNumbers, unallocatedBy } = req.body;

  if (!distributorId || !scheduleId || !controlNumbers || !unallocatedBy) {
    throw new AppError("Missing Post Fields", HttpStatusCodes.BadRequest);
  }

  const response = await unallocateTicket({ scheduleId, distributorId, unallocatedBy, controlNumbers });
  res.json(response);
});

export const getScheduleSeatMapController = asyncHandler(async (req, res, next) => {
  const { scheduleId } = req.params;

  if (!scheduleId) {
    throw new AppError("Missing Post Fields", HttpStatusCodes.BadRequest);
  }

  const seatMap = await getScheduleSeatMap(scheduleId);
  res.json(seatMap);
});

export const getTicketsAllocatedOfDistributorController = asyncHandler(async (req, res, next) => {
  const { scheduleId, distributorId } = req.params;

  if (!scheduleId || !distributorId) {
    throw new AppError("Missing Post Fields", HttpStatusCodes.BadRequest);
  }

  const data = await getDistributorAllocatedTickets({ distributorId, scheduleId });
  res.json(data);
});

export const getDistributorAllocationHistoryController = asyncHandler(async (req, res, next) => {
  const { scheduleId, distributorId } = req.params;
  const data = await getDistributorAllocationHistory({ distributorId, scheduleId });

  res.json(data);
});

export const getAllDistributorAllocationHistoryController = asyncHandler(async (req, res, next) => {
  const { distributorId } = req.params;
  const data = await getDistributorAllocationHistory({ distributorId, scheduleId: null });

  res.json(data);
});

export const getDistributorRemittanceHistoryController = asyncHandler(async (req, res, next) => {
  const { scheduleId, distributorId } = req.params;

  if (!scheduleId || !distributorId) {
    throw new AppError("Missing Post Fields", HttpStatusCodes.BadRequest);
  }

  const data = await getDistributorRemittanceHistory({ distributorId, scheduleId });
  res.json(data);
});

export const getAllDistributorRemittanceHistoryController = asyncHandler(async (req, res, next) => {
  const { distributorId } = req.params;

  if (!distributorId) {
    throw new AppError("Missing Post Fields", HttpStatusCodes.BadRequest);
  }

  const data = await getDistributorRemittanceHistory({ distributorId, scheduleId: null });
  res.json(data);
});

export const getDistributorTicketsSummaryController = asyncHandler(async (req, res, next) => {
  const { scheduleId, distributorId } = req.params;

  if (!scheduleId || !distributorId) {
    throw new AppError("Missing Post Fields", HttpStatusCodes.BadRequest);
  }

  const data = await getDistributorTicketsSummary({ distributorId, scheduleId });
  res.json(data);
});

export const markTicketAsSoldController = asyncHandler(async (req, res, next) => {
  const { scheduleId, controlNumbers, distributorId, customerName, email } = req.body;

  if (!scheduleId || !distributorId || !controlNumbers) {
    throw new AppError("Missing Post Fields", HttpStatusCodes.BadRequest);
  }

  await markTicketAsSold({ scheduleId, controlNumbers, distributorId, customerName, email });
  res.json({ message: "Marked as sold" });
});

export const markTicketAsUnSoldController = asyncHandler(async (req, res, next) => {
  const { scheduleId, controlNumbers, distributorId } = req.body;

  if (!scheduleId || !distributorId || !controlNumbers) {
    throw new AppError("Missing Post Fields", HttpStatusCodes.BadRequest);
  }

  await markTicketAsUnSold({ scheduleId, controlNumbers, distributorId });
  res.json({ message: "Marked as unsold" });
});

export const remitTicketSalesController = asyncHandler(async (req, res, next) => {
  const { sold, lost, discounted, discountPercentage, scheduleId, distributorId, actionBy, remarks } = req.body;

  if ((!sold || !lost || !scheduleId || !distributorId, !actionBy)) {
    throw new AppError("Missing Post Fields", HttpStatusCodes.BadRequest);
  }

  await remitTicketSales({ sold, lost, discounted, discountPercentage, scheduleId, distributorId, actionBy, remarks });
  res.json({ message: "Remitted" });
});

export const unRemitTicketSalesController = asyncHandler(async (req, res, next) => {
  const { remittedTickets, scheduleId, distributorId, actionBy, remarks } = req.body;

  if (!remittedTickets || !scheduleId || !distributorId || !actionBy) {
    throw new AppError("Missing Post Fields", HttpStatusCodes.BadRequest);
  }

  await unremitTicketSales({ remittedTickets, scheduleId, distributorId, actionBy, remarks });
  res.json({ message: "Unremitted" });
});

export const updateTallyDataController = asyncHandler(async (req, res, next) => {
  const { femaleCount, maleCount, scheduleId } = req.body;

  if (!femaleCount || !maleCount || !scheduleId) {
    throw new AppError("Missing Post Fields", HttpStatusCodes.BadRequest);
  }

  await addTallyData({ femaleCount: Number(femaleCount), maleCount: Number(maleCount), scheduleId });
  res.status(HttpStatusCodes.OK).json("Updated");
});

export const getTallyDataController = asyncHandler(async (req, res, next) => {
  const { scheduleId } = req.params;

  if (!scheduleId) {
    throw new AppError("Missing Query Fields", HttpStatusCodes.BadRequest);
  }

  const data = await getTallyData(scheduleId);
  res.json(data);
});

export const getDistributorTicketActivitiesController = asyncHandler(async (req, res) => {
  const { scheduleId } = req.params;

  if (!scheduleId) {
    throw new AppError("Missing Query Fields", HttpStatusCodes.BadRequest);
  }

  const logs = await getDistributorTicketActivities(scheduleId);
  res.json(logs);
});

export const transferTicketController = asyncHandler(async (req, res) => {
  const { reason, actionBy, scheduleId, controlNumber, newScheduleId, seatNumber } = req.body;

  if (!reason || !actionBy || !scheduleId || !controlNumber || !newScheduleId) {
    throw new AppError("Missing Query Fields", HttpStatusCodes.BadRequest);
  }

  await transferTicket({ reason, actionBy, scheduleId, controlNumber, newScheduleId, seatNumber });
  res.json({ message: "Ticket Transfered" });
});
