import express from "express";
import { requireRole, verifyAuth } from "../middleware/auth.middleware.js";
import {
  addTicketPricingController,
  deleteFixedPricingController,
  deleteSectionPricingController,
  getTicketPricesController,
  updateFixedPricingController,
  updateSectionPricingController,
} from "../controller/ticketprice.controller.js";

export const router = express.Router();

router.post("/", verifyAuth, requireRole("head"), addTicketPricingController);
router.get("/", verifyAuth, requireRole("head"), getTicketPricesController);

router.patch("/fixed", verifyAuth, requireRole("head"), updateFixedPricingController);
router.patch("/sectioned", verifyAuth, requireRole("head"), updateSectionPricingController);

router.delete("/fixed", verifyAuth, requireRole("head"), deleteFixedPricingController);
router.delete("/sectioned", verifyAuth, requireRole("head"), deleteSectionPricingController);
