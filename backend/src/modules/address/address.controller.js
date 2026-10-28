import { ADDRESS_MESSAGES } from "../../constants/messages.js";

import ApiResponse from "../../utils/ApiResponse.js";

import addressService from "./address.service.js";

const create = async (req, res, next) => {
  try {
    const newAddress = await addressService.create(
      req.user.customerId,
      req.body,
    );

    return ApiResponse.success(
      res,
      newAddress,
      ADDRESS_MESSAGES.CREATE_SUCCESS,
      201,
    );
  } catch (error) {
    next(error);
  }
};

const getMy = async (req, res, next) => {
  try {
    const addresses = await addressService.getByCustomerId(req.user.customerId);

    return ApiResponse.success(
      res,
      addresses,
      ADDRESS_MESSAGES.GET_ALL_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const address = await addressService.getById(
      req.params.addressId,
      req.user.customerId,
    );

    return ApiResponse.success(res, address, ADDRESS_MESSAGES.GET_ONE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const updatedAddress = await addressService.updateById(
      req.params.addressId,
      req.body,
      req.user.customerId,
    );

    return ApiResponse.success(
      res,
      updatedAddress,
      ADDRESS_MESSAGES.UPDATE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    await addressService.deleteById(req.params.addressId, req.user.customerId);

    return ApiResponse.success(res, null, ADDRESS_MESSAGES.DELETE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const setDefault = async (req, res, next) => {
  try {
    const updatedAddress = await addressService.setDefault(
      req.params.addressId,
      req.user.customerId,
    );

    return ApiResponse.success(
      res,
      updatedAddress,
      ADDRESS_MESSAGES.SET_DEFAULT_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

export default {
  create,
  getMy,
  getById,
  update,
  remove,
  setDefault,
};
