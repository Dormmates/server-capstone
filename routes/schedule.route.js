import express from "express";
import {
  addShowScheduleController,
  allocateTicketByControlNumberController,
  getDistributorTicketsSummaryController,
  getScheduleDistributorsController,
  getScheduleInfoController,
  getScheduleSeatMapController,
  getScheduleTicketsController,
  getScheudleSummaryController,
  getShowSchedulesController,
  getTicketsAllocatedOfDistributorController,
} from "../controller/schedule.controller.js";
import { requireRole, verifyAuth } from "../middleware/auth.middleware.js";

export const router = express.Router();

router.post("/", verifyAuth, requireRole("head", "trainer"), addShowScheduleController);

router.get("/", verifyAuth, requireRole("head", "trainer"), getShowSchedulesController);

router.get("/:scheduleId", verifyAuth, requireRole("head", "trainer"), getScheduleInfoController);
router.get("/summary/:scheduleId", verifyAuth, requireRole("head", "trainer"), getScheudleSummaryController);
router.get("/tickets/:scheduleId", verifyAuth, requireRole("head", "trainer"), getScheduleTicketsController);
router.get("/distributors/:scheduleId", verifyAuth, requireRole("head", "trainer"), getScheduleDistributorsController);
router.get("/seatmap/:scheduleId", verifyAuth, requireRole("head", "trainer"), getScheduleSeatMapController);

router.get("/:scheduleId/ticketAllocated/:distributorId", getTicketsAllocatedOfDistributorController);
router.get("/:scheduleId/ticketSummary/:distributorId", getDistributorTicketsSummaryController);

router.post("/allocate/controlNumber", verifyAuth, requireRole("head", "trainer"), allocateTicketByControlNumberController);
