import { STAFF_MESSAGES } from "../../constants/messages.js";

import ApiResponse from "../../utils/ApiResponse.js";

import staffService from "./staff.service.js";

const create = async (req, res, next) => {
  try {
    const staff = await staffService.create(req.body);

    return ApiResponse.created(res, staff, STAFF_MESSAGES.CREATE_SUCCESS);
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

    const result = await staffService.getAll({
      filter,
      page,
      limit,
      search,
    });

    return ApiResponse.success(res, result, STAFF_MESSAGES.GET_ALL_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const staff = await staffService.getById(req.params.staffId);

    return ApiResponse.success(res, staff, STAFF_MESSAGES.GET_ONE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getByUserId = async (req, res, next) => {
  try {
    const staff = await staffService.getByUserId(req.params.userId);

    return ApiResponse.success(res, staff, STAFF_MESSAGES.GET_ONE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getByCode = async (req, res, next) => {
  try {
    const staff = await staffService.getByCode(req.params.staffCode);

    return ApiResponse.success(res, staff, STAFF_MESSAGES.GET_ONE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const updateById = async (req, res, next) => {
  try {
    const staff = await staffService.updateById(req.params.staffId, req.body);

    return ApiResponse.success(res, staff, STAFF_MESSAGES.UPDATE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const deleteById = async (req, res, next) => {
  try {
    const staff = await staffService.deleteById(req.params.staffId);

    return ApiResponse.success(res, staff, STAFF_MESSAGES.DELETE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const restoreById = async (req, res, next) => {
  try {
    const staff = await staffService.restoreById(req.params.staffId);

    return ApiResponse.success(res, staff, STAFF_MESSAGES.RESTORE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const transferWarehouse = async (req, res, next) => {
  try {
    const staff = await staffService.transferWarehouse(
      req.params.staffId,
      req.body.warehouseId,
    );

    return ApiResponse.success(
      res,
      staff,
      STAFF_MESSAGES.TRANSFER_WAREHOUSE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getMyProfile = async (req, res, next) => {
  try {
    const profile = await staffService.getMyProfile(req.user.userId);

    return ApiResponse.success(
      res,
      profile,
      STAFF_MESSAGES.GET_PROFILE_SUCCESS,
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
};
