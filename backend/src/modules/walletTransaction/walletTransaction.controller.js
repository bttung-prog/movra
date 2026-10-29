import { WALLET_TRANSACTION_MESSAGES } from "../../constants/messages.js";

import ApiResponse from "../../utils/ApiResponse.js";

import walletTransactionService from "./walletTransaction.service.js";

const topUp = async (req, res, next) => {
  try {
    const actor = {
      userId: req.user.userId,
      role: req.user.role,
      customerId: req.user.customerId,
    };

    const result = await walletTransactionService.topUp(req.body, actor);
    return ApiResponse.created(
      res,
      result,
      WALLET_TRANSACTION_MESSAGES.TOPUP_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const adjustWallet = async (req, res, next) => {
  try {
    const actor = {
      userId: req.user.userId,
      role: req.user.role,
    };

    const result = await walletTransactionService.adjustWallet(req.body, actor);

    return ApiResponse.created(
      res,
      result,
      WALLET_TRANSACTION_MESSAGES.ADJUSTMENT_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getMyTransactions = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const { type, status, startDate, endDate } = req.query;

    const filter = {
      customerId: req.user.customerId,
    };

    if (type) filter.type = type;
    if (status) filter.status = status;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const result = await walletTransactionService.getAll({
      filter,
      page,
      limit,
    });
    return ApiResponse.success(
      res,
      result,
      WALLET_TRANSACTION_MESSAGES.GET_ALL_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getAll = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const { customerId, type, status, startDate, endDate } = req.query;

    const filter = {};
    if (customerId) filter.customerId = customerId;
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const result = await walletTransactionService.getAll({
      filter,
      page,
      limit,
    });
    return ApiResponse.success(
      res,
      result,
      WALLET_TRANSACTION_MESSAGES.GET_ALL_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const transaction = await walletTransactionService.getById(id, req.user);
    return ApiResponse.success(
      res,
      transaction,
      WALLET_TRANSACTION_MESSAGES.GET_ONE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getByCode = async (req, res, next) => {
  try {
    const { code } = req.params;
    const transaction = await walletTransactionService.getByCode(
      code,
      req.user,
    );
    return ApiResponse.success(
      res,
      transaction,
      WALLET_TRANSACTION_MESSAGES.GET_ONE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

export default {
  topUp,
  adjustWallet,
  getMyTransactions,
  getAll,
  getById,
  getByCode,
};
