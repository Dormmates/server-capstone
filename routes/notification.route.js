import express from "express";
import {
  getUserNotificationsController,
  getUserUnreadNotificationsCountController,
  markNotificationsReadController,
} from "../controller/notification.controller.js";

export const router = express.Router();

router.get("/user/:id", getUserNotificationsController);
router.get("/user/:id/unread", getUserUnreadNotificationsCountController);

router.post("/read", markNotificationsReadController);
