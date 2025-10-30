import { asyncHandler } from "../middleware/asyncHandler.middleware.js";
import { AppError, HttpStatusCodes } from "../middleware/errorHandler.middleware.js";
import { login, getUserById, changePassword, isPasswordCorrect } from "../services/auth.service.js";
import { generateToken } from "../utils/token.utils.js";
import { validateEmail } from "../utils/validators.js";

export const loginController = asyncHandler(async (req, res) => {
  const { email, password, expectedRole } = req.body;

  if (!email || !password || !expectedRole) {
    throw new AppError("Email, password, and role are required", HttpStatusCodes.BadRequest);
  }

  const user = await login({ email, password });

  if (user.isArchived) {
    throw new AppError("Account is locked or archived", HttpStatusCodes.Forbidden);
  }

  res.json({ token: generateToken({ userId: user.userId, userRole: user.roles }), user: { ...user } });
});

export const getUserInformationController = asyncHandler(async (req, res, next) => {
  const user = await getUserById(req.user.userId);
  res.status(HttpStatusCodes.OK).json(user);
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
