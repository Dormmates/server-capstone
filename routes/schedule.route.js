import express from "express";
import {
  addShowScheduleController,
  allocateTicketController,
  allocateTicketsToMultipleDistributorsController,
  closeScheduleController,
  copyScheduleController,
  deleteScheduleController,
  getAllDistributorAllocationHistoryController,
  getAllDistributorRemittanceHistoryController,
  getDistributorAllocationHistoryController,
  getDistributorRemittanceHistoryController,
  getDistributorsForTicketAllocationController,
  getDistributorTicketActivitiesController,
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
  transferTicketController,
  unAllocateTicketController,
  unRemitTicketSalesController,
  updateTallyDataController,
} from "../controller/schedule.controller.js";
import { requireRole, verifyAuth } from "../middleware/auth.middleware.js";

export const router = express.Router();

//Get Schedule Datas
router.get("/", getShowSchedulesController);
router.get("/:scheduleId", getScheduleInfoController);

//Schedule CRUD Operations
router.post("/", verifyAuth, requireRole("head", "trainer"), addShowScheduleController);
router.post("/closeSchedule", verifyAuth, requireRole("head", "trainer"), closeScheduleController);
router.post("/openSchedule", verifyAuth, requireRole("head", "trainer"), openScheduleController);
router.post("/deleteSchedule", verifyAuth, requireRole("head", "trainer"), deleteScheduleController);
router.post("/reschedule", verifyAuth, requireRole("head", "trainer"), rescheduleController);
router.post("/copy", verifyAuth, requireRole("head", "trainer"), copyScheduleController);

//Get Specific Schedule Informations
router.get("/summary/:scheduleId", getScheudleSummaryController);
router.get("/tickets/:scheduleId", getScheduleTicketsController);
router.get("/distributors/:scheduleId", getScheduleDistributorsController);
router.get("/distributors/:scheduleId/allocation", getDistributorsForTicketAllocationController);
router.get("/seatmap/:scheduleId", getScheduleSeatMapController);

//Schedule History or Log Operations
router.get("/:scheduleId/ticketAllocated/:distributorId", getTicketsAllocatedOfDistributorController);
router.get("/:scheduleId/allocationHistory/:distributorId", getDistributorAllocationHistoryController);
router.get("/allocationHistory/:distributorId", getAllDistributorAllocationHistoryController);
router.get("/:scheduleId/remittanceHistory/:distributorId", getDistributorRemittanceHistoryController);
router.get("/remittanceHistory/:distributorId", getAllDistributorRemittanceHistoryController);
router.get("/:scheduleId/ticketSummary/:distributorId", getDistributorTicketsSummaryController);
router.get("/tallyData/:scheduleId", verifyAuth, requireRole("head", "trainer"), getTallyDataController);
router.get("/logs/distributorActivites/:scheduleId", verifyAuth, getDistributorTicketActivitiesController);

//Schedule Ticket Operations
router.post("/allocate/controlNumber", verifyAuth, requireRole("head", "trainer"), allocateTicketController);
router.post("/allocate/multiple", verifyAuth, requireRole("head", "trainer"), allocateTicketsToMultipleDistributorsController);
router.post("/unallocate/controlNumber", verifyAuth, requireRole("head", "trainer"), unAllocateTicketController);
router.post("/tallyData", verifyAuth, requireRole("head", "trainer"), updateTallyDataController);
router.post("/remit", verifyAuth, requireRole("head", "trainer"), remitTicketSalesController);
router.post("/unremit", verifyAuth, requireRole("head", "trainer"), unRemitTicketSalesController);
router.post("/transfer", verifyAuth, requireRole("head", "trainer"), transferTicketController);

//Distributor Ticket Operations
router.post("/markSold", verifyAuth, markTicketAsSoldController);
router.post("/markUnsold", verifyAuth, markTicketAsUnSoldController);
