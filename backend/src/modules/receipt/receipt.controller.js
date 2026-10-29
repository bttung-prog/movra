import { RECEIPT_MESSAGES } from "../../constants/messages.js";

import ApiResponse from "../../utils/ApiResponse.js";

import receiptService from "./receipt.service.js";

const create = async (req, res, next) => {
  try {
    const receivedBy =
      req.user.role === "admin" && req.body.receivedBy
        ? req.body.receivedBy
        : req.user.userId;

    const receipt = await receiptService.create(
      {
        ...req.body,
        receivedBy,
      },
      req.user,
    );

    return ApiResponse.created(res, receipt, RECEIPT_MESSAGES.CREATE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getAll = async (req, res, next) => {
  try {
    const result = await receiptService.getAll(req.query, req.user);

    return ApiResponse.success(res, result, RECEIPT_MESSAGES.GET_ALL_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const receipt = await receiptService.getById(
      req.params.receiptId,
      req.user,
    );

    return ApiResponse.success(res, receipt, RECEIPT_MESSAGES.GET_ONE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getByOrderId = async (req, res, next) => {
  try {
    const receipt = await receiptService.getByOrderId(
      req.params.orderId,
      req.user,
    );

    return ApiResponse.success(res, receipt, RECEIPT_MESSAGES.GET_ONE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const updateById = async (req, res, next) => {
  try {
    const receipt = await receiptService.updateById(
      req.params.receiptId,
      req.body,
      req.user,
    );

    return ApiResponse.success(res, receipt, RECEIPT_MESSAGES.UPDATE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getByCode = async (req, res, next) => {
  try {
    const receipt = await receiptService.getByCode(
      req.params.receiptCode,
      req.user,
    );

    return ApiResponse.success(res, receipt, RECEIPT_MESSAGES.GET_ONE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const cancel = async (req, res, next) => {
  try {
    const receipt = await receiptService.cancel(
      req.params.receiptId,
      req.body,
      req.user,
    );

    return ApiResponse.success(res, receipt, RECEIPT_MESSAGES.CANCEL_SUCCESS);
  } catch (error) {
    next(error);
  }
};

export default {
  create,
  getAll,
  getById,
  getByCode,
  getByOrderId,
  cancel,
  updateById,
};
