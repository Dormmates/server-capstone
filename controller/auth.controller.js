import { asyncHandler } from "../middleware/asyncHandler.middleware.js";
import { AppError, HttpStatusCodes } from "../middleware/errorHandler.middleware.js";
import { login, getUserById } from "../services/auth.service.js";
import { generateToken } from "../utils/token.utils.js";
import { validateEmail } from "../utils/validators.js";

export const loginController = asyncHandler(async (req, res) => {
  const { email, password, expectedRole } = req.body;

  if (!email || !password || !expectedRole) {
    throw new AppError("Email, password, and role are required", HttpStatusCodes.BadRequest);
  }

  if (expectedRole !== "distributor") {
    const emailCheck = validateEmail({ requiredDomain: "@slu.edu.ph", email });
    if (!emailCheck.valid) {
      throw new AppError(emailCheck.message, HttpStatusCodes.BadRequest);
    }
  }

  const user = await login({ email, password });

  if (user.isArchived || user.isLocked) {
    throw new AppError("Account is locked or archived", HttpStatusCodes.Forbidden);
  }

  // const hasRole = (rolesToCheck) => user.roles.some((r) => rolesToCheck.includes(r));

  // if ((hasRole(["head", "trainer"]) && expectedRole !== "cca") || (hasRole(["distributor"]) && expectedRole !== "distributor")) {
  //   throw new AppError("Unauthorized Account Role", HttpStatusCodes.Forbidden);
  // }

  res.cookie("authToken", generateToken({ userId: user.userId, userRole: user.roles }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  });

  res.status(HttpStatusCodes.OK).json({ ...user });
});

export const getUserInformationController = asyncHandler(async (req, res, next) => {
  const user = await getUserById(req.user.userId);
  res.status(HttpStatusCodes.OK).json(user);
});

export const logoutController = asyncHandler(async (req, res) => {
  res.clearCookie("authToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  });

  res.status(200).json({ message: "Logged out successfully" });
});
