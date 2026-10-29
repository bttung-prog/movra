import express from "express";

import authorize from "../../middlewares/authorize.middleware.js";
import validate from "../../middlewares/validate.middleware.js";

import ROLES from "../../constants/roles.js";

import warehouseValidator from "./warehouse.validator.js";
import warehouseController from "./warehouse.controller.js";

const warehouseRouter = express.Router();

warehouseRouter.post(
  "/",
  authorize(ROLES.ADMIN),
  validate(warehouseValidator.createSchema),
  warehouseController.create,
);

warehouseRouter.get(
  "/",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.WAREHOUSE_STAFF),
  validate(warehouseValidator.querySchema, "query"),
  warehouseController.getAll,
);

warehouseRouter.get(
  "/:warehouseId",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.WAREHOUSE_STAFF),
  validate(warehouseValidator.paramSchema, "params"),
  warehouseController.getById,
);

warehouseRouter.patch(
  "/:warehouseId/manager",
  authorize(ROLES.ADMIN),
  validate(warehouseValidator.paramSchema, "params"),
  validate(warehouseValidator.updateManagerSchema),
  warehouseController.updateManager,
);

warehouseRouter.patch(
  "/:warehouseId/status",
  authorize(ROLES.ADMIN),
  validate(warehouseValidator.paramSchema, "params"),
  validate(warehouseValidator.changeStatusSchema),
  warehouseController.changeStatus,
);

warehouseRouter.patch(
  "/:warehouseId/restore",
  authorize(ROLES.ADMIN),
  validate(warehouseValidator.paramSchema, "params"),
  warehouseController.restore,
);

warehouseRouter.patch(
  "/:warehouseId",
  authorize(ROLES.ADMIN),
  validate(warehouseValidator.paramSchema, "params"),
  validate(warehouseValidator.updateSchema),
  warehouseController.updateById,
);

warehouseRouter.delete(
  "/:warehouseId",
  authorize(ROLES.ADMIN),
  validate(warehouseValidator.paramSchema, "params"),
  warehouseController.softDelete,
);

export default warehouseRouter;
