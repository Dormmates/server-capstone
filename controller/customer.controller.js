import { asyncHandler } from "../middleware/asyncHandler.middleware.js";
import { getUpcomingShows } from "../services/customer.service.js";

export const getUpcomingShowsController = asyncHandler(async (req, res) => {
  const result = await getUpcomingShows();
  res.json(result);
});
