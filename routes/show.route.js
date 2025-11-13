import express from "express";
import {
  archiveShowController,
  createShowController,
  getShowController,
  getShowsController,
  unArchiveShowController,
  getArchivedShowsController,
  updateShowController,
  deleteShowController,
  getDistributorShowsAndTicketsAllocatedController,
  generateSalesReportController,
} from "../controller/show.controller.js";
import { requireRole, verifyAuth } from "../middleware/auth.middleware.js";

export const router = express.Router();

router.post("/", verifyAuth, requireRole("head", "trainer"), createShowController);
router.post("/archive", verifyAuth, requireRole("head", "trainer"), archiveShowController);
router.post("/unarchive", verifyAuth, requireRole("head", "trainer"), unArchiveShowController);
router.post("/delete", verifyAuth, requireRole("head", "trainer"), deleteShowController);

router.get("/:id", getShowController);
router.get("/", getShowsController);
router.get("/archived", getArchivedShowsController);
router.get(
  "/distributors/:distributorId/tickets",
  verifyAuth,
  requireRole("distributor", "trainer", "head"),
  getDistributorShowsAndTicketsAllocatedController
);

router.patch("/", verifyAuth, requireRole("head", "trainer"), updateShowController);

router.get("/salesreport/:showId", generateSalesReportController);
