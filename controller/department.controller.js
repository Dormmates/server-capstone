import { asyncHandler } from "../middleware/asyncHandler.middleware.js";
import { AppError, HttpStatusCodes } from "../middleware/errorHandler.middleware.js";
import {
  assignDepartmentTrainers,
  createDepartment,
  createTrainerAndAssign,
  deleteDepartment,
  getDepartment,
  getDepartments,
  unassignDepartmentTrainer,
  updateDepartment,
} from "../services/department.service.js";
import { storage } from "../utils/appwriteconfig.js";
import { getFileId } from "../utils/general.utils.js";

export const createDepartmentController = asyncHandler(async (req, res, next) => {
  const { name } = req.body;
  const { imageUrl } = req;

  const newDepartment = await createDepartment({ name, logoUrl: imageUrl });

  res.status(HttpStatusCodes.Created).json({ ...newDepartment });
});

export const getDepartmentController = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const department = await getDepartment(id);
  res.json(department);
});

export const getDepartmentListController = asyncHandler(async (req, res, next) => {
  const { trainerId } = req.query;

  const departments = await getDepartments(trainerId);
  res.json(departments);
});

export const deleteDepartmentController = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const dep = await deleteDepartment(id);

  if (dep) {
    await storage.deleteFile(process.env.APP_WRITE_BUCKET_ID, getFileId(dep.logoUrl));
  }

  res.json({ message: "Deleted" });
});

export const editDepartmentController = asyncHandler(async (req, res, next) => {
  const { departmentId, name } = req.body;
  const { imageUrl } = req;

  if (!departmentId || !name) {
    throw new AppError("Missing Post Fields", HttpStatusCodes.BadRequest);
  }

  await updateDepartment({ departmentId, name, logoUrl: imageUrl });
  res.json({ message: "Updated" });
});

export const unassignDepartmentTrainerController = asyncHandler(async (req, res, next) => {
  const { trainerId, departmentId } = req.body;

  if (!trainerId || !departmentId) {
    throw new AppError("Missing Post Fields", HttpStatusCodes.BadRequest);
  }

  await unassignDepartmentTrainer({ trainerId, departmentId });

  res.json({ message: "Removed" });
});

export const createTrainerAndAssignController = asyncHandler(async (req, res, next) => {
  const { departmentId, firstName, lastName, email } = req.body;

  if (!departmentId || !firstName || !lastName || !email) {
    throw new AppError("Missing Post Fields", HttpStatusCodes.BadRequest);
  }

  await createTrainerAndAssign({ departmentId, firstName, lastName, email });

  res.json({ message: "Success" });
});

export const assignDepartmentTrainerController = asyncHandler(async (req, res, next) => {
  const { departmentId, trainers } = req.body;

  if (!departmentId || !trainers) {
    throw new AppError("Missing Post Fields", HttpStatusCodes.BadRequest);
  }

  await assignDepartmentTrainers({ departmentId, trainers });
  res.json({ message: "Success" });
});
