import express from "express";
import { autoClosePastSchedulesCronController } from "../controller/cron.controller.js";
export const router = express.Router();

router.post("/auto-close-schedules", autoClosePastSchedulesCronController);

export default router;
