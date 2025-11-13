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

export const router = express.Router();

router.post("/", verifyAuth, requireRole("head"), createDepartmentController);
router.post("/createTrainerAndAssign", verifyAuth, requireRole("head"), createTrainerAndAssignController);

router.post("/assign", verifyAuth, requireRole("head"), assignDepartmentTrainerController);
router.patch("/", verifyAuth, requireRole("head"), editDepartmentController);

router.get("/", getDepartmentListController);
router.get("/:id", getDepartmentController);

router.delete("/:id", verifyAuth, requireRole("head"), deleteDepartmentController);
