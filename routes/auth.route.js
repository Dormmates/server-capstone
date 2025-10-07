import express from "express";
import {
  loginController,
  getUserInformationController,
  logoutController,
  updatePasswordController,
  changePasswordController,
} from "../controller/auth.controller.js";
import { verifyAuth } from "../middleware/auth.middleware.js";

export const router = express.Router();

router.post("/login", loginController);
router.post("/logout", logoutController);
router.post("/updatePassword", verifyAuth, updatePasswordController);
router.post("/changePassword", verifyAuth, changePasswordController);

router.get("/getUserInformation", verifyAuth, getUserInformationController);

export default router;
