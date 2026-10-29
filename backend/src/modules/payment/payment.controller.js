import ROLES from "../../constants/roles.js";
import { PAYMENT_MESSAGES } from "../../constants/messages.js";

import ApiResponse from "../../utils/ApiResponse.js";

import paymentService from "./payment.service.js";

const create = async (req, res, next) => {
  try {
    const actor = {
      userId: req.user.userId,
      role: req.user.role,
      customerId: req.user.customerId,
      warehouseId: req.user.warehouseId,
    };

    const payment = await paymentService.create(req.body, actor);
    return ApiResponse.created(res, payment, PAYMENT_MESSAGES.CREATE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const driverRemit = async (req, res, next) => {
  try {
    const driverUser = {
      userId: req.user.userId,
      driverId: req.user.driverId,
    };

    const payment = await paymentService.createDriverRemittance(
      req.body,
      driverUser,
      req.user,
    );
    return ApiResponse.created(
      res,
      payment,
      PAYMENT_MESSAGES.DRIVER_REMIT_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const verify = async (req, res, next) => {
  try {
    const { paymentId } = req.params;
    const verifierUser = {
      userId: req.user.userId,
      role: req.user.role,
      warehouseId: req.user.warehouseId,
    };

    const payment = await paymentService.verifyPayment(
      paymentId,
      req.body,
      verifierUser,
    );
    return ApiResponse.success(res, payment, PAYMENT_MESSAGES.VERIFY_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const refund = async (req, res, next) => {
  try {
    const { paymentId } = req.params;
    const actor = {
      userId: req.user.userId,
      role: req.user.role,
    };

    const payment = await paymentService.refundPayment(
      paymentId,
      req.body,
      actor,
    );
    return ApiResponse.success(res, payment, PAYMENT_MESSAGES.REFUND_SUCCESS);
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
      paymentStatus,
      paymentMethod,
      payerType,
      invoiceId,
      orderId,
      tripId,
      startDate,
      endDate,
    } = req.query;

    const filter = {};

    if (search) {
      filter.$or = [
        { paymentCode: { $regex: search, $options: "i" } },
        { transactionReference: { $regex: search, $options: "i" } },
        { notes: { $regex: search, $options: "i" } },
      ];
    }

    if (paymentStatus) {
      filter.paymentStatus = paymentStatus;
    }

    if (paymentMethod) {
      filter.paymentMethod = paymentMethod;
    }

    if (payerType) {
      filter.payerType = payerType;
    }

    if (invoiceId) {
      filter.invoiceId = invoiceId;
    }

    if (orderId) {
      filter.orderId = orderId;
    }

    if (tripId) {
      filter.tripId = tripId;
    }

    if (startDate || endDate) {
      filter.paymentDate = {};
      if (startDate) filter.paymentDate.$gte = new Date(startDate);
      if (endDate) filter.paymentDate.$lte = new Date(endDate);
    }

    const result = await paymentService.getAll({
      filter,
      page,
      limit,
      actor: req.user,
    });
    return ApiResponse.success(res, result, PAYMENT_MESSAGES.GET_ALL_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getMyPayments = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const { paymentStatus, paymentMethod } = req.query;

    const filter = {};

    if (req.user.role === ROLES.DRIVER) {
      filter.payerType = "driver";
      if (req.user.driverId) {
        filter.driverId = req.user.driverId;
      }
    } else if (req.user.role === ROLES.CUSTOMER) {
      if (req.user.customerId) {
        filter.customerId = req.user.customerId;
      }
    }

    if (paymentStatus) {
      filter.paymentStatus = paymentStatus;
    }

    if (paymentMethod) {
      filter.paymentMethod = paymentMethod;
    }

    const result = await paymentService.getAll({ filter, page, limit });
    return ApiResponse.success(res, result, PAYMENT_MESSAGES.GET_ALL_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const { paymentId } = req.params;
    const payment = await paymentService.getById(paymentId, req.user);
    return ApiResponse.success(res, payment, PAYMENT_MESSAGES.GET_ONE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getByCode = async (req, res, next) => {
  try {
    const { paymentCode } = req.params;
    const payment = await paymentService.getByCode(paymentCode, req.user);
    return ApiResponse.success(res, payment, PAYMENT_MESSAGES.GET_ONE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getStats = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.startDate || req.query.endDate) {
      filter.paymentDate = {};
      if (req.query.startDate)
        filter.paymentDate.$gte = new Date(req.query.startDate);
      if (req.query.endDate)
        filter.paymentDate.$lte = new Date(req.query.endDate);
    }

    const stats = await paymentService.getStats(filter, req.user);
    return ApiResponse.success(res, stats, PAYMENT_MESSAGES.GET_STATS_SUCCESS);
  } catch (error) {
    next(error);
  }
};

export default {
  create,
  driverRemit,
  verify,
  refund,
  getAll,
  getMyPayments,
  getById,
  getByCode,
  getStats,
};
