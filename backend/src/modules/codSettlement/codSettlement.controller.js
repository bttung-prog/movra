import { COD_SETTLEMENT_MESSAGES } from "../../constants/messages.js";

import ApiResponse from "../../utils/ApiResponse.js";
import { toEndOfDay } from "../../utils/dateUtils.js";

import codSettlementService from "./codSettlement.service.js";

const generate = async (req, res, next) => {
  try {
    const actor = {
      userId: req.user.userId,
      role: req.user.role,
    };

    const settlement = await codSettlementService.generateSettlement(
      req.body,
      actor,
    );
    return ApiResponse.created(
      res,
      settlement,
      COD_SETTLEMENT_MESSAGES.CREATE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const confirm = async (req, res, next) => {
  try {
    const { id: settlementId } = req.params;
    const actor = {
      userId: req.user.userId,
      role: req.user.role,
    };

    const settlement = await codSettlementService.confirmSettlement(
      settlementId,
      actor,
    );
    return ApiResponse.success(
      res,
      settlement,
      COD_SETTLEMENT_MESSAGES.CONFIRM_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const complete = async (req, res, next) => {
  try {
    const { id: settlementId } = req.params;
    const actor = {
      userId: req.user.userId,
      role: req.user.role,
    };

    const settlement = await codSettlementService.completeSettlement(
      settlementId,
      req.body,
      actor,
    );
    return ApiResponse.success(
      res,
      settlement,
      COD_SETTLEMENT_MESSAGES.COMPLETE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const cancel = async (req, res, next) => {
  try {
    const { id: settlementId } = req.params;
    const { reason } = req.body;
    const actor = {
      userId: req.user.userId,
      role: req.user.role,
    };

    const settlement = await codSettlementService.cancelSettlement(
      settlementId,
      reason,
      actor,
    );
    return ApiResponse.success(
      res,
      settlement,
      COD_SETTLEMENT_MESSAGES.CANCEL_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getAll = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const { customerId, status, payoutMethod, startDate, endDate } = req.query;

    const filter = {};
    if (customerId) filter.customerId = customerId;
    if (status) filter.status = status;
    if (payoutMethod) filter.payoutMethod = payoutMethod;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = toEndOfDay(endDate);
    }

    const result = await codSettlementService.getAll({
      filter,
      page,
      limit,
      actor: {
        userId: req.user.userId,
        role: req.user.role,
        warehouseId: req.user.warehouseId,
      },
    });
    return ApiResponse.success(
      res,
      result,
      COD_SETTLEMENT_MESSAGES.GET_ALL_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getMySettlements = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const { status, payoutMethod, startDate, endDate } = req.query;

    const filter = {
      customerId: req.user.customerId,
    };

    if (status) filter.status = status;
    if (payoutMethod) filter.payoutMethod = payoutMethod;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = toEndOfDay(endDate);
    }

    const result = await codSettlementService.getAll({ filter, page, limit });
    return ApiResponse.success(
      res,
      result,
      COD_SETTLEMENT_MESSAGES.GET_MY_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const { id: settlementId } = req.params;
    const settlement = await codSettlementService.getById(
      settlementId,
      req.user,
    );
    return ApiResponse.success(
      res,
      settlement,
      COD_SETTLEMENT_MESSAGES.GET_ONE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getByCode = async (req, res, next) => {
  try {
    const { code } = req.params;
    const settlement = await codSettlementService.getByCode(code, req.user);
    return ApiResponse.success(
      res,
      settlement,
      COD_SETTLEMENT_MESSAGES.GET_ONE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

export default {
  generate,
  confirm,
  complete,
  cancel,
  getAll,
  getMySettlements,
  getById,
  getByCode,
};
