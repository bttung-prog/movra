import ROLES from "../../constants/roles.js";
import { INVOICE_MESSAGES } from "../../constants/messages.js";

import ApiResponse from "../../utils/ApiResponse.js";
import { escapeRegex } from "../../utils/regexUtils.js";

import invoiceService from "./invoice.service.js";

const create = async (req, res, next) => {
  try {
    const payload = {
      ...req.body,
      issuedBy: req.user.userId,
    };

    if (req.user.role === ROLES.CUSTOMER && req.user.customerId) {
      payload.customerId = req.user.customerId;
    }

    const invoice = await invoiceService.create(payload, null, req.user);
    return ApiResponse.created(res, invoice, INVOICE_MESSAGES.CREATE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getAll = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const {
      search,
      status,
      customerId,
      orderId,
      startDate,
      endDate,
      isOverdue,
    } = req.query;

    const filter = {};

    if (search) {
      const escapedSearch = escapeRegex(search.trim());
      filter.$or = [
        { invoiceCode: { $regex: escapedSearch, $options: "i" } },
        { notes: { $regex: escapedSearch, $options: "i" } },
      ];
    }

    if (status) {
      filter.status = status;
    }

    if (customerId) {
      filter.customerId = customerId;
    }

    if (orderId) {
      filter.orderId = orderId;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    if (isOverdue === "true" || isOverdue === true) {
      filter.status = { $in: ["issued", "partially_paid"] };
      filter.dueDate = { $lt: new Date() };
    }

    const result = await invoiceService.getAll({
      filter,
      page,
      limit,
      actor: req.user,
    });
    return ApiResponse.success(res, result, INVOICE_MESSAGES.GET_ALL_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getMyInvoices = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const { status, isOverdue } = req.query;

    const filter = {
      customerId: req.user.customerId,
    };

    if (status) {
      filter.status = status;
    }

    if (isOverdue === "true" || isOverdue === true) {
      filter.status = { $in: ["issued", "partially_paid"] };
      filter.dueDate = { $lt: new Date() };
    }

    const result = await invoiceService.getAll({ filter, page, limit });
    return ApiResponse.success(res, result, INVOICE_MESSAGES.GET_ALL_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const { invoiceId } = req.params;
    const invoice = await invoiceService.getById(invoiceId, req.user);
    return ApiResponse.success(res, invoice, INVOICE_MESSAGES.GET_ONE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getByCode = async (req, res, next) => {
  try {
    const { invoiceCode } = req.params;
    const invoice = await invoiceService.getByCode(invoiceCode, req.user);
    return ApiResponse.success(res, invoice, INVOICE_MESSAGES.GET_ONE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const issue = async (req, res, next) => {
  try {
    const { invoiceId } = req.params;
    const issuedBy = req.user.userId;
    const invoice = await invoiceService.issueInvoice(
      invoiceId,
      issuedBy,
      req.user,
    );
    return ApiResponse.success(res, invoice, INVOICE_MESSAGES.ISSUE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const updateById = async (req, res, next) => {
  try {
    const { invoiceId } = req.params;
    const invoice = await invoiceService.updateById(
      invoiceId,
      req.body,
      req.user,
    );
    return ApiResponse.success(res, invoice, INVOICE_MESSAGES.UPDATE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const cancel = async (req, res, next) => {
  try {
    const { invoiceId } = req.params;
    const { reason } = req.body;
    const invoice = await invoiceService.cancelInvoice(
      invoiceId,
      reason,
      req.user,
    );
    return ApiResponse.success(res, invoice, INVOICE_MESSAGES.CANCEL_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getStats = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.customerId) {
      filter.customerId = req.query.customerId;
    }
    const stats = await invoiceService.getStats(filter, req.user);
    return ApiResponse.success(res, stats, INVOICE_MESSAGES.GET_STATS_SUCCESS);
  } catch (error) {
    next(error);
  }
};

export default {
  create,
  getAll,
  getMyInvoices,
  getById,
  getByCode,
  issue,
  updateById,
  cancel,
  getStats,
};
