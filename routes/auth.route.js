import express from "express";
import { loginController, getUserInformationController, logoutController } from "../controller/auth.controller.js";
import { verifyAuth } from "../middleware/auth.middleware.js";

export const router = express.Router();

router.post("/login", loginController);
router.post("/logout", logoutController);

router.get("/getUserInformation", verifyAuth, getUserInformationController);

export default router;
