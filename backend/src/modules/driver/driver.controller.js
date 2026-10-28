import { DRIVER_MESSAGES } from "../../constants/messages.js";

import ApiResponse from "../../utils/ApiResponse.js";

import driverService from "./driver.service.js";

const create = async (req, res, next) => {
  try {
    const driver = await driverService.create(req.body);

    return ApiResponse.created(res, driver, DRIVER_MESSAGES.CREATE_SUCCESS);
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

    if (req.query.warehouseId) {
      filter.warehouseId = req.query.warehouseId;
    }

    const result = await driverService.getAll({
      filter,
      page,
      limit,
      user: req.user,
    });

    return ApiResponse.success(res, result, DRIVER_MESSAGES.GET_ALL_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const driver = await driverService.getById(req.params.driverId, req.user);

    return ApiResponse.success(res, driver, DRIVER_MESSAGES.GET_ONE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const driver = await driverService.updateById(
      req.params.driverId,
      req.body,
    );

    return ApiResponse.success(res, driver, DRIVER_MESSAGES.UPDATE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const driver = await driverService.deleteById(req.params.driverId);

    return ApiResponse.success(res, driver, DRIVER_MESSAGES.DELETE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getByCode = async (req, res, next) => {
  try {
    const driver = await driverService.getByCode(
      req.params.driverCode,
      req.user,
    );

    return ApiResponse.success(res, driver, DRIVER_MESSAGES.GET_ONE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getMyProfile = async (req, res, next) => {
  try {
    const driver = await driverService.getByUserId(req.user.userId);

    return ApiResponse.success(
      res,
      driver,
      DRIVER_MESSAGES.GET_PROFILE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const renewLicense = async (req, res, next) => {
  try {
    const driver = await driverService.renewLicense(
      req.params.driverId,
      req.body.newExpiryDate,
    );

    return ApiResponse.success(
      res,
      driver,
      DRIVER_MESSAGES.RENEW_LICENSE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

export default {
  create,
  getAll,
  getById,
  getMyProfile,
  update,
  remove,
  getByCode,
  renewLicense,
};
