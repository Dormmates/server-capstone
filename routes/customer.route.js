import express from "express";
import { verifyAuth } from "../middleware/auth.middleware.js";
import { getUpcomingShowsController } from "../controller/customer.controller.js";

export const router = express.Router();

router.get("/upcomingShows", getUpcomingShowsController);
