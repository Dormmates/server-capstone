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
  deleteSchedule,
  generateScheduleTicketsAndSeats,
  getScheduleDetails,
  getScheduleDistributors,
  getScheduleSeatMap,
  getScheduleSummary,
  getScheduleTickets,
  getShowSchedules,
  getTallyData,
  openSchedule,
  remitTicketSales,
  reschedule,
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
      const { commissionFee, contactNumber, facebookLink, controlNumbers, seatPricing, seats, ticketPrice } = req.body;

      console.log(ticketPrice);
      console.log(seatPricing);

      const formattedDates = convertDates(dates);

      await prisma.$transaction(async (tx) => {
        const createdSchedules = await addShowSchedule({
          dates: formattedDates,
          showId,
          seatingType: seatingConfiguration,
          ticketType,
          commissionFee,
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
            ticketPrice,
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
  res.json({ message: "Closed Schedule" });
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
  res.json({ message: "Closed Schedule" });
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

export const getScheduleDistributorsController = asyncHandler(async (req, res, next) => {
  const { scheduleId } = req.params;

  if (!scheduleId) {
    throw new AppError("Missing Post Fields", HttpStatusCodes.BadRequest);
  }

  const distributors = await getScheduleDistributors(scheduleId);
  res.json(distributors);
});

export const allocateTicketController = asyncHandler(async (req, res, next) => {
  const { distributorId, scheduleId, controlNumbers, allocatedBy } = req.body;

  if (!distributorId || !scheduleId || !controlNumbers || !allocatedBy) {
    throw new AppError("Missing Post Fields", HttpStatusCodes.BadRequest);
  }

  const response = await allocateTicket({ scheduleId, distributorId, allocatedBy, controlNumbers });
  res.json(response);
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
  const { scheduleId, controlNumbers, distributorId, customerName, email, isIncluded } = req.body;

  if (!scheduleId || !distributorId || !controlNumbers) {
    throw new AppError("Missing Post Fields", HttpStatusCodes.BadRequest);
  }

  await markTicketAsSold({ scheduleId, controlNumbers, distributorId });
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
