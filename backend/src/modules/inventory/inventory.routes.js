import express from "express";

import authorize from "../../middlewares/authorize.middleware.js";
import validate from "../../middlewares/validate.middleware.js";

import ROLES from "../../constants/roles.js";

import inventoryValidator from "./inventory.validator.js";
import inventoryController from "./inventory.controller.js";

const inventoryRouter = express.Router();

inventoryRouter.get(
  "/",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.WAREHOUSE_STAFF),
  validate(inventoryValidator.querySchema, "query"),
  inventoryController.getAll,
);

inventoryRouter.get(
  "/order/:orderId",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.WAREHOUSE_STAFF),
  validate(inventoryValidator.orderIdParamSchema, "params"),
  inventoryController.getByOrderId,
);

inventoryRouter.patch(
  "/:inventoryId/location",
  authorize(ROLES.ADMIN, ROLES.WAREHOUSE_STAFF),
  validate(inventoryValidator.inventoryIdParamSchema, "params"),
  validate(inventoryValidator.updateLocationSchema),
  inventoryController.updateLocation,
);

inventoryRouter.patch(
  "/:inventoryId/condition",
  authorize(ROLES.ADMIN, ROLES.WAREHOUSE_STAFF),
  validate(inventoryValidator.inventoryIdParamSchema, "params"),
  validate(inventoryValidator.updateConditionSchema),
  inventoryController.updateCondition,
);

inventoryRouter.get(
  "/summary",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.WAREHOUSE_STAFF),
  inventoryController.getSummary,
);

inventoryRouter.get(
  "/:inventoryId",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.WAREHOUSE_STAFF),
  validate(inventoryValidator.inventoryIdParamSchema, "params"),
  inventoryController.getById,
);

export default inventoryRouter;
