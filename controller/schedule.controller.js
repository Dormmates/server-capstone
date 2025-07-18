import { asyncHandler } from "../middleware/asyncHandler.middleware.js";
import { AppError, HttpStatusCodes } from "../middleware/errorHandler.middleware.js";
import { addShowSchedule, getShowSchedules } from "../services/schedule.service.js";
import { doesShowExist } from "../services/show.service.js";
import { convertDates } from "../utils/convert.utils.js";

export const getShowSchedulesController = asyncHandler(async (req, res) => {
  const { showId } = req.query;

  const exists = doesShowExist(showId);

  if (!exists) {
    throw new AppError("Show Not Found", HttpStatusCodes.NotFound);
  }

  const schedules = await getShowSchedules(showId);
  res.json({ schedules });
});

export const addShowScheduleController = asyncHandler(async (req, res) => {
  const { ticketType, showId, dates, seatingConfiguration } = req.body;

  switch (ticketType) {
    case "ticketed": {
      break;
    }
    case "nonTicketed": {
      await addShowSchedule({
        dates: convertDates(dates),
        showId,
        seatingType: seatingConfiguration,
        ticketType,
      });
      res.status(HttpStatusCodes.OK).json({ message: "Schedules Addded" });
      break;
    }
    default: {
      throw new AppError("Invalid Ticket Type Value", HttpStatusCodes.BadRequest);
    }
  }
});
