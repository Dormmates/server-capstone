import { asyncHandler } from "../middleware/asyncHandler.middleware.js";
import { AppError, HttpStatusCodes } from "../middleware/errorHandler.middleware.js";
import {
  addCCAHeadRoles,
  archiveUser,
  createBulkDistributorAccounts,
  createDistributorAccount,
  deleteUserSafely,
  editAccount,
  editDistributorAccount,
  getCCAHeads,
  getDistributors,
  getEmails,
  getTrainers,
  removeCCAHeadRole,
  resetPassword,
  unArchiveUser,
} from "../services/accounts.service.js";
import { createAccount, getUserById } from "../services/auth.service.js";
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
  const { firstName, lastName, email } = req.body;

  if (!firstName || !lastName || !email) {
    throw new AppError("Missing Required Fields", HttpStatusCodes.BadRequest);
  }

  const emailCheck = validateEmail({ requiredDomain: "@slu.edu.ph", email });

  if (!emailCheck.valid) {
    throw new AppError(emailCheck.message, HttpStatusCodes.BadRequest);
  }

  await createAccount({ firstName, lastName, userType: "trainer", email, password: "123456" });

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
  if (distributorType == "cca") {
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
 * Creates a new Distributor Accounts
 */
export const createBulkDistributorAccountsController = asyncHandler(async (req, res, next) => {
  const { distributors, performingGroup } = req.body;

  if (!distributors || !performingGroup) {
    throw new AppError("Missing Post Fields", HttpStatusCodes.BadRequest);
  }

  const summary = await createBulkDistributorAccounts({ distributors, performingGroup });

  res.status(HttpStatusCodes.Created).json(summary);
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
  if (distributorType === "cca") {
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
 * Get list of Distributors
 */
export const getDistributorsController = asyncHandler(async (req, res, next) => {
  const { departmentId, excludeCCA, includeOtherTypes } = req.query;

  const data = await getDistributors(departmentId, excludeCCA, includeOtherTypes);

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

export const getDistributorInformationController = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  if (!id) {
    throw new AppError("Missing Post Fields");
  }

  const user = await getUserById(id);
  res.json(user);
});

export const addCCAHeadRoleController = asyncHandler(async (req, res, next) => {
  const { userIds } = req.body;

  if (!userIds) {
    throw new AppError("Missing Required Fields", HttpStatusCodes.BadRequest);
  }

  await addCCAHeadRoles(userIds);
  res.json({ message: "Added Role" });
});

export const createCCAHeadAccountController = asyncHandler(async (req, res, next) => {
  const { firstName, lastName, email } = req.body;

  if (!firstName || !lastName || !email) {
    throw new AppError("Missing Required Fields", HttpStatusCodes.BadRequest);
  }

  const emailCheck = validateEmail({ requiredDomain: "@slu.edu.ph", email });

  if (!emailCheck.valid) {
    throw new AppError(emailCheck.message, HttpStatusCodes.BadRequest);
  }

  const newAccount = await createAccount({ firstName, lastName, userType: "head", email, password: "123456" });

  res.status(HttpStatusCodes.Created).json(newAccount);
});

export const getCCAHeadAccountsController = asyncHandler(async (req, res) => {
  const accounts = await getCCAHeads();
  res.json(accounts);
});

export const removeCCAHeadRoleController = asyncHandler(async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    throw new AppError("Missing Required Fields", HttpStatusCodes.BadRequest);
  }

  await removeCCAHeadRole(userId);
  res.json({ message: "Remove Role" });
});

export const getEmailsController = asyncHandler(async (req, res) => {
  const emails = await getEmails();
  res.json(emails.map((email) => email.email));
});

export const resetPasswordController = asyncHandler(async (req, res) => {
  const { userId } = req.body;
  await resetPassword(userId);
  res.json({ message: "Password Reset, Ok." });
});
