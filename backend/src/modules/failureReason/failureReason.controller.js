import ROLES from "../../constants/roles.js";
import { FAILURE_REASON_MESSAGES } from "../../constants/messages.js";

import ApiResponse from "../../utils/ApiResponse.js";

import failureReasonService from "./failureReason.service.js";

const create = async (req, res, next) => {
  try {
    const reportedBy =
      req.user.role !== ROLES.ADMIN
        ? req.user.userId
        : req.body.reportedBy || req.user.userId;

    const failureLog = await failureReasonService.create({
      ...req.body,
      reportedBy,
      user: req.user,
    });

    return ApiResponse.created(
      res,
      failureLog,
      FAILURE_REASON_MESSAGES.CREATE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getAll = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const {
      failureReasonType,
      orderId,
      tripId,
      reportedBy,
      startDate,
      endDate,
    } = req.query;

    const filter = {};
    if (failureReasonType) {
      filter.failureReasonType = failureReasonType;
    }
    if (orderId) {
      filter.orderId = orderId;
    }
    if (tripId) {
      filter.tripId = tripId;
    }

    if (req.user.role === ROLES.DRIVER) {
      filter.reportedBy = req.user.userId;
    } else if (reportedBy) {
      filter.reportedBy = reportedBy;
    }

    if (startDate) {
      filter.startDate = startDate;
    }
    if (endDate) {
      filter.endDate = endDate;
    }

    const result = await failureReasonService.getAll({
      filter,
      page,
      limit,
      user: req.user,
    });

    return ApiResponse.success(
      res,
      result,
      FAILURE_REASON_MESSAGES.GET_ALL_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const failureLog = await failureReasonService.getById(
      req.params.failureReasonId,
      req.user,
    );

    return ApiResponse.success(
      res,
      failureLog,
      FAILURE_REASON_MESSAGES.GET_ONE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getByOrderId = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const { orderId } = req.params;

    const result = await failureReasonService.getByOrderId({
      orderId,
      user: req.user,
      page,
      limit,
    });

    return ApiResponse.success(
      res,
      result,
      FAILURE_REASON_MESSAGES.GET_ORDER_LOGS_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getByTripId = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const { tripId } = req.params;

    const result = await failureReasonService.getByTripId({
      tripId,
      user: req.user,
      page,
      limit,
    });

    return ApiResponse.success(
      res,
      result,
      FAILURE_REASON_MESSAGES.GET_TRIP_LOGS_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getStatsByFailureType = async (req, res, next) => {
  try {
    const filter = { ...req.query };
    if (req.user.role === ROLES.DRIVER) {
      filter.reportedBy = req.user.userId;
    }

    const stats = await failureReasonService.getStatsByFailureType({
      filter,
      user: req.user,
    });

    return ApiResponse.success(
      res,
      stats,
      FAILURE_REASON_MESSAGES.GET_STATS_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const updateById = async (req, res, next) => {
  try {
    const failureLog = await failureReasonService.updateById({
      failureReasonId: req.params.failureReasonId,
      updateData: req.body,
      user: req.user,
    });

    return ApiResponse.success(
      res,
      failureLog,
      FAILURE_REASON_MESSAGES.UPDATE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const deleteById = async (req, res, next) => {
  try {
    const failureLog = await failureReasonService.deleteById({
      failureReasonId: req.params.failureReasonId,
    });

    return ApiResponse.success(
      res,
      failureLog,
      FAILURE_REASON_MESSAGES.DELETE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

export default {
  create,
  getAll,
  getById,
  getByOrderId,
  getByTripId,
  getStatsByFailureType,
  updateById,
  deleteById,
};
