import { WAREHOUSE_MESSAGES } from "../../constants/messages.js";

import ApiResponse from "../../utils/ApiResponse.js";

import warehouseService from "./warehouse.service.js";

const create = async (req, res, next) => {
  try {
    const warehouse = await warehouseService.create(req.body);

    return ApiResponse.created(
      res,
      warehouse,
      WAREHOUSE_MESSAGES.CREATE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getAll = async (req, res, next) => {
  try {
    const result = await warehouseService.getAll(req.query, req.user);

    return ApiResponse.success(res, result, WAREHOUSE_MESSAGES.GET_ALL_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const warehouse = await warehouseService.getById(
      req.params.warehouseId,
      true,
      false,
      req.user,
    );

    return ApiResponse.success(
      res,
      warehouse,
      WAREHOUSE_MESSAGES.GET_ONE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const updateById = async (req, res, next) => {
  try {
    const warehouse = await warehouseService.updateById(
      req.params.warehouseId,
      req.body,
    );

    return ApiResponse.success(
      res,
      warehouse,
      WAREHOUSE_MESSAGES.UPDATE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const updateManager = async (req, res, next) => {
  try {
    const warehouse = await warehouseService.updateManager(
      req.params.warehouseId,
      req.body.managerId,
    );

    return ApiResponse.success(
      res,
      warehouse,
      WAREHOUSE_MESSAGES.UPDATE_MANAGER_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const changeStatus = async (req, res, next) => {
  try {
    const warehouse = await warehouseService.changeStatus(
      req.params.warehouseId,
      req.body.status,
    );

    return ApiResponse.success(
      res,
      warehouse,
      WAREHOUSE_MESSAGES.CHANGE_STATUS_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const softDelete = async (req, res, next) => {
  try {
    const warehouse = await warehouseService.softDelete(req.params.warehouseId);

    return ApiResponse.success(
      res,
      warehouse,
      WAREHOUSE_MESSAGES.DELETE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const restore = async (req, res, next) => {
  try {
    const warehouse = await warehouseService.restore(req.params.warehouseId);

    return ApiResponse.success(
      res,
      warehouse,
      WAREHOUSE_MESSAGES.RESTORE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

export default {
  create,
  getAll,
  getById,
  updateById,
  updateManager,
  changeStatus,
  softDelete,
  restore,
};
