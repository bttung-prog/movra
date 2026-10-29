import { DASHBOARD_MESSAGES } from "../../constants/messages.js";

import ApiResponse from "../../utils/ApiResponse.js";

import dashboardService from "./dashboard.service.js";

const getOverview = async (req, res, next) => {
  try {
    const data = await dashboardService.getOverviewStats();
    return ApiResponse.success(
      res,
      data,
      DASHBOARD_MESSAGES.GET_OVERVIEW_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getDriverPerformance = async (req, res, next) => {
  try {
    const limit = req.query.limit ?? 5;
    const data = await dashboardService.getDriverPerformance({ limit });
    return ApiResponse.success(
      res,
      data,
      DASHBOARD_MESSAGES.GET_DRIVER_PERFORMANCE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getFleetStatus = async (req, res, next) => {
  try {
    const data = await dashboardService.getFleetStatus();
    return ApiResponse.success(
      res,
      data,
      DASHBOARD_MESSAGES.GET_FLEET_STATUS_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

export default {
  getOverview,
  getDriverPerformance,
  getFleetStatus,
};
