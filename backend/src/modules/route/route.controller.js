import { ROUTE_MESSAGES } from "../../constants/messages.js";

import ApiResponse from "../../utils/ApiResponse.js";

import routeService from "./route.service.js";

const create = async (req, res, next) => {
  try {
    const route = await routeService.create(req.body);

    return ApiResponse.created(res, route, ROUTE_MESSAGES.CREATE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getAll = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;

    const filter = {};

    if (req.query.originWarehouseId) {
      filter.originWarehouseId = req.query.originWarehouseId;
    }

    if (req.query.destinationWarehouseId) {
      filter.destinationWarehouseId = req.query.destinationWarehouseId;
    }

    const result = await routeService.getAll({ filter, page, limit });

    return ApiResponse.success(res, result, ROUTE_MESSAGES.GET_ALL_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const route = await routeService.getById(req.params.routeId);

    return ApiResponse.success(res, route, ROUTE_MESSAGES.GET_ONE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const updateById = async (req, res, next) => {
  try {
    const route = await routeService.updateById(req.params.routeId, req.body);

    return ApiResponse.success(res, route, ROUTE_MESSAGES.UPDATE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const deleteById = async (req, res, next) => {
  try {
    const route = await routeService.deleteById(req.params.routeId);

    return ApiResponse.success(res, route, ROUTE_MESSAGES.DELETE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const restoreById = async (req, res, next) => {
  try {
    const route = await routeService.restoreById(req.params.routeId);

    return ApiResponse.success(res, route, ROUTE_MESSAGES.RESTORE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

export default {
  create,
  getAll,
  getById,
  updateById,
  deleteById,
  restoreById,
};
