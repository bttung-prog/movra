import express from "express";

import authorize from "../../middlewares/authorize.middleware.js";
import validate from "../../middlewares/validate.middleware.js";

import ROLES from "../../constants/roles.js";

import userValidator from "./user.validator.js";
import userController from "./user.controller.js";

const ALL_ROLES = [
  ROLES.ADMIN,
  ROLES.DRIVER,
  ROLES.DISPATCHER,
  ROLES.WAREHOUSE_STAFF,
  ROLES.CUSTOMER,
];

const userRouter = express.Router();

userRouter.get("/me", authorize(...ALL_ROLES), userController.getMe);

userRouter.patch(
  "/me",
  authorize(...ALL_ROLES),
  validate(userValidator.updateMeSchema),
  userController.updateMe,
);

export default userRouter;
