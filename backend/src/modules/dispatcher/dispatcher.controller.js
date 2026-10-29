import { DISPATCHER_MESSAGES } from "../../constants/messages.js";

import ApiResponse from "../../utils/ApiResponse.js";

import dispatcherService from "./dispatcher.service.js";

const create = async (req, res, next) => {
  try {
    const dispatcher = await dispatcherService.create(req.body);

    return ApiResponse.created(
      res,
      dispatcher,
      DISPATCHER_MESSAGES.CREATE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getAll = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const search = req.query.search || "";

    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.warehouseId) {
      filter.warehouseId = req.query.warehouseId;
    }

    if (req.query.userId) {
      filter.userId = req.query.userId;
    }

    const result = await dispatcherService.getAll({
      filter,
      page,
      limit,
      search,
    });

    return ApiResponse.success(
      res,
      result,
      DISPATCHER_MESSAGES.GET_ALL_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const dispatcher = await dispatcherService.getById(req.params.dispatcherId);

    return ApiResponse.success(
      res,
      dispatcher,
      DISPATCHER_MESSAGES.GET_ONE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getByUserId = async (req, res, next) => {
  try {
    const dispatcher = await dispatcherService.getByUserId(req.params.userId);

    return ApiResponse.success(
      res,
      dispatcher,
      DISPATCHER_MESSAGES.GET_ONE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getByCode = async (req, res, next) => {
  try {
    const dispatcher = await dispatcherService.getByCode(
      req.params.dispatcherCode,
    );

    return ApiResponse.success(
      res,
      dispatcher,
      DISPATCHER_MESSAGES.GET_ONE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getMyProfile = async (req, res, next) => {
  try {
    const profile = await dispatcherService.getMyProfile(req.user.userId);

    return ApiResponse.success(
      res,
      profile,
      DISPATCHER_MESSAGES.GET_PROFILE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const updateById = async (req, res, next) => {
  try {
    const dispatcher = await dispatcherService.updateById(
      req.params.dispatcherId,
      req.body,
    );

    return ApiResponse.success(
      res,
      dispatcher,
      DISPATCHER_MESSAGES.UPDATE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const deleteById = async (req, res, next) => {
  try {
    const dispatcher = await dispatcherService.deleteById(
      req.params.dispatcherId,
    );

    return ApiResponse.success(
      res,
      dispatcher,
      DISPATCHER_MESSAGES.DELETE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const restoreById = async (req, res, next) => {
  try {
    const dispatcher = await dispatcherService.restoreById(
      req.params.dispatcherId,
    );

    return ApiResponse.success(
      res,
      dispatcher,
      DISPATCHER_MESSAGES.RESTORE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const transferWarehouse = async (req, res, next) => {
  try {
    const dispatcher = await dispatcherService.transferWarehouse(
      req.params.dispatcherId,
      req.body.warehouseId,
    );

    return ApiResponse.success(
      res,
      dispatcher,
      DISPATCHER_MESSAGES.TRANSFER_WAREHOUSE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const dispatcher = await dispatcherService.updateStatus(
      req.params.dispatcherId,
      req.body.status,
    );

    return ApiResponse.success(
      res,
      dispatcher,
      DISPATCHER_MESSAGES.UPDATE_STATUS_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getDashboardStats = async (req, res, next) => {
  try {
    const stats = await dispatcherService.getDashboardStats(
      req.user.userId,
      req.user,
    );

    return ApiResponse.success(
      res,
      stats,
      DISPATCHER_MESSAGES.GET_DASHBOARD_STATS_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getResources = async (req, res, next) => {
  try {
    const resources = await dispatcherService.getResources(
      req.user.userId,
      req.user,
      { page: req.query.page, limit: req.query.limit },
    );

    return ApiResponse.success(
      res,
      resources,
      DISPATCHER_MESSAGES.GET_RESOURCES_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

export default {
  create,
  getAll,
  getById,
  getByUserId,
  getByCode,
  getMyProfile,
  updateById,
  deleteById,
  restoreById,
  transferWarehouse,
  updateStatus,
  getDashboardStats,
  getResources,
};
