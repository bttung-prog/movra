import express from "express";

import authorize from "../../middlewares/authorize.middleware.js";
import validate from "../../middlewares/validate.middleware.js";

import ROLES from "../../constants/roles.js";

import tripValidator from "./trip.validator.js";
import tripController from "./trip.controller.js";

const tripRouter = express.Router();

tripRouter.post(
  "/",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  validate(tripValidator.createTripSchema),
  tripController.create,
);

tripRouter.get(
  "/",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.DRIVER),
  validate(tripValidator.queryTripSchema, "query"),
  tripController.getAll,
);

tripRouter.get(
  "/code/:tripCode",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.DRIVER),
  validate(tripValidator.tripCodeParamSchema, "params"),
  tripController.getByCode,
);

tripRouter.get(
  "/:tripId",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.DRIVER),
  validate(tripValidator.tripIdParamSchema, "params"),
  tripController.getById,
);

tripRouter.patch(
  "/:tripId",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  validate(tripValidator.tripIdParamSchema, "params"),
  validate(tripValidator.updateTripSchema),
  tripController.updateById,
);

tripRouter.delete(
  "/:tripId",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  validate(tripValidator.tripIdParamSchema, "params"),
  tripController.deleteById,
);

tripRouter.patch(
  "/:tripId/restore",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  validate(tripValidator.tripIdParamSchema, "params"),
  tripController.restoreById,
);

tripRouter.post(
  "/:tripId/reassign",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  validate(tripValidator.tripIdParamSchema, "params"),
  validate(tripValidator.reassignSchema),
  tripController.reassign,
);

tripRouter.get(
  "/:tripId/assignments",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  validate(tripValidator.tripIdParamSchema, "params"),
  validate(tripValidator.paginationQuerySchema, "query"),
  tripController.getAssignmentsByTripId,
);

tripRouter.get(
  "/:tripId/audit-logs",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  validate(tripValidator.tripIdParamSchema, "params"),
  validate(tripValidator.paginationQuerySchema, "query"),
  tripController.getAuditLogsByTripId,
);

tripRouter.post(
  "/:tripId/tracking",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.DRIVER),
  validate(tripValidator.tripIdParamSchema, "params"),
  validate(tripValidator.createTrackingLogSchema),
  tripController.addTrackingLog,
);

tripRouter.get(
  "/:tripId/tracking",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.DRIVER),
  validate(tripValidator.tripIdParamSchema, "params"),
  validate(tripValidator.paginationQuerySchema, "query"),
  tripController.getTrackingLogsByTripId,
);

tripRouter.get(
  "/:tripId/tracking/latest",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.DRIVER),
  validate(tripValidator.tripIdParamSchema, "params"),
  tripController.getLatestTrackingLog,
);

tripRouter.post(
  "/:tripId/expenses",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.DRIVER),
  validate(tripValidator.tripIdParamSchema, "params"),
  validate(tripValidator.createExpenseSchema),
  tripController.addExpense,
);

tripRouter.get(
  "/:tripId/expenses",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.DRIVER),
  validate(tripValidator.tripIdParamSchema, "params"),
  validate(tripValidator.paginationQuerySchema, "query"),
  tripController.getExpensesByTripId,
);

tripRouter.get(
  "/:tripId/expenses/total",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  validate(tripValidator.tripIdParamSchema, "params"),
  tripController.getTotalExpensesByTripId,
);

tripRouter.patch(
  "/expenses/:expenseId",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  validate(tripValidator.expenseIdParamSchema, "params"),
  validate(tripValidator.updateExpenseSchema),
  tripController.updateExpenseById,
);

tripRouter.delete(
  "/expenses/:expenseId",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  validate(tripValidator.expenseIdParamSchema, "params"),
  tripController.deleteExpenseById,
);

export default tripRouter;
