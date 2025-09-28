import { asyncHandler } from "../middleware/asyncHandler.middleware.js";
import { autoClosePastSchedules } from "../services/cron.service.js";

export const autoClosePastSchedulesCronController = asyncHandler(async (req, res) => {
  if (req.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end("Unauthorized");
  }

  await autoClosePastSchedules();
});
