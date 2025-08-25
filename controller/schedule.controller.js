import { asyncHandler } from "../middleware/asyncHandler.middleware.js";
import { AppError, HttpStatusCodes } from "../middleware/errorHandler.middleware.js";
import {
  getDistributorAllocatedTickets,
  getDistributorAllocationHistory,
  getDistributorRemittanceHistory,
} from "../services/distributorTickets.service.js";
import {
  addShowSchedule,
  allocateTicket,
  generateScheduleTicketsAndSeats,
  getScheduleDetails,
  getScheduleDistributors,
  getScheduleSeatMap,
  getScheduleSummary,
  getScheduleTickets,
  getShowSchedules,
  unallocateTicket,
} from "../services/schedule.service.js";
import { doesShowExist } from "../services/show.service.js";
import { convertDates } from "../utils/convert.utils.js";
import prisma from "../utils/primsa.connection.js";

export const getShowSchedulesController = asyncHandler(async (req, res) => {
  const { showId } = req.query;

  const exists = doesShowExist(showId);

  if (!exists) {
    throw new AppError("Show Not Found", HttpStatusCodes.NotFound);
  }

  const schedules = await getShowSchedules(showId);

  res.json(schedules);
});

export const addShowScheduleController = asyncHandler(async (req, res) => {
  const { ticketType, showId, dates, seatingConfiguration } = req.body;

  switch (ticketType) {
    case "ticketed": {
      const { commissionFee, contactNumber, facebookLink, controlNumbers, seatPricing, seats, ticketPrice } = req.body;

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

export const getScheduleInfoController = asyncHandler(async (req, res, next) => {
  const { scheduleId } = req.params;
  const details = await getScheduleDetails(scheduleId);
  res.json(details);
});

export const getScheudleSummaryController = asyncHandler(async (req, res, nexr) => {
  const { scheduleId } = req.params;
  const summary = await getScheduleSummary(scheduleId);

  res.json(summary);
});

export const getScheduleTicketsController = asyncHandler(async (req, res, next) => {
  const { scheduleId } = req.params;
  const tickets = await getScheduleTickets(scheduleId);
  res.json(tickets);
});

export const getScheduleDistributorsController = asyncHandler(async (req, res, next) => {
  const { scheduleId } = req.params;
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
  const seatMap = await getScheduleSeatMap(scheduleId);
  res.json(seatMap);
});

export const getTicketsAllocatedOfDistributorController = asyncHandler(async (req, res, next) => {
  const { scheduleId, distributorId } = req.params;
  const data = await getDistributorAllocatedTickets({ distributorId, scheduleId });
  res.json(data);
});

export const getDistributorAllocationHistoryController = asyncHandler(async (req, res, next) => {
  const { scheduleId, distributorId } = req.params;
  const data = await getDistributorAllocationHistory({ distributorId, scheduleId });

  res.json(data);
});

export const getDistributorRemittanceHistoryController = asyncHandler(async (req, res, next) => {
  const { scheduleId, distributorId } = req.params;
  const data = await getDistributorRemittanceHistory({ distributorId, scheduleId });
  res.json(data);
});

export const getDistributorTicketsSummaryController = asyncHandler(async (req, res, next) => {
  const { scheduleId, distributorId } = req.params;
  const data = await getDistributorTicketsSummary({ distributorId, scheduleId });
  res.json(data);
});
