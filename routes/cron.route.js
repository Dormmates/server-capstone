import express from "express";
import { autoClosePastSchedulesCronController } from "../controller/cron.controller.js";
export const router = express.Router();

router.get("/auto-close-schedules", autoClosePastSchedulesCronController);

export default router;
