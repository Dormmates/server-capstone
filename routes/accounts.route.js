import express from "express";
import { requireRole, verifyAuth } from "../middleware/auth.middleware.js";
import {
  archiveAccountController,
  createDistributorAccountController,
  createTrainerAccountController,
  deleteUserController,
  editTrainerAccountController,
  getDistributorInformationController,
  getDistributorsController,
  getDistributorTypesController,
  getTrainersController,
  unArchiveAccountController,
  updateDistributorAccountController,
} from "../controller/accounts.controller.js";

export const router = express.Router();

router.get("/trainers", verifyAuth, getTrainersController);
router.get("/distributors", verifyAuth, getDistributorsController);
router.get("/distributor/:id", verifyAuth, getDistributorInformationController);
router.get("/distributorTypes", getDistributorTypesController);

router.post("/trainer", verifyAuth, requireRole("head"), createTrainerAccountController);
router.post("/distributor", verifyAuth, createDistributorAccountController);

router.post("/delete/user", verifyAuth, requireRole("head", "trainer"), deleteUserController);
router.post("/archive/user", verifyAuth, requireRole("head", "trainer"), archiveAccountController);
router.post("/unArchive/user", verifyAuth, requireRole("head", "trainer"), unArchiveAccountController);

router.patch("/trainer", verifyAuth, requireRole("head", "trainer"), editTrainerAccountController);
router.patch("/distributor", verifyAuth, updateDistributorAccountController);

export default router;
