import { INVENTORY_MESSAGES } from "../../constants/messages.js";

import ApiResponse from "../../utils/ApiResponse.js";

import inventoryService from "./inventory.service.js";

const getAll = async (req, res, next) => {
  try {
    const result = await inventoryService.getAll(req.query, req.user);

    return ApiResponse.success(res, result, INVENTORY_MESSAGES.GET_ALL_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const inventory = await inventoryService.getById(
      req.params.inventoryId,
      true,
      null,
      req.user,
    );

    return ApiResponse.success(
      res,
      inventory,
      INVENTORY_MESSAGES.GET_ONE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getByOrderId = async (req, res, next) => {
  try {
    const inventory = await inventoryService.getByOrderId(
      req.params.orderId,
      null,
      req.user,
    );

    return ApiResponse.success(
      res,
      inventory,
      INVENTORY_MESSAGES.GET_ONE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getSummary = async (req, res, next) => {
  try {
    const summary = await inventoryService.getSummary(null, req.user);

    return ApiResponse.success(
      res,
      summary,
      INVENTORY_MESSAGES.GET_SUMMARY_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const updateLocation = async (req, res, next) => {
  try {
    const inventory = await inventoryService.updateLocation(
      req.params.inventoryId,
      req.body.location,
      req.user,
    );

    return ApiResponse.success(
      res,
      inventory,
      INVENTORY_MESSAGES.UPDATE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const updateCondition = async (req, res, next) => {
  try {
    const inventory = await inventoryService.updateConditionById(
      req.params.inventoryId,
      req.body.condition,
      req.user,
    );

    return ApiResponse.success(
      res,
      inventory,
      INVENTORY_MESSAGES.UPDATE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

export default {
  getAll,
  getById,
  getByOrderId,
  getSummary,
  updateLocation,
  updateCondition,
};
