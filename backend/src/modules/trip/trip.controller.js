import { TRIP_MESSAGES } from "../../constants/messages.js";

import ApiResponse from "../../utils/ApiResponse.js";

import tripService from "./trip.service.js";

const create = async (req, res, next) => {
  try {
    const trip = await tripService.create({ ...req.body, user: req.user });

    return ApiResponse.created(res, trip, TRIP_MESSAGES.CREATE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getAll = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;

    const filter = {};

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.type) {
      filter.type = req.query.type;
    }

    if (req.query.vehicleId) {
      filter.vehicleId = req.query.vehicleId;
    }

    if (req.query.driverId) {
      filter.driverId = req.query.driverId;
    }

    if (req.query.routeId) {
      filter.routeId = req.query.routeId;
    }

    if (req.query.tripCode) {
      filter.tripCode = req.query.tripCode.trim();
    }

    const result = await tripService.getAll({
      filter,
      page,
      limit,
      user: req.user,
    });

    return ApiResponse.success(res, result, TRIP_MESSAGES.GET_ALL_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const trip = await tripService.getById(req.params.tripId, true, req.user);

    return ApiResponse.success(res, trip, TRIP_MESSAGES.GET_ONE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getByCode = async (req, res, next) => {
  try {
    const trip = await tripService.getByCode(req.params.tripCode, req.user);

    return ApiResponse.success(res, trip, TRIP_MESSAGES.GET_BY_CODE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const updateById = async (req, res, next) => {
  try {
    const trip = await tripService.updateById(
      req.params.tripId,
      req.body,
      req.user,
    );

    return ApiResponse.success(res, trip, TRIP_MESSAGES.UPDATE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const deleteById = async (req, res, next) => {
  try {
    const trip = await tripService.deleteById(req.params.tripId, req.user);

    return ApiResponse.success(res, trip, TRIP_MESSAGES.DELETE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const restoreById = async (req, res, next) => {
  try {
    const trip = await tripService.restoreById(req.params.tripId, req.user);

    return ApiResponse.success(res, trip, TRIP_MESSAGES.RESTORE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const reassign = async (req, res, next) => {
  try {
    const result = await tripService.reassign(
      req.params.tripId,
      {
        ...req.body,
        changedBy: req.user.userId,
      },
      req.user,
    );

    return ApiResponse.success(res, result, TRIP_MESSAGES.REASSIGN_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getAssignmentsByTripId = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;

    const result = await tripService.getAssignmentsByTripId(
      req.params.tripId,
      {
        page,
        limit,
      },
      req.user,
    );

    return ApiResponse.success(
      res,
      result,
      TRIP_MESSAGES.GET_ASSIGNMENTS_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const addTrackingLog = async (req, res, next) => {
  try {
    const log = await tripService.addTrackingLog(
      req.params.tripId,
      {
        ...req.body,
        reportedBy: req.user.userId,
      },
      req.user,
    );

    return ApiResponse.created(res, log, TRIP_MESSAGES.ADD_LOG_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getTrackingLogsByTripId = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;

    const result = await tripService.getTrackingLogsByTripId(
      req.params.tripId,
      { page, limit, user: req.user },
    );

    return ApiResponse.success(res, result, TRIP_MESSAGES.GET_LOGS_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getLatestTrackingLog = async (req, res, next) => {
  try {
    const log = await tripService.getLatestTrackingLog(
      req.params.tripId,
      req.user,
    );

    return ApiResponse.success(res, log, TRIP_MESSAGES.GET_LATEST_LOG_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getAuditLogsByTripId = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;

    const result = await tripService.getAuditLogsByTripId(req.params.tripId, {
      page,
      limit,
      user: req.user,
    });

    return ApiResponse.success(
      res,
      result,
      TRIP_MESSAGES.GET_AUDIT_LOGS_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const addExpense = async (req, res, next) => {
  try {
    const expense = await tripService.addExpense(
      req.params.tripId,
      {
        ...req.body,
        createdBy: req.user.userId,
      },
      req.user,
    );

    return ApiResponse.created(res, expense, TRIP_MESSAGES.ADD_EXPENSE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getExpensesByTripId = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;

    const result = await tripService.getExpensesByTripId(req.params.tripId, {
      page,
      limit,
      user: req.user,
    });

    return ApiResponse.success(res, result, TRIP_MESSAGES.GET_EXPENSES_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getTotalExpensesByTripId = async (req, res, next) => {
  try {
    const result = await tripService.getTotalExpensesByTripId(
      req.params.tripId,
      req.user,
    );

    return ApiResponse.success(
      res,
      result,
      TRIP_MESSAGES.GET_TOTAL_EXPENSES_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const updateExpenseById = async (req, res, next) => {
  try {
    const expense = await tripService.updateExpenseById(
      req.params.expenseId,
      req.body,
      req.user,
    );

    return ApiResponse.success(
      res,
      expense,
      TRIP_MESSAGES.UPDATE_EXPENSE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const deleteExpenseById = async (req, res, next) => {
  try {
    const expense = await tripService.deleteExpenseById(
      req.params.expenseId,
      req.user,
    );

    return ApiResponse.success(
      res,
      expense,
      TRIP_MESSAGES.DELETE_EXPENSE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

export default {
  create,
  getAll,
  getById,
  getByCode,
  updateById,
  deleteById,
  restoreById,

  reassign,
  getAssignmentsByTripId,

  addTrackingLog,
  getTrackingLogsByTripId,
  getLatestTrackingLog,
  getAuditLogsByTripId,

  addExpense,
  getExpensesByTripId,
  getTotalExpensesByTripId,
  updateExpenseById,
  deleteExpenseById,
};
