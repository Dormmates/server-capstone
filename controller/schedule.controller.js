import { asyncHandler } from "../middleware/asyncHandler.middleware.js";
import { AppError, HttpStatusCodes } from "../middleware/errorHandler.middleware.js";
import {
  getDistributorAllocatedTickets,
  getDistributorAllocationHistory,
  getDistributorPaymentHistory,
  markTicketAsSold,
  markTicketAsUnSold,
} from "../services/distributorTickets.service.js";
import {
  addShowSchedule,
  addTallyData,
  allocateTicket,
  allocateTicketsToDistributorsService,
  checkScheduleToBeClosed,
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
  getShowsWithAvailbleTicketTransfer,
  getTallyData,
  getTicketLogs,
  markTicketAsNotLost,
  openSchedule,
  payTicketSales,
  refundTicket,
  reschedule,
  trainerSellTicket,
  transferTicket,
  unallocateTicket,
  unPayTicketSales,
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

  if (!ticketType || !showId || !dates || !seatingConfiguration) {
    throw new AppError("Missing Post Fields");
  }

  switch (ticketType) {
    case "ticketed": {
      const { ticketPricing, contactNumber, facebookLink, controlNumbers, seatPricing, seats } = req.body;

      if (!ticketPricing) {
        throw new AppError("Missing Post Fields");
      }

      await prisma.$transaction(
        async (tx) => {
          const createdSchedules = await addShowSchedule({
            dates,
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
        },
        {
          timeout: 120_000,
        }
      );

      res.status(HttpStatusCodes.OK).json({ message: "Added Schedules" });
      break;
    }

    case "nonTicketed": {
      await addShowSchedule({
        dates,
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

  const results = await allocateTicketsToDistributorsService({ scheduleId, allocatedBy, allocations });

  res.status(200).json({ success: true, message: "Allocation completed", results });
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

export const getDistributorPaymentHistoryController = asyncHandler(async (req, res, next) => {
  const { scheduleId, distributorId } = req.params;

  if (!scheduleId || !distributorId) {
    throw new AppError("Missing Post Fields", HttpStatusCodes.BadRequest);
  }

  const data = await getDistributorPaymentHistory({ distributorId, scheduleId });
  res.json(data);
});

export const getAllDistributorPaymentHistoryController = asyncHandler(async (req, res, next) => {
  const { distributorId } = req.params;

  if (!distributorId) {
    throw new AppError("Missing Post Fields", HttpStatusCodes.BadRequest);
  }

  const data = await getDistributorPaymentHistory({ distributorId, scheduleId: null });
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

export const payTicketSalesController = asyncHandler(async (req, res, next) => {
  const { sold, lost, discounted, discountPercentage, scheduleId, distributorId, actionBy, remarks } = req.body;

  if ((!sold || !lost || !scheduleId || !distributorId, !actionBy)) {
    throw new AppError("Missing Post Fields", HttpStatusCodes.BadRequest);
  }

  await payTicketSales({ sold, lost, discounted, discountPercentage, scheduleId, distributorId, actionBy, remarks });
  res.json({ message: "Remitted" });
});

export const unPayTicketSalesController = asyncHandler(async (req, res, next) => {
  const { remittedTickets, scheduleId, distributorId, actionBy, remarks } = req.body;

  if (!remittedTickets || !scheduleId || !distributorId || !actionBy) {
    throw new AppError("Missing Post Fields", HttpStatusCodes.BadRequest);
  }

  await unPayTicketSales({ remittedTickets, scheduleId, distributorId, actionBy, remarks });
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
  const { remarks, trainerId, scheduleId, controlNumber, newScheduleId, newControlNumber } = req.body;

  console.log(req.body);

  if (!trainerId || !scheduleId || !controlNumber || !newScheduleId || !newControlNumber) {
    throw new AppError("Missing Query Fields", HttpStatusCodes.BadRequest);
  }

  await transferTicket({ remarks, trainerId, scheduleId, controlNumber, newScheduleId, newControlNumber });
  res.json({ message: "Ticket Transfered" });
});

export const trainerSellTicketController = asyncHandler(async (req, res) => {
  const { scheduleId, controlNumber, trainerId, customerName, customerEmail } = req.body;

  if (!scheduleId || !controlNumber || !trainerId) {
    throw new AppError("Missing Query Fields", HttpStatusCodes.BadRequest);
  }

  await trainerSellTicket(scheduleId, controlNumber, trainerId, customerName, customerEmail);
  res.json({ message: "Ticket Sold" });
});

export const refundTicketController = asyncHandler(async (req, res) => {
  const { scheduleId, controlNumber, trainerId, distributorId, remarks } = req.body;

  if (!scheduleId || !controlNumber || !trainerId || !distributorId) {
    throw new AppError("Missing Query Fields", HttpStatusCodes.BadRequest);
  }

  await refundTicket(scheduleId, controlNumber, trainerId, distributorId, remarks);
  res.json({ message: "Ticket Refunded" });
});

export const getShowsWithAvailbleTicketTransferController = asyncHandler(async (req, res) => {
  const { departmentId, scheduleId, showId } = req.query;

  const result = await getShowsWithAvailbleTicketTransfer({ showId, departmentId, scheduleId });
  res.json(result);
});

export const checkScheduleToBeClosedController = asyncHandler(async (req, res) => {
  const { scheduleId } = req.params;

  const result = await checkScheduleToBeClosed(scheduleId);
  res.json(result);
});

export const markTicketAsNotLostController = asyncHandler(async (req, res) => {
  const { scheduleId, controlNumber } = req.body;

  if (!scheduleId || !controlNumber) {
    throw new AppError("Missing Query Fields", HttpStatusCodes.BadRequest);
  }

  await markTicketAsNotLost({ scheduleId, controlNumber });

  res.json({ message: "Marked Ticket as Not Lost" });
});
