import ROLES from "../../constants/roles.js";
import { ORDER_MESSAGES } from "../../constants/messages.js";

import ApiResponse from "../../utils/ApiResponse.js";
import storageUtil from "../../utils/storage.util.js";

import orderService from "./order.service.js";

const create = async (req, res, next) => {
  try {
    const payload = {
      ...req.body,
      createdBy: req.user.userId,
    };

    if (req.user.role === ROLES.CUSTOMER && req.user.customerId) {
      payload.customerId = req.user.customerId;
    }

    const order = await orderService.create(payload, null, req.user);

    return ApiResponse.created(res, order, ORDER_MESSAGES.CREATE_SUCCESS);
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
      paymentStatus,
      customerId,
      tripId,
      routeId,
      goodCategory,
      type,
    } = req.query;

    const filter = {};

    if (search) {
      filter.$or = [
        { orderCode: { $regex: search, $options: "i" } },
        { senderName: { $regex: search, $options: "i" } },
        { senderPhone: { $regex: search, $options: "i" } },
        { recipientName: { $regex: search, $options: "i" } },
        { recipientPhone: { $regex: search, $options: "i" } },
      ];
    }

    if (status) {
      filter.status = status;
    }

    if (paymentStatus) {
      filter.paymentStatus = paymentStatus;
    }

    if (customerId) {
      filter.customerId = customerId;
    }

    if (tripId) {
      filter.tripId = tripId;
    }

    if (routeId) {
      filter.routeId = routeId;
    }

    if (goodCategory) {
      filter.goodCategory = goodCategory;
    }

    if (type) {
      filter.type = type;
    }

    const result = await orderService.getAll({
      filter,
      page,
      limit,
      user: req.user,
    });

    return ApiResponse.success(res, result, ORDER_MESSAGES.GET_ALL_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getMyOrders = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const { search, status, paymentStatus, type } = req.query;

    const filter = {};

    if (search) {
      filter.$or = [
        { orderCode: { $regex: search, $options: "i" } },
        { senderName: { $regex: search, $options: "i" } },
        { senderPhone: { $regex: search, $options: "i" } },
        { recipientName: { $regex: search, $options: "i" } },
        { recipientPhone: { $regex: search, $options: "i" } },
      ];
    }

    if (status) {
      filter.status = status;
    }

    if (paymentStatus) {
      filter.paymentStatus = paymentStatus;
    }

    if (type) {
      filter.type = type;
    }

    const result = await orderService.getMyOrders({
      userId: req.user.userId,
      customerId: req.user.customerId,
      filter,
      page,
      limit,
    });

    return ApiResponse.success(
      res,
      result,
      ORDER_MESSAGES.GET_MY_ORDERS_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const order = await orderService.getById(
      req.params.orderId,
      true,
      req.user,
    );

    return ApiResponse.success(res, order, ORDER_MESSAGES.GET_ONE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getByCode = async (req, res, next) => {
  try {
    const order = await orderService.getByCode(req.params.orderCode, req.user);

    return ApiResponse.success(res, order, ORDER_MESSAGES.GET_ONE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getPublicTracking = async (req, res, next) => {
  try {
    const trackingInfo = await orderService.getPublicTrackingByCode(
      req.params.orderCode,
    );

    return ApiResponse.success(
      res,
      trackingInfo,
      "Tra cứu thông tin hành trình đơn hàng thành công",
    );
  } catch (error) {
    next(error);
  }
};

const confirmPickup = async (req, res, next) => {
  try {
    const trackingLog = await orderService.confirmPickup({
      orderId: req.params.orderId,
      ...req.body,
      changedBy: req.user.userId,
      user: req.user,
    });

    return ApiResponse.created(
      res,
      trackingLog,
      ORDER_MESSAGES.PICKUP_CONFIRMATION_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getByTripId = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;

    const result = await orderService.getByTripId({
      tripId: req.params.tripId,
      page,
      limit,
      user: req.user,
    });

    return ApiResponse.success(res, result, ORDER_MESSAGES.GET_BY_TRIP_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const updateById = async (req, res, next) => {
  try {
    const updatedOrder = await orderService.updateById({
      orderId: req.params.orderId,
      updateData: req.body,
      user: req.user,
    });

    return ApiResponse.success(
      res,
      updatedOrder,
      ORDER_MESSAGES.UPDATE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const markAsDelivered = async (req, res, next) => {
  try {
    let podImageUrl = req.body.podImageUrl || null;
    if (req.file) {
      podImageUrl = storageUtil.getFileUrl(req, req.file);
    }

    const payload = {
      ...req.body,
      orderId: req.params.orderId,
      podImageUrl,
      recipientReceivedName: req.body.recipientReceivedName,
      deliveredBy: req.user.userId,
      user: req.user,
    };

    const result = await orderService.markAsDelivered(payload);

    return ApiResponse.success(
      res,
      result,
      ORDER_MESSAGES.MARK_DELIVERED_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const cancelOrder = async (req, res, next) => {
  try {
    const payload = {
      orderId: req.params.orderId,
      reason: req.body.reason,
      cancelledBy: req.user.userId,
      user: req.user,
    };

    const result = await orderService.cancelOrder(payload);

    return ApiResponse.success(res, result, ORDER_MESSAGES.CANCEL_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const assignOrdersToTrip = async (req, res, next) => {
  try {
    const result = await orderService.assignOrdersToTrip(req.body, req.user);

    return ApiResponse.success(
      res,
      result,
      ORDER_MESSAGES.ASSIGN_TO_TRIP_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const unassignOrdersFromTrip = async (req, res, next) => {
  try {
    const result = await orderService.unassignOrdersFromTrip(
      req.body,
      req.user,
    );

    return ApiResponse.success(
      res,
      result,
      ORDER_MESSAGES.UNASSIGN_FROM_TRIP_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const deleteById = async (req, res, next) => {
  try {
    const deletedOrder = await orderService.deleteById({
      orderId: req.params.orderId,
      user: req.user,
    });

    return ApiResponse.success(
      res,
      deletedOrder,
      ORDER_MESSAGES.DELETE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getStatsByStatus = async (req, res, next) => {
  try {
    const { customerId, tripId, routeId, goodCategory, type } = req.query;

    const filter = {};

    if (customerId) {
      filter.customerId = customerId;
    }

    if (tripId) {
      filter.tripId = tripId;
    }

    if (routeId) {
      filter.routeId = routeId;
    }

    if (goodCategory) {
      filter.goodCategory = goodCategory;
    }

    if (type) {
      filter.type = type;
    }

    const stats = await orderService.getStatsByStatus({
      filter,
      user: req.user,
    });

    return ApiResponse.success(res, stats, ORDER_MESSAGES.GET_STATS_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const addTrackingLog = async (req, res, next) => {
  try {
    const payload = {
      ...req.body,
      orderId: req.params.orderId,
      changedBy: req.user.userId,
      user: req.user,
    };

    const trackingLog = await orderService.addTrackingLog(payload);

    return ApiResponse.created(
      res,
      trackingLog,
      ORDER_MESSAGES.ADD_TRACKING_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getTrackingLogsByOrderId = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;

    const result = await orderService.getTrackingLogsByOrderId({
      orderId: req.params.orderId,
      page,
      limit,
      user: req.user,
    });

    return ApiResponse.success(
      res,
      result,
      ORDER_MESSAGES.GET_TRACKING_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getLatestTrackingLog = async (req, res, next) => {
  try {
    const log = await orderService.getLatestTrackingLog({
      orderId: req.params.orderId,
      user: req.user,
    });

    return ApiResponse.success(
      res,
      log,
      ORDER_MESSAGES.GET_LATEST_TRACKING_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

export default {
  create,
  getAll,
  getMyOrders,
  getById,
  getByCode,
  getPublicTracking,
  confirmPickup,
  getByTripId,
  updateById,
  markAsDelivered,
  cancelOrder,
  assignOrdersToTrip,
  unassignOrdersFromTrip,
  deleteById,
  getStatsByStatus,

  addTrackingLog,
  getTrackingLogsByOrderId,
  getLatestTrackingLog,
};
