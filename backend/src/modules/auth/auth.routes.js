import express from "express";

import validate from "../../middlewares/validate.middleware.js";

import { COMMON_MESSAGES } from "../../constants/messages.js";

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

authRouter.post(
  "/register",
  validate(authValidator.registerSchema),
  authController.register,
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
