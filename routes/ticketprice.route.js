import express from "express";
import { requireRole, verifyAuth } from "../middleware/auth.middleware.js";
import { addTicketPricingController, getTicketPricesController } from "../controller/ticketprice.controller.js";

export const router = express.Router();

router.post("/", verifyAuth, requireRole("head"), addTicketPricingController);
router.get("/", verifyAuth, requireRole("head"), getTicketPricesController);
