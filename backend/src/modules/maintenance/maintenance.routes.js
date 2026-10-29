import express from "express";

import authorize from "../../middlewares/authorize.middleware.js";
import validate from "../../middlewares/validate.middleware.js";

import ROLES from "../../constants/roles.js";

import maintenanceValidator from "./maintenance.validator.js";
import maintenanceController from "./maintenance.controller.js";

const maintenanceRouter = express.Router();

// --- SCHEDULES ---
maintenanceRouter.post(
  "/schedules",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  validate(maintenanceValidator.createScheduleSchema),
  maintenanceController.createSchedule,
);

maintenanceRouter.get(
  "/schedules",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  validate(maintenanceValidator.schedulePaginationSchema, "query"),
  maintenanceController.getAllSchedules,
);

maintenanceRouter.get(
  "/schedules/upcoming",
  authorize(ROLES.ADMIN, ROLES.DRIVER, ROLES.DISPATCHER),
  maintenanceController.getUpcomingMaintenances,
);

maintenanceRouter.get(
  "/schedules/vehicles/:vehicleId",
  authorize(ROLES.ADMIN, ROLES.DRIVER, ROLES.DISPATCHER),
  validate(maintenanceValidator.vehicleIdParamSchema, "params"),
  validate(maintenanceValidator.schedulePaginationSchema, "query"),
  maintenanceController.getSchedulesByVehicleId,
);

maintenanceRouter.get(
  "/schedules/:scheduleId",
  authorize(ROLES.ADMIN, ROLES.DRIVER, ROLES.DISPATCHER),
  validate(maintenanceValidator.scheduleIdParamSchema, "params"),
  maintenanceController.getScheduleById,
);

maintenanceRouter.patch(
  "/schedules/:scheduleId",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  validate(maintenanceValidator.scheduleIdParamSchema, "params"),
  validate(maintenanceValidator.updateScheduleSchema),
  maintenanceController.updateSchedule,
);

maintenanceRouter.delete(
  "/schedules/:scheduleId",
  authorize(ROLES.ADMIN),
  validate(maintenanceValidator.scheduleIdParamSchema, "params"),
  maintenanceController.deleteSchedule,
);

maintenanceRouter.patch(
  "/schedules/:scheduleId/restore",
  authorize(ROLES.ADMIN),
  validate(maintenanceValidator.scheduleIdParamSchema, "params"),
  maintenanceController.restoreSchedule,
);

// --- LOGS ---
maintenanceRouter.post(
  "/logs",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.DRIVER),
  validate(maintenanceValidator.createLogSchema),
  maintenanceController.createLog,
);

maintenanceRouter.get(
  "/logs",
  authorize(ROLES.ADMIN, ROLES.DRIVER, ROLES.DISPATCHER),
  validate(maintenanceValidator.logPaginationSchema, "query"),
  maintenanceController.getLogs,
);

maintenanceRouter.get(
  "/logs/:logId",
  authorize(ROLES.ADMIN, ROLES.DRIVER, ROLES.DISPATCHER),
  validate(maintenanceValidator.logIdParamSchema, "params"),
  maintenanceController.getLogById,
);

maintenanceRouter.post(
  "/logs/:logId/events",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.DRIVER),
  validate(maintenanceValidator.logIdParamSchema, "params"),
  validate(maintenanceValidator.createLogEventSchema),
  maintenanceController.createLogEvent,
);

// --- COSTS ---
maintenanceRouter.get(
  "/costs/total",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  validate(maintenanceValidator.getCostSchema, "query"),
  maintenanceController.getTotalCost,
);

maintenanceRouter.get(
  "/costs/vehicles/:vehicleId",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  validate(maintenanceValidator.vehicleIdParamSchema, "params"),
  validate(maintenanceValidator.getCostByVehicleSchema, "query"),
  maintenanceController.getTotalCostByVehicle,
);

export default maintenanceRouter;
