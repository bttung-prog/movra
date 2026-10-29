import express from "express";

import authorize from "../../middlewares/authorize.middleware.js";
import validate from "../../middlewares/validate.middleware.js";

import ROLES from "../../constants/roles.js";

import vehicleValidator from "./vehicle.validator.js";
import vehicleController from "./vehicle.controller.js";

const vehicleRouter = express.Router();

// --- VEHICLE TYPE ROUTES ---
vehicleRouter.post(
  "/types",
  authorize(ROLES.ADMIN),
  validate(vehicleValidator.createTypeSchema),
  vehicleController.createType,
);

vehicleRouter.get("/types", authorize(ROLES.ADMIN), vehicleController.getActiveTypes);

vehicleRouter.get(
  "/types/deleted",
  authorize(ROLES.ADMIN),
  vehicleController.getDeletedTypes,
);

vehicleRouter.get(
  "/types/name/:vehicleTypeName",
  authorize(ROLES.ADMIN),
  validate(vehicleValidator.vehicleTypeNameParamSchema, "params"),
  vehicleController.getTypeByName,
);

vehicleRouter.get(
  "/types/:vehicleTypeId",
  authorize(ROLES.ADMIN),
  validate(vehicleValidator.vehicleTypeIdParamSchema, "params"),
  vehicleController.getTypeById,
);

vehicleRouter.patch(
  "/types/:vehicleTypeId/restore",
  authorize(ROLES.ADMIN),
  validate(vehicleValidator.vehicleTypeIdParamSchema, "params"),
  vehicleController.restoreType,
);

vehicleRouter.patch(
  "/types/:vehicleTypeId",
  authorize(ROLES.ADMIN),
  validate(vehicleValidator.vehicleTypeIdParamSchema, "params"),
  validate(vehicleValidator.updateTypeSchema),
  vehicleController.updateType,
);

vehicleRouter.delete(
  "/types/:vehicleTypeId",
  authorize(ROLES.ADMIN),
  validate(vehicleValidator.vehicleTypeIdParamSchema, "params"),
  vehicleController.removeType,
);

// --- VEHICLE ROUTES ---
vehicleRouter.post(
  "/",
  authorize(ROLES.ADMIN),
  validate(vehicleValidator.createSchema),
  vehicleController.create,
);

vehicleRouter.get(
  "/",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  validate(vehicleValidator.paginationQuerySchema, "query"),
  vehicleController.getAll,
);

vehicleRouter.get(
  "/expired-registration",
  authorize(ROLES.ADMIN),
  vehicleController.getExpiredRegistration,
);

vehicleRouter.get(
  "/expired-insurance",
  authorize(ROLES.ADMIN),
  vehicleController.getExpiredInsurance,
);

vehicleRouter.get(
  "/plate/:plateNumber",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  vehicleController.getByPlateNumber,
);

// --- VEHICLE USAGE LOG ROUTES ---
vehicleRouter.post(
  "/usage-logs",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  validate(vehicleValidator.createUsageLogSchema),
  vehicleController.createUsageLog,
);

vehicleRouter.get(
  "/usage-logs",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.DRIVER),
  validate(vehicleValidator.queryUsageLogsSchema, "query"),
  vehicleController.getUsageLogs,
);

vehicleRouter.get(
  "/usage-logs/trip/:tripId",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.DRIVER),
  validate(vehicleValidator.tripIdParamSchema, "params"),
  vehicleController.getUsageLogsByTripId,
);

vehicleRouter.get(
  "/usage-logs/driver/:driverId",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.DRIVER),
  validate(vehicleValidator.driverIdParamSchema, "params"),
  vehicleController.getUsageLogsByDriverId,
);

vehicleRouter.get(
  "/usage-logs/:logId",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.DRIVER),
  validate(vehicleValidator.logIdParamSchema, "params"),
  vehicleController.getUsageLogById,
);

vehicleRouter.patch(
  "/usage-logs/:logId/checkout",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.DRIVER),
  validate(vehicleValidator.logIdParamSchema, "params"),
  validate(vehicleValidator.checkOutUsageLogSchema),
  vehicleController.checkOutUsageLog,
);

vehicleRouter.patch(
  "/usage-logs/:logId",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  validate(vehicleValidator.logIdParamSchema, "params"),
  validate(vehicleValidator.updateUsageLogSchema),
  vehicleController.updateUsageLog,
);

vehicleRouter.delete(
  "/usage-logs/:logId",
  authorize(ROLES.ADMIN),
  validate(vehicleValidator.logIdParamSchema, "params"),
  vehicleController.removeUsageLog,
);

vehicleRouter.patch(
  "/usage-logs/:logId/restore",
  authorize(ROLES.ADMIN),
  validate(vehicleValidator.logIdParamSchema, "params"),
  vehicleController.restoreUsageLog,
);

vehicleRouter.get(
  "/:vehicleId",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  validate(vehicleValidator.vehicleIdParamSchema, "params"),
  vehicleController.getById,
);

vehicleRouter.patch(
  "/:vehicleId/status",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  validate(vehicleValidator.vehicleIdParamSchema, "params"),
  validate(vehicleValidator.changeStatusSchema),
  vehicleController.changeStatus,
);

vehicleRouter.patch(
  "/:vehicleId/odometer",
  authorize(ROLES.ADMIN, ROLES.DRIVER, ROLES.DISPATCHER),
  validate(vehicleValidator.vehicleIdParamSchema, "params"),
  validate(vehicleValidator.updateOdometerSchema),
  vehicleController.updateOdometer,
);

vehicleRouter.patch(
  "/:vehicleId/renew-registration",
  authorize(ROLES.ADMIN),
  validate(vehicleValidator.vehicleIdParamSchema, "params"),
  validate(vehicleValidator.renewRegistrationSchema),
  vehicleController.renewRegistration,
);

vehicleRouter.patch(
  "/:vehicleId/renew-insurance",
  authorize(ROLES.ADMIN),
  validate(vehicleValidator.vehicleIdParamSchema, "params"),
  validate(vehicleValidator.renewInsuranceSchema),
  vehicleController.renewInsurance,
);

vehicleRouter.patch(
  "/:vehicleId",
  authorize(ROLES.ADMIN),
  validate(vehicleValidator.vehicleIdParamSchema, "params"),
  validate(vehicleValidator.updateSchema),
  vehicleController.update,
);

vehicleRouter.get(
  "/:vehicleId/usage-logs",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.DRIVER),
  validate(vehicleValidator.vehicleIdParamSchema, "params"),
  vehicleController.getUsageLogsByVehicleId,
);

vehicleRouter.get(
  "/:vehicleId/usage-stats",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  validate(vehicleValidator.vehicleIdParamSchema, "params"),
  validate(vehicleValidator.usageStatsQuerySchema, "query"),
  vehicleController.getVehicleUsageStats,
);

export default vehicleRouter;
