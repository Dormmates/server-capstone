import express from "express";
import {
  addNewGenreController,
  deleteGenreController,
  getGenresController,
  getGenresWithShowCountController,
  updateGenereController,
} from "../controller/genres.controller.js";
import { requireRole, verifyAuth } from "../middleware/auth.middleware.js";

export const router = express.Router();

router.get("/", getGenresController);
router.get("/count", verifyAuth, requireRole("head"), getGenresWithShowCountController);
router.patch("/", verifyAuth, requireRole("head"), updateGenereController);
router.delete("/", verifyAuth, requireRole("head"), deleteGenreController);
router.post("/", verifyAuth, requireRole("head"), addNewGenreController);
