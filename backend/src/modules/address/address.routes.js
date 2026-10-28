import express from "express";

import authorize from "../../middlewares/authorize.middleware.js";
import validate from "../../middlewares/validate.middleware.js";

import ROLES from "../../constants/roles.js";

import addressValidator from "./address.validator.js";
import addressController from "./address.controller.js";

const addressRouter = express.Router();

addressRouter.post(
  "/",
  authorize(ROLES.CUSTOMER),
  validate(addressValidator.createSchema),
  addressController.create,
);

addressRouter.get("/", authorize(ROLES.CUSTOMER), addressController.getMy);

addressRouter.get(
  "/:addressId",
  authorize(ROLES.CUSTOMER),
  validate(addressValidator.idParamSchema, "params"),
  addressController.getById,
);

addressRouter.patch(
  "/:addressId/default",
  authorize(ROLES.CUSTOMER),
  validate(addressValidator.idParamSchema, "params"),
  addressController.setDefault,
);

addressRouter.patch(
  "/:addressId",
  authorize(ROLES.CUSTOMER),
  validate(addressValidator.idParamSchema, "params"),
  validate(addressValidator.updateSchema),
  addressController.update,
);

addressRouter.delete(
  "/:addressId",
  authorize(ROLES.CUSTOMER),
  validate(addressValidator.idParamSchema, "params"),
  addressController.remove,
);

export default addressRouter;
