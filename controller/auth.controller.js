import { asyncHandler } from "../middleware/asyncHandler.middleware.js";
import { AppError, HttpStatusCodes } from "../middleware/errorHandler.middleware.js";
import { login, getUserById, changePassword, isPasswordCorrect } from "../services/auth.service.js";
import { mask } from "../utils/security.js";
import { generateToken } from "../utils/token.utils.js";

export const loginController = asyncHandler(async (req, res) => {
  const { email, password, expectedRole } = req.body;

  if (!email || !password || !expectedRole) {
    throw new AppError("Email, password, and role are required", HttpStatusCodes.BadRequest);
  }

  const user = await login({ email, password });

  if (user.isArchived) {
    throw new AppError("Account is locked or archived", HttpStatusCodes.Forbidden);
  }

  const maskedToken = mask(generateToken({ userId: user.userId, userRole: user.roles }));
  const maskedEmail = mask(email);

  res.json({ token: maskedToken, user: { ...user, email: maskedEmail } });
});

export const getUserInformationController = asyncHandler(async (req, res, next) => {
  const user = await getUserById(req.user.userId);

  if (!user) {
    return res.status(HttpStatusCodes.NOT_FOUND).json({ message: "User not found" });
  }

  const { email, distributor, ...others } = user;

  const encryptedEmail = mask(email);

  let maskedDistributor = null;
  if (distributor) {
    maskedDistributor = {
      ...distributor,
      contactNumber: distributor.contactNumber ? mask(distributor.contactNumber) : undefined,
      distributorType: distributor.distributorType,
      department: distributor.department
        ? {
            ...distributor.department,
            departmentId: distributor.department.departmentId,
            name: distributor.department.name,
          }
        : null,
    };
  }

  res.status(HttpStatusCodes.OK).json({
    ...others,
    email: encryptedEmail,
    distributor: maskedDistributor,
  });
});

export const updatePasswordController = asyncHandler(async (req, res) => {
  const { userId, newPassword } = req.body;

  if (!userId || !newPassword) {
    throw new AppError("Missing Post Fields");
  }

  await changePassword({ userId, newPassword });
  res.json({ message: "Password Updated" });
});

export const changePasswordController = asyncHandler(async (req, res) => {
  const { userId, currentPassword, newPassword } = req.body;

  if (!userId || !newPassword || !currentPassword) {
    throw new AppError("Missing Post Fields");
  }

  const isCorrectPassword = await isPasswordCorrect({ userId, password: currentPassword });

  if (!isCorrectPassword) {
    throw new AppError("Current Password is wrong");
  }

  await changePassword({ userId, newPassword });
  res.json({ message: "Password Changed" });
});
