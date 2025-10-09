import express from "express";
import { verifyAuth } from "../middleware/auth.middleware.js";
import {
  getKPISummaryController,
  getTopDistributorsController,
  getTopShowsByGenreController,
  getTopShowsByTicketSoldController,
  getTopShowsByTotalRevenueController,
  getUpcomingShowsController,
} from "../controller/dashboard.controller.js";

export const router = express.Router();

router.get("/top-shows/tickets", verifyAuth, getTopShowsByTicketSoldController);
router.get("/top-shows/revenue", verifyAuth, getTopShowsByTotalRevenueController);
router.get("/top-shows/genre", verifyAuth, getTopShowsByGenreController);
router.get("/top-distributors", verifyAuth, getTopDistributorsController);
router.get("/kpi", verifyAuth, getKPISummaryController);
router.get("/upcoming/shows", verifyAuth, getUpcomingShowsController);
