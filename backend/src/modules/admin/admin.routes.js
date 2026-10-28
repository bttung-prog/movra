import express from "express";

import authorize from "../../middlewares/authorize.middleware.js";
import validate from "../../middlewares/validate.middleware.js";

import ROLES from "../../constants/roles.js";

import adminValidator from "./admin.validator.js";
import adminController from "./admin.controller.js";

const adminRouter = express.Router();

adminRouter.post(
  "/users",
  authorize(ROLES.ADMIN),
  validate(adminValidator.createUserSchema),
  adminController.createUser,
);

adminRouter.get(
  "/users",
  authorize(ROLES.ADMIN),
  validate(adminValidator.queryUserSchema, "query"),
  adminController.getAllUsers,
);

adminRouter.get(
  "/users/:userId",
  authorize(ROLES.ADMIN),
  validate(adminValidator.paramUserIdSchema, "params"),
  adminController.getUserById,
);

adminRouter.patch(
  "/users/:userId/role",
  authorize(ROLES.ADMIN),
  validate(adminValidator.paramUserIdSchema, "params"),
  validate(adminValidator.changeRoleUserSchema),
  adminController.changeRoleUser,
);

adminRouter.patch(
  "/users/:userId/status",
  authorize(ROLES.ADMIN),
  validate(adminValidator.paramUserIdSchema, "params"),
  validate(adminValidator.changeStatusUserSchema),
  adminController.changeStatusUser,
);

adminRouter.patch(
  "/users/:userId/reset-password",
  authorize(ROLES.ADMIN),
  validate(adminValidator.paramUserIdSchema, "params"),
  validate(adminValidator.resetPasswordSchema),
  adminController.resetPassword,
);

adminRouter.patch(
  "/users/:userId",
  authorize(ROLES.ADMIN),
  validate(adminValidator.paramUserIdSchema, "params"),
  validate(adminValidator.updateUserSchema),
  adminController.updateUser,
);

export default adminRouter;
