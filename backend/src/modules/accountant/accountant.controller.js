import { ACCOUNTANT_MESSAGES } from "../../constants/messages.js";

import ApiResponse from "../../utils/ApiResponse.js";

import accountantService from "./accountant.service.js";

const create = async (req, res, next) => {
  try {
    const accountant = await accountantService.create(req.body);
    return ApiResponse.created(
      res,
      accountant,
      ACCOUNTANT_MESSAGES.CREATE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getAll = async (req, res, next) => {
  try {
    const result = await accountantService.getAll(req.query);
    return ApiResponse.success(
      res,
      result,
      ACCOUNTANT_MESSAGES.GET_ALL_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const accountant = await accountantService.getById(req.params.accountantId);
    return ApiResponse.success(
      res,
      accountant,
      ACCOUNTANT_MESSAGES.GET_ONE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getByUserId = async (req, res, next) => {
  try {
    const accountant = await accountantService.getByUserId(req.params.userId);
    return ApiResponse.success(
      res,
      accountant,
      ACCOUNTANT_MESSAGES.GET_ONE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getByCode = async (req, res, next) => {
  try {
    const accountant = await accountantService.getByCode(
      req.params.accountantCode,
    );
    return ApiResponse.success(
      res,
      accountant,
      ACCOUNTANT_MESSAGES.GET_ONE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getMyProfile = async (req, res, next) => {
  try {
    const accountant = await accountantService.getMyProfile(req.user.userId);
    return ApiResponse.success(
      res,
      accountant,
      ACCOUNTANT_MESSAGES.GET_PROFILE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const accountant = await accountantService.updateStatus(
      req.params.accountantId,
      req.body.status,
    );
    return ApiResponse.success(
      res,
      accountant,
      ACCOUNTANT_MESSAGES.UPDATE_STATUS_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const deleteById = async (req, res, next) => {
  try {
    const accountant = await accountantService.deleteById(
      req.params.accountantId,
    );
    return ApiResponse.success(
      res,
      accountant,
      ACCOUNTANT_MESSAGES.DELETE_SUCCESS,
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
  updateStatus,
  deleteById,
};
