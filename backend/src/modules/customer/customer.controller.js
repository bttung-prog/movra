import { CUSTOMER_MESSAGES } from "../../constants/messages.js";

import ApiResponse from "../../utils/ApiResponse.js";

import customerService from "./customer.service.js";

const getAll = async (req, res, next) => {
  try {
    const { page, limit, search } = req.query;
    const filter = {};

    const result = await customerService.getAll({
      filter,
      page,
      limit,
      search,
    });

    return ApiResponse.success(res, result, CUSTOMER_MESSAGES.GET_ALL_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const customer = await customerService.getById(req.params.customerId);

    return ApiResponse.success(
      res,
      customer,
      CUSTOMER_MESSAGES.GET_ONE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getMyProfile = async (req, res, next) => {
  try {
    const customer = await customerService.getByUserId(req.user.userId);

    return ApiResponse.success(
      res,
      customer,
      CUSTOMER_MESSAGES.GET_PROFILE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const updatedCustomer = await customerService.updateById(
      req.params.customerId,
      req.body,
    );

    return ApiResponse.success(
      res,
      updatedCustomer,
      CUSTOMER_MESSAGES.UPDATE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const updateMyProfile = async (req, res, next) => {
  try {
    const updatedCustomer = await customerService.updateByUserId(
      req.user.userId,
      req.body,
    );

    return ApiResponse.success(
      res,
      updatedCustomer,
      CUSTOMER_MESSAGES.UPDATE_PROFILE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

export default {
  getAll,
  getById,
  getMyProfile,
  update,
  updateMyProfile,
};
