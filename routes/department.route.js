import express from "express";
import {
  assignDepartmentTrainerController,
  createDepartmentController,
  createTrainerAndAssignController,
  deleteDepartmentController,
  editDepartmentController,
  getDepartmentController,
  getDepartmentListController,
} from "../controller/department.controller.js";
import { requireRole, verifyAuth } from "../middleware/auth.middleware.js";
import upload from "../utils/upload.js";
import { updateWithReplace, uploadMediaMiddleware } from "../middleware/uploadMedia.middleware.js";

export const router = express.Router();

router.post("/", verifyAuth, requireRole("head"), upload.single("image"), uploadMediaMiddleware, createDepartmentController);
router.post("/createTrainerAndAssign", verifyAuth, requireRole("head"), createTrainerAndAssignController);

router.post("/assign", verifyAuth, requireRole("head"), assignDepartmentTrainerController);
router.patch("/", verifyAuth, requireRole("head"), upload.single("image"), updateWithReplace, editDepartmentController);

router.get("/", getDepartmentListController);
router.get("/:id", getDepartmentController);

router.delete("/:id", verifyAuth, requireRole("head"), deleteDepartmentController);
