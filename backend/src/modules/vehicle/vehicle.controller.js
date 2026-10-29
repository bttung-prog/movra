import { VEHICLE_MESSAGES } from "../../constants/messages.js";

import ApiResponse from "../../utils/ApiResponse.js";

import vehicleService from "./vehicle.service.js";

const createType = async (req, res, next) => {
  try {
    const vehicleType = await vehicleService.createType(req.body);

    return ApiResponse.created(
      res,
      vehicleType,
      VEHICLE_MESSAGES.CREATE_TYPE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getActiveTypes = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const result = await vehicleService.getActiveTypes({ page, limit });

    return ApiResponse.success(
      res,
      result,
      VEHICLE_MESSAGES.GET_ALL_TYPES_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getDeletedTypes = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const result = await vehicleService.getDeletedTypes({ page, limit });

    return ApiResponse.success(
      res,
      result,
      VEHICLE_MESSAGES.GET_DELETED_TYPES_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getTypeById = async (req, res, next) => {
  try {
    const vehicleType = await vehicleService.getTypeById(
      req.params.vehicleTypeId,
    );

    return ApiResponse.success(
      res,
      vehicleType,
      VEHICLE_MESSAGES.GET_TYPE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getTypeByName = async (req, res, next) => {
  try {
    const vehicleType = await vehicleService.getTypeByName(
      req.params.vehicleTypeName,
    );

    return ApiResponse.success(
      res,
      vehicleType,
      VEHICLE_MESSAGES.GET_TYPE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const updateType = async (req, res, next) => {
  try {
    const vehicleType = await vehicleService.updateType(
      req.params.vehicleTypeId,
      req.body,
    );

    return ApiResponse.success(
      res,
      vehicleType,
      VEHICLE_MESSAGES.UPDATE_TYPE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const removeType = async (req, res, next) => {
  try {
    const vehicleType = await vehicleService.deleteType(
      req.params.vehicleTypeId,
    );

    return ApiResponse.success(
      res,
      vehicleType,
      VEHICLE_MESSAGES.DELETE_TYPE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const restoreType = async (req, res, next) => {
  try {
    const vehicleType = await vehicleService.restoreType(
      req.params.vehicleTypeId,
    );

    return ApiResponse.success(
      res,
      vehicleType,
      VEHICLE_MESSAGES.RESTORE_TYPE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const vehicle = await vehicleService.create(req.body);

    return ApiResponse.created(res, vehicle, VEHICLE_MESSAGES.CREATE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getAll = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.vehicleTypeId) {
      filter.vehicleTypeId = req.query.vehicleTypeId;
    }

    const result = await vehicleService.getAll({
      filter,
      page,
      limit,
      user: req.user,
    });

    return ApiResponse.success(res, result, VEHICLE_MESSAGES.GET_ALL_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const vehicle = await vehicleService.getById(
      req.params.vehicleId,
      req.user,
    );

    return ApiResponse.success(res, vehicle, VEHICLE_MESSAGES.GET_ONE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getByPlateNumber = async (req, res, next) => {
  try {
    const vehicle = await vehicleService.getByPlateNumber(
      req.params.plateNumber,
      req.user,
    );

    return ApiResponse.success(res, vehicle, VEHICLE_MESSAGES.GET_ONE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getExpiredRegistration = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const result = await vehicleService.getExpiredRegistration({
      page,
      limit,
    });

    return ApiResponse.success(
      res,
      result,
      VEHICLE_MESSAGES.GET_EXPIRED_REGISTRATION_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getExpiredInsurance = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const result = await vehicleService.getExpiredInsurance({
      page,
      limit,
    });

    return ApiResponse.success(
      res,
      result,
      VEHICLE_MESSAGES.GET_EXPIRED_INSURANCE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const vehicle = await vehicleService.updateById(
      req.params.vehicleId,
      req.body,
    );

    return ApiResponse.success(res, vehicle, VEHICLE_MESSAGES.UPDATE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const changeStatus = async (req, res, next) => {
  try {
    const vehicle = await vehicleService.changeStatus(
      req.params.vehicleId,
      req.body.status,
      null,
      req.user,
    );

    return ApiResponse.success(
      res,
      vehicle,
      VEHICLE_MESSAGES.CHANGE_STATUS_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const updateOdometer = async (req, res, next) => {
  try {
    const vehicle = await vehicleService.updateOdometer(
      req.params.vehicleId,
      req.body.newOdo,
      null,
      req.user,
    );

    return ApiResponse.success(
      res,
      vehicle,
      VEHICLE_MESSAGES.UPDATE_ODOMETER_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const renewRegistration = async (req, res, next) => {
  try {
    const vehicle = await vehicleService.renewRegistration(
      req.params.vehicleId,
      req.body.newExpiryDate,
    );

    return ApiResponse.success(
      res,
      vehicle,
      VEHICLE_MESSAGES.RENEW_REGISTRATION_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const renewInsurance = async (req, res, next) => {
  try {
    const vehicle = await vehicleService.renewInsurance(
      req.params.vehicleId,
      req.body.newExpiryDate,
    );

    return ApiResponse.success(
      res,
      vehicle,
      VEHICLE_MESSAGES.RENEW_INSURANCE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

// ==========================================
// VEHICLE USAGE LOG CONTROLLERS
// ==========================================

const createUsageLog = async (req, res, next) => {
  try {
    const log = await vehicleService.createUsageLog(req.body, req.user);

    return ApiResponse.created(res, log, VEHICLE_MESSAGES.CHECK_IN_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getUsageLogs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const { vehicleId, driverId, tripId, startDate, endDate } = req.query;

    const filter = {};
    if (vehicleId) {
      filter.vehicleId = vehicleId;
    }

    if (driverId) {
      filter.driverId = driverId;
    }

    if (tripId) {
      filter.tripId = tripId;
    }

    if (startDate || endDate) {
      filter.startTime = {};
      if (startDate) {
        filter.startTime.$gte = new Date(startDate);
      }

      if (endDate) {
        filter.startTime.$lte = new Date(endDate);
      }
    }

    const result = await vehicleService.getUsageLogs({
      filter,
      page,
      limit,
      user: req.user,
    });

    return ApiResponse.success(
      res,
      result,
      VEHICLE_MESSAGES.GET_ALL_LOGS_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getUsageLogById = async (req, res, next) => {
  try {
    const log = await vehicleService.getUsageLogById(
      req.params.logId,
      req.user,
    );

    return ApiResponse.success(res, log, VEHICLE_MESSAGES.GET_LOG_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getUsageLogsByVehicleId = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const result = await vehicleService.getUsageLogsByVehicleId({
      vehicleId: req.params.vehicleId,
      page,
      limit,
      user: req.user,
    });

    return ApiResponse.success(
      res,
      result,
      VEHICLE_MESSAGES.GET_LOGS_BY_VEHICLE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getUsageLogsByDriverId = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const result = await vehicleService.getUsageLogsByDriverId({
      driverId: req.params.driverId,
      page,
      limit,
      user: req.user,
    });

    return ApiResponse.success(
      res,
      result,
      VEHICLE_MESSAGES.GET_LOGS_BY_DRIVER_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getUsageLogsByTripId = async (req, res, next) => {
  try {
    const logs = await vehicleService.getUsageLogsByTripId({
      tripId: req.params.tripId,
      user: req.user,
    });

    return ApiResponse.success(
      res,
      logs,
      VEHICLE_MESSAGES.GET_LOGS_BY_TRIP_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getVehicleUsageStats = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const stats = await vehicleService.getVehicleUsageStats({
      vehicleId: req.params.vehicleId,
      startDate,
      endDate,
      user: req.user,
    });

    return ApiResponse.success(res, stats, VEHICLE_MESSAGES.GET_STATS_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const updateUsageLog = async (req, res, next) => {
  try {
    const log = await vehicleService.updateUsageLogById(
      req.params.logId,
      req.body,
      null,
      req.user,
    );

    return ApiResponse.success(res, log, VEHICLE_MESSAGES.UPDATE_LOG_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const checkOutUsageLog = async (req, res, next) => {
  try {
    const log = await vehicleService.checkOutUsageLog({
      logId: req.params.logId,
      ...req.body,
      user: req.user,
    });

    return ApiResponse.success(res, log, VEHICLE_MESSAGES.CHECK_OUT_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const removeUsageLog = async (req, res, next) => {
  try {
    const log = await vehicleService.deleteUsageLogById(
      req.params.logId,
      req.user,
    );

    return ApiResponse.success(res, log, VEHICLE_MESSAGES.DELETE_LOG_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const restoreUsageLog = async (req, res, next) => {
  try {
    const log = await vehicleService.restoreUsageLogById(
      req.params.logId,
      req.user,
    );

    return ApiResponse.success(res, log, VEHICLE_MESSAGES.RESTORE_LOG_SUCCESS);
  } catch (error) {
    next(error);
  }
};

export default {
  // Vehicle Type
  createType,
  getActiveTypes,
  getDeletedTypes,
  getTypeById,
  getTypeByName,
  updateType,
  removeType,
  restoreType,

  // Vehicle Core
  create,
  getAll,
  getById,
  getByPlateNumber,
  getExpiredRegistration,
  getExpiredInsurance,
  update,
  changeStatus,
  updateOdometer,
  renewRegistration,
  renewInsurance,

  // Vehicle Usage Log
  createUsageLog,
  getUsageLogs,
  getUsageLogById,
  getUsageLogsByVehicleId,
  getUsageLogsByDriverId,
  getUsageLogsByTripId,
  getVehicleUsageStats,
  updateUsageLog,
  checkOutUsageLog,
  removeUsageLog,
  restoreUsageLog,
};
