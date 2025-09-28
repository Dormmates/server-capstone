import { asyncHandler } from "../middleware/asyncHandler.middleware.js";
import { autoClosePastSchedules } from "../services/cron.service.js";

export const autoClosePastSchedulesCronController = asyncHandler(async (req, res) => {
  const authHeader = req.headers?.authorization || req.headers?.Authorization || req.headers?.get?.("authorization");

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end("Unauthorized");
  }

  await autoClosePastSchedules();

  return res.status(200).json({ message: "Past schedules closed successfully" });
});
