import express from "express";
import { requireRole, verifyAuth } from "../middleware/auth.middleware.js";
import {
  addTicketPricingController,
  deleteFixedPricingController,
  deleteSectionPricingController,
  editPriceNameController,
  getTicketPricesController,
} from "../controller/ticketprice.controller.js";

export const router = express.Router();

router.post("/", verifyAuth, requireRole("head"), addTicketPricingController);
router.get("/", getTicketPricesController);

router.patch("/name", verifyAuth, requireRole("head"), editPriceNameController);

router.delete("/fixed", verifyAuth, requireRole("head"), deleteFixedPricingController);
router.delete("/sectioned", verifyAuth, requireRole("head"), deleteSectionPricingController);
