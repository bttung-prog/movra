import { MAINTENANCE_MESSAGES } from "../../constants/messages.js";

import { ApiResponse } from "../../utils/ApiResponse.js";

import maintenanceLogService from "./maintenanceLog.service.js";
import maintenanceScheduleService from "./maintenanceSchedule.service.js";

const createSchedule = async (req, res, next) => {
  try {
    const schedule = await maintenanceScheduleService.create(
      req.body,
      req.user,
    );

    return ApiResponse.created(
      res,
      schedule,
      MAINTENANCE_MESSAGES.CREATE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getAllSchedules = async (req, res, next) => {
  try {
    const { page, limit, ...filter } = req.query;
    const result = await maintenanceScheduleService.getAll({
      filter,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      user: req.user,
    });

    return ApiResponse.success(
      res,
      result,
      MAINTENANCE_MESSAGES.GET_ALL_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getScheduleById = async (req, res, next) => {
  try {
    const schedule = await maintenanceScheduleService.getById(
      req.params.scheduleId,
      true,
      req.user,
    );

    return ApiResponse.success(
      res,
      schedule,
      MAINTENANCE_MESSAGES.GET_ONE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getSchedulesByVehicleId = async (req, res, next) => {
  try {
    const { vehicleId } = req.params;
    const { page, limit, ...filter } = req.query;

    const result = await maintenanceScheduleService.getByVehicleId({
      vehicleId,
      filter,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      user: req.user,
    });

    return ApiResponse.success(
      res,
      result,
      MAINTENANCE_MESSAGES.GET_ALL_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getUpcomingMaintenances = async (req, res, next) => {
  try {
    const daysAhead = req.query.daysAhead ? parseInt(req.query.daysAhead) : 7;
    const schedules = await maintenanceScheduleService.getUpcomingMaintenances({
      daysAhead,
      user: req.user,
    });

    return ApiResponse.success(
      res,
      schedules,
      MAINTENANCE_MESSAGES.GET_UPCOMING_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const updateSchedule = async (req, res, next) => {
  try {
    const schedule = await maintenanceScheduleService.updateById(
      req.params.scheduleId,
      req.body,
      req.user,
    );

    return ApiResponse.success(
      res,
      schedule,
      MAINTENANCE_MESSAGES.UPDATE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const deleteSchedule = async (req, res, next) => {
  try {
    const schedule = await maintenanceScheduleService.deleteById(
      req.params.scheduleId,
      req.user,
    );

    return ApiResponse.success(
      res,
      schedule,
      MAINTENANCE_MESSAGES.DELETE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const restoreSchedule = async (req, res, next) => {
  try {
    const schedule = await maintenanceScheduleService.restoreById(
      req.params.scheduleId,
      req.user,
    );

    return ApiResponse.success(
      res,
      schedule,
      MAINTENANCE_MESSAGES.RESTORE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const createLog = async (req, res, next) => {
  try {
    const log = await maintenanceLogService.create(req.body, req.user);

    return ApiResponse.created(
      res,
      log,
      MAINTENANCE_MESSAGES.CREATE_LOG_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getLogs = async (req, res, next) => {
  try {
    const { page, limit, ...filter } = req.query;
    const result = await maintenanceLogService.getAll({
      filter,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      user: req.user,
    });

    return ApiResponse.success(
      res,
      result,
      MAINTENANCE_MESSAGES.GET_LOGS_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getLogById = async (req, res, next) => {
  try {
    const log = await maintenanceLogService.getById(req.params.logId, req.user);

    return ApiResponse.success(res, log, MAINTENANCE_MESSAGES.GET_LOG_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getTotalCost = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const result = await maintenanceLogService.getTotalCost({
      startDate,
      endDate,
      user: req.user,
    });

    return ApiResponse.success(
      res,
      result,
      MAINTENANCE_MESSAGES.GET_TOTAL_COST_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getTotalCostByVehicle = async (req, res, next) => {
  try {
    const { vehicleId } = req.params;
    const { startDate, endDate } = req.query;
    const result = await maintenanceLogService.getTotalCostByVehicle({
      vehicleId,
      startDate,
      endDate,
      user: req.user,
    });

    return ApiResponse.success(
      res,
      result,
      MAINTENANCE_MESSAGES.GET_TOTAL_COST_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const createLogEvent = async (req, res, next) => {
  try {
    const log = await maintenanceLogService.createEvent(
      req.params.logId,
      req.body,
      req.user,
    );

    return ApiResponse.created(
      res,
      log,
      MAINTENANCE_MESSAGES.CREATE_LOG_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

export default {
  createSchedule,
  getAllSchedules,
  getScheduleById,
  getSchedulesByVehicleId,
  getUpcomingMaintenances,
  updateSchedule,
  deleteSchedule,
  restoreSchedule,

  createLog,
  getLogs,
  getLogById,
  getTotalCost,
  getTotalCostByVehicle,
  createLogEvent,
};
