import express from "express";

import authMiddleware from "../../middlewares/auth.middleware.js";
import authorize from "../../middlewares/authorize.middleware.js";
import validate from "../../middlewares/validate.middleware.js";

import { COMMON_MESSAGES } from "../../constants/messages.js";
import ROLES from "../../constants/roles.js";

import ApiError from "../../utils/ApiError.js";

import authValidator from "./auth.validator.js";
import authController from "./auth.controller.js";

const allowedClientOrigin =
  process.env.CLIENT_ORIGIN || "http://localhost:5173";

const validateClientOrigin = (req, res, next) => {
  const origin = req.get("Origin");
  if (origin && origin !== allowedClientOrigin) {
    return next(new ApiError(403, COMMON_MESSAGES.FORBIDDEN));
  }
  next();
};

const authRouter = express.Router();

const ALL_ROLES = [
  ROLES.ADMIN,
  ROLES.DRIVER,
  ROLES.DISPATCHER,
  ROLES.WAREHOUSE_STAFF,
  ROLES.CUSTOMER,
];

authRouter.post(
  "/register",
  validate(authValidator.registerSchema),
  authController.register,
);

authRouter.post(
  "/register/verify-otp",
  validate(authValidator.verifyRegisterOtpSchema),
  authController.verifyRegisterOtp,
);

authRouter.post(
  "/forgot-password",
  validate(authValidator.requestPasswordResetOtpSchema),
  authController.requestPasswordResetOtp,
);

authRouter.post(
  "/reset-password",
  validate(authValidator.resetPasswordSchema),
  authController.resetPasswordWithOtp,
);

authRouter.patch(
  "/change-password",
  authMiddleware,
  authorize(...ALL_ROLES),
  validate(authValidator.changePasswordSchema),
  authController.changePassword,
);

authRouter.post(
  "/login",
  validateClientOrigin,
  validate(authValidator.loginSchema),
  authController.login,
);

authRouter.post(
  "/refresh-token",
  validateClientOrigin,
  authController.refreshAccessToken,
);

authRouter.post("/logout", validateClientOrigin, authController.logout);

export default authRouter;
