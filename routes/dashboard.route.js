import express from "express";
import { verifyAuth } from "../middleware/auth.middleware.js";
import {
  getTopDistributorsController,
  getTopShowsByGenreController,
  getTopShowsByTicketSoldController,
  getTopShowsByTotalRevenueController,
} from "../controller/dashboard.controller.js";

export const router = express.Router();

router.get("/top-shows/tickets", verifyAuth, getTopShowsByTicketSoldController);
router.get("/top-shows/revenue", verifyAuth, getTopShowsByTotalRevenueController);
router.get("/top-shows/genre", verifyAuth, getTopShowsByGenreController);
router.get("/top-distributors", verifyAuth, getTopDistributorsController);
