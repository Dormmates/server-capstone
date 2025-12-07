import jwt from "jsonwebtoken";
import { AppError, HttpStatusCodes } from "./errorHandler.middleware.js";
import { unmask } from "../utils/security.js";

export const verifyAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new AppError("Authentication required", HttpStatusCodes.Unauthorized));
  }

  const token = unmask(authHeader.split(" ")[1]);

  try {
    const decoded = jwt.verify(token, process.env.TOKEN_KEY);
    req.user = decoded;
    next();
  } catch (err) {
    return next(new AppError("Invalid or expired token", HttpStatusCodes.Unauthorized));
  }
};

export const requireRole = (...roles) => {
  return (req, res, next) => {
    const userRoles = req.user?.userRole || [];

    const hasRole = userRoles.some((role) => roles.includes(role));

    if (!hasRole) {
      return next(new AppError("Forbidden", HttpStatusCodes.Forbidden));
    }

    next();
  };
};
