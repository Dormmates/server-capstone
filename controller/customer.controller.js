import { asyncHandler } from "../middleware/asyncHandler.middleware.js";
import { AppError } from "../middleware/errorHandler.middleware.js";
import { getAvailableTickets, getDepartmentShows, getShowWithSchedule, getUpcomingShows } from "../services/customer.service.js";

export const getUpcomingShowsController = asyncHandler(async (req, res) => {
  const result = await getUpcomingShows();
  res.json(result);
});

export const getDepartmentShowsController = asyncHandler(async (req, res) => {
  const { departmentId } = req.params;
  const { isArchived } = req.query;

  if (!departmentId) {
    throw new AppError("Department Id Missing");
  }

  const result = await getDepartmentShows({ departmentId, isArchived });
  res.json(result);
});

export const getShowWithScheduleController = asyncHandler(async (req, res) => {
  const { showId } = req.params;

  const result = await getShowWithSchedule(showId);
  res.json(result);
});

export const getAvailableTicketsController = asyncHandler(async (req, res) => {
  const { scheduleId } = req.params;

  const result = await getAvailableTickets(scheduleId);
  res.json(result);
});
