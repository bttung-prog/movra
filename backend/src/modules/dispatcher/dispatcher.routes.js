import express from "express";

import authorize from "../../middlewares/authorize.middleware.js";
import validate from "../../middlewares/validate.middleware.js";

import ROLES from "../../constants/roles.js";

import dispatcherValidator from "./dispatcher.validator.js";
import dispatcherController from "./dispatcher.controller.js";

const dispatcherRouter = express.Router();

// --- DISPATCHER SELF ROUTES ---
dispatcherRouter.get(
  "/me",
  authorize(ROLES.DISPATCHER),
  dispatcherController.getMyProfile,
);

dispatcherRouter.get(
  "/me/dashboard",
  authorize(ROLES.DISPATCHER),
  dispatcherController.getDashboardStats,
);

dispatcherRouter.get(
  "/me/resources",
  authorize(ROLES.DISPATCHER),
  validate(dispatcherValidator.resourcesQuerySchema, "query"),
  dispatcherController.getResources,
);

// --- ADMIN MANAGEMENT ROUTES ---
dispatcherRouter.post(
  "/",
  authorize(ROLES.ADMIN),
  validate(dispatcherValidator.createSchema),
  dispatcherController.create,
);

dispatcherRouter.get(
  "/",
  authorize(ROLES.ADMIN),
  validate(dispatcherValidator.querySchema, "query"),
  dispatcherController.getAll,
);

dispatcherRouter.get(
  "/code/:dispatcherCode",
  authorize(ROLES.ADMIN),
  validate(dispatcherValidator.paramCodeSchema, "params"),
  dispatcherController.getByCode,
);

dispatcherRouter.get(
  "/user/:userId",
  authorize(ROLES.ADMIN),
  validate(dispatcherValidator.paramUserIdSchema, "params"),
  dispatcherController.getByUserId,
);

dispatcherRouter.get(
  "/:dispatcherId",
  authorize(ROLES.ADMIN),
  validate(dispatcherValidator.paramSchema, "params"),
  dispatcherController.getById,
);

dispatcherRouter.patch(
  "/:dispatcherId/transfer",
  authorize(ROLES.ADMIN),
  validate(dispatcherValidator.paramSchema, "params"),
  validate(dispatcherValidator.transferWarehouseSchema),
  dispatcherController.transferWarehouse,
);

dispatcherRouter.patch(
  "/:dispatcherId/status",
  authorize(ROLES.ADMIN),
  validate(dispatcherValidator.paramSchema, "params"),
  validate(dispatcherValidator.updateStatusSchema),
  dispatcherController.updateStatus,
);

dispatcherRouter.patch(
  "/:dispatcherId/restore",
  authorize(ROLES.ADMIN),
  validate(dispatcherValidator.paramSchema, "params"),
  dispatcherController.restoreById,
);

dispatcherRouter.patch(
  "/:dispatcherId",
  authorize(ROLES.ADMIN),
  validate(dispatcherValidator.paramSchema, "params"),
  validate(dispatcherValidator.updateSchema),
  dispatcherController.updateById,
);

dispatcherRouter.delete(
  "/:dispatcherId",
  authorize(ROLES.ADMIN),
  validate(dispatcherValidator.paramSchema, "params"),
  dispatcherController.deleteById,
);

export default dispatcherRouter;
