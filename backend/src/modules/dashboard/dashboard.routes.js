import express from "express";

import authorize from "../../middlewares/authorize.middleware.js";
import validate from "../../middlewares/validate.middleware.js";

import ROLES from "../../constants/roles.js";

import dashboardController from "./dashboard.controller.js";
import dashboardValidator from "./dashboard.validator.js";

const dashboardRouter = express.Router();

dashboardRouter.use(authorize(ROLES.ADMIN));

dashboardRouter.get("/overview", dashboardController.getOverview);

dashboardRouter.get(
  "/driver-performance",
  validate(dashboardValidator.driverPerformanceQuerySchema, "query"),
  dashboardController.getDriverPerformance,
);

dashboardRouter.get("/fleet-status", dashboardController.getFleetStatus);

export default dashboardRouter;
