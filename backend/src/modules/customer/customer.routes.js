import express from "express";

import authorize from "../../middlewares/authorize.middleware.js";
import validate from "../../middlewares/validate.middleware.js";

import ROLES from "../../constants/roles.js";

import customerValidator from "./customer.validator.js";
import customerController from "./customer.controller.js";

const customerRouter = express.Router();

customerRouter.get("/me", authorize(ROLES.CUSTOMER), customerController.getMyProfile);

customerRouter.patch(
  "/me",
  authorize(ROLES.CUSTOMER),
  validate(customerValidator.updateMyProfileSchema),
  customerController.updateMyProfile,
);

customerRouter.get(
  "/",
  authorize(ROLES.ADMIN),
  validate(customerValidator.getAllSchema, "query"),
  customerController.getAll,
);

customerRouter.get(
  "/:customerId",
  authorize(ROLES.ADMIN),
  validate(customerValidator.getByIdSchema, "params"),
  customerController.getById,
);

customerRouter.patch(
  "/:customerId",
  authorize(ROLES.ADMIN),
  validate(customerValidator.getByIdSchema, "params"),
  validate(customerValidator.adminUpdateSchema),
  customerController.update,
);

export default customerRouter;
