import express from "express";
import {
  addShowScheduleController,
  allocateTicketController,
  closeScheduleController,
  copyScheduleController,
  deleteScheduleController,
  getAllDistributorAllocationHistoryController,
  getAllDistributorRemittanceHistoryController,
  getDistributorAllocationHistoryController,
  getDistributorRemittanceHistoryController,
  getDistributorTicketsSummaryController,
  getScheduleDistributorsController,
  getScheduleInfoController,
  getScheduleSeatMapController,
  getScheduleTicketsController,
  getScheudleSummaryController,
  getShowSchedulesController,
  getTallyDataController,
  getTicketsAllocatedOfDistributorController,
  markTicketAsSoldController,
  markTicketAsUnSoldController,
  openScheduleController,
  remitTicketSalesController,
  rescheduleController,
  unAllocateTicketController,
  unRemitTicketSalesController,
  updateTallyDataController,
} from "../controller/schedule.controller.js";
import { requireRole, verifyAuth } from "../middleware/auth.middleware.js";

export const router = express.Router();

router.get("/", getShowSchedulesController);
router.get("/:scheduleId", getScheduleInfoController);

router.post("/closeSchedule", verifyAuth, requireRole("head", "trainer"), closeScheduleController);
router.post("/openSchedule", verifyAuth, requireRole("head", "trainer"), openScheduleController);
router.post("/deleteSchedule", verifyAuth, requireRole("head", "trainer"), deleteScheduleController);
router.post("/reschedule", verifyAuth, requireRole("head", "trainer"), rescheduleController);
router.post("/copy", verifyAuth, requireRole("head", "trainer"), copyScheduleController);

router.get("/summary/:scheduleId", getScheudleSummaryController);
router.get("/tickets/:scheduleId", getScheduleTicketsController);
router.get("/distributors/:scheduleId", getScheduleDistributorsController);
router.get("/seatmap/:scheduleId", getScheduleSeatMapController);

router.get("/:scheduleId/ticketAllocated/:distributorId", getTicketsAllocatedOfDistributorController);
router.get("/:scheduleId/allocationHistory/:distributorId", getDistributorAllocationHistoryController);
router.get("/allocationHistory/:distributorId", getAllDistributorAllocationHistoryController);
router.get("/:scheduleId/remittanceHistory/:distributorId", getDistributorRemittanceHistoryController);
router.get("/remittanceHistory/:distributorId", getAllDistributorRemittanceHistoryController);
router.get("/:scheduleId/ticketSummary/:distributorId", getDistributorTicketsSummaryController);
router.get("/tallyData/:scheduleId", verifyAuth, requireRole("head", "trainer"), getTallyDataController);

router.post("/", verifyAuth, requireRole("head", "trainer"), addShowScheduleController);
router.post("/allocate/controlNumber", verifyAuth, requireRole("head", "trainer"), allocateTicketController);
router.post("/unallocate/controlNumber", verifyAuth, requireRole("head", "trainer"), unAllocateTicketController);
router.post("/tallyData", verifyAuth, requireRole("head", "trainer"), updateTallyDataController);

router.post("/remit", verifyAuth, requireRole("head", "trainer"), remitTicketSalesController);
router.post("/unremit", verifyAuth, requireRole("head", "trainer"), unRemitTicketSalesController);
router.post("/markSold", verifyAuth, requireRole("distributor"), markTicketAsSoldController);
router.post("/markUnsold", verifyAuth, requireRole("distributor"), markTicketAsUnSoldController);
