import { asyncHandler } from "../middleware/asyncHandler.middleware.js";
import { AppError, HttpStatusCodes } from "../middleware/errorHandler.middleware.js";
import {
  archiveUser,
  createDistributorAccount,
  deleteUserSafely,
  editAccount,
  editDistributorAccount,
  getDistributors,
  getDistributorTypes,
  getTrainers,
  unArchiveUser,
} from "../services/accounts.service.js";
import { createAccount } from "../services/auth.service.js";
import { assignDepartmentTrainer, removeDepartmentTrainer, removeDepartmentTrainerByTrainerId } from "../services/department.service.js";
import prisma from "../utils/primsa.connection.js";
import { validateEmail } from "../utils/validators.js";

/**
 * Get list of Trainers
 */
export const getTrainersController = asyncHandler(async (req, res, next) => {
  const trainers = await getTrainers();
  res.json(trainers);
});

/**
 * Creates a new Trainer Account
 */
export const createTrainerAccountController = asyncHandler(async (req, res, next) => {
  const { firstName, lastName, email, departmentId } = req.body;

  if (!firstName || !lastName || !email) {
    throw new AppError("Missing Required Fields", HttpStatusCodes.BadRequest);
  }

  const emailCheck = validateEmail({ requiredDomain: "@slu.edu.ph", email });

  if (!emailCheck.valid) {
    throw new AppError(emailCheck.message, HttpStatusCodes.BadRequest);
  }

  const newTrainer = await createAccount({ firstName, lastName, userType: "trainer", email, password: "123456" });

  if (departmentId) {
    await assignDepartmentTrainer({ departmentId, trainerId: newTrainer.userId });
  }

  res.status(HttpStatusCodes.Created).json({ message: "Trainer Account Create Successfully" });
});

/**
 * Edits a Trainer Account
 */
export const editTrainerAccountController = asyncHandler(async (req, res, next) => {
  const { userId, firstName, lastName, email, departmentId } = req.body;

  if (!firstName || !lastName || !email) {
    throw new AppError("Missing Required Fields", HttpStatusCodes.BadRequest);
  }

  const emailCheck = validateEmail({ requiredDomain: "@slu.edu.ph", email });

  if (!emailCheck.valid) {
    throw new AppError(emailCheck.message, HttpStatusCodes.BadRequest);
  }

  await editAccount({ userId, firstName, lastName, email });

  if (departmentId) {
    await prisma.$transaction(async (tx) => {
      await removeDepartmentTrainerByTrainerId(userId, tx);

      await assignDepartmentTrainer({ departmentId, trainerId: userId, tx });
    });
  }

  res.status(HttpStatusCodes.Created).json({ message: "Trainer Account Edited" });
});

/**
 * Creates a Head Account
 */
export const createHeadAccountController = asyncHandler(async (req, res, next) => {
  const { firstName, lastName, email } = req.body;

  if (!firstName || !lastName || !email) {
    throw new AppError("Missing Post Fields", HttpStatusCodes.BadRequest);
  }

  const emailCheck = validateEmail({ requiredDomain: "@slu.edu.ph", email });

  if (!emailCheck.valid) {
    throw new AppError(emailCheck.message, HttpStatusCodes.BadRequest);
  }

  const newHead = await createAccount({ firstName, lastName, userType: type, email, password: "123456" });
  res.status(HttpStatusCodes.Created).json({ message: "Head Account Create Successfully", newHead });
});

/**
 * Creates a new Distributor Account
 */
export const createDistributorAccountController = asyncHandler(async (req, res, next) => {
  const { firstName, lastName, email, distributorType, contactNumber, departmentId } = req.body;

  if (!firstName || !lastName || !email || !distributorType || !contactNumber) {
    throw new AppError("Missing Post Fields", HttpStatusCodes.BadRequest);
  }

  let emailCheck;

  // CCA Member type ID on the database
  if (distributorType == 2) {
    emailCheck = validateEmail({ requiredDomain: "@slu.edu.ph", email });

    if (!departmentId) {
      throw new AppError("Please specify department for a CCA Member type of distributor", HttpStatusCodes.BadRequest);
    }
  } else {
    emailCheck = validateEmail({ email });
  }

  if (!emailCheck.valid) {
    throw new AppError(emailCheck.message, HttpStatusCodes.BadRequest);
  }

  const newAccount = await createDistributorAccount({ firstName, lastName, email, password: "123456", distributorType, contactNumber, departmentId });

  res.status(HttpStatusCodes.Created).json({ message: "Distributor Account Successfully Created", newAccount });
});

/**
 * Updates a Distributor Account
 */
export const updateDistributorAccountController = asyncHandler(async (req, res, next) => {
  const { userId, firstName, lastName, email, distributorType, contactNumber, departmentId } = req.body;

  if (!firstName || !lastName || !email || !distributorType || !contactNumber) {
    throw new AppError("Missing required fields", HttpStatusCodes.BadRequest);
  }

  let emailCheck;
  if (Number(distributorType) === 2) {
    emailCheck = validateEmail({ requiredDomain: "@slu.edu.ph", email });

    if (!departmentId) {
      throw new AppError("Please specify department for a CCA Member type of distributor", HttpStatusCodes.BadRequest);
    }
  } else {
    emailCheck = validateEmail({ email });
  }

  if (!emailCheck.valid) {
    throw new AppError(emailCheck.message, HttpStatusCodes.BadRequest);
  }

  const updatedAccount = await editDistributorAccount({ userId, firstName, lastName, email, distributorType, contactNumber, departmentId });

  res.json({ message: "Distributor account updated successfully", updatedAccount });
});

/**
 * Get Distributor Types
 */

export const getDistributorTypesController = asyncHandler(async (req, res, next) => {
  const types = await getDistributorTypes();
  res.json(types);
});

/**
 * Get list of Distributors
 */
export const getDistributorsController = asyncHandler(async (req, res, next) => {
  const { departmentId } = req.query;
  const data = await getDistributors(departmentId);

  res.json(data);
});

export const deleteUserController = asyncHandler(async (req, res, next) => {
  const { userId } = req.body;

  if (!userId) {
    throw new AppError("Missing Post Fields");
  }

  await deleteUserSafely(userId);
  res.json({ message: "User Deleted" });
});

export const archiveAccountController = asyncHandler(async (req, res, next) => {
  const { userId } = req.body;

  if (!userId) {
    throw new AppError("Missing Post Fields");
  }

  await archiveUser(userId);
  res.json({ message: "User Archived" });
});

export const unArchiveAccountController = asyncHandler(async (req, res, next) => {
  const { userId } = req.body;

  if (!userId) {
    throw new AppError("Missing Post Fields");
  }

  await unArchiveUser(userId);
  res.json({ message: "User UnArchived" });
});
