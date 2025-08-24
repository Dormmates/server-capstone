import express from "express";
import {
  addShowScheduleController,
  allocateTicketByControlNumberController,
  getDistributorAllocationHistoryController,
  getDistributorRemittanceHistoryController,
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

router.get("/", getShowSchedulesController);

router.get("/:scheduleId", getScheduleInfoController);
router.get("/summary/:scheduleId", getScheudleSummaryController);
router.get("/tickets/:scheduleId", getScheduleTicketsController);
router.get("/distributors/:scheduleId", getScheduleDistributorsController);
router.get("/seatmap/:scheduleId", getScheduleSeatMapController);

router.get("/:scheduleId/ticketAllocated/:distributorId", getTicketsAllocatedOfDistributorController);
router.get("/:scheduleId/allocationHistory/:distributorId", getDistributorAllocationHistoryController);
router.get("/:scheduleId/remittanceHistory/:distributorId", getDistributorRemittanceHistoryController);
router.get("/:scheduleId/ticketSummary/:distributorId", getDistributorTicketsSummaryController);

router.post("/", verifyAuth, requireRole("head", "trainer"), addShowScheduleController);
router.post("/allocate/controlNumber", verifyAuth, requireRole("head", "trainer"), allocateTicketByControlNumberController);
