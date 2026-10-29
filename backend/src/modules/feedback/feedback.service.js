import mongoose from "mongoose";

import ROLES from "../../constants/roles.js";
import { FEEDBACK_MESSAGES } from "../../constants/messages.js";

import ApiError from "../../utils/ApiError.js";

import orderService from "../order/order.service.js";
import tripService from "../trip/trip.service.js";
import driverService from "../driver/driver.service.js";

import feedbackRepository from "./feedback.repository.js";

const createFeedback = async (payload, actor) => {
  const { orderId, rating, tags = [], comment = "" } = payload;

  if (actor.role !== ROLES.CUSTOMER) {
    throw new ApiError(403, FEEDBACK_MESSAGES.CREATE_ACCESS_DENIED);
  }

  const order = await orderService.getById(orderId);
  if (!order) {
    throw new ApiError(404, FEEDBACK_MESSAGES.ORDER_NOT_FOUND);
  }

  if (order.status !== "delivered") {
    throw new ApiError(400, FEEDBACK_MESSAGES.ORDER_NOT_DELIVERED);
  }

  const orderCustomerId = (
    order.customerId._id || order.customerId
  ).toString();
  if (!actor.customerId || orderCustomerId !== actor.customerId.toString()) {
    throw new ApiError(403, FEEDBACK_MESSAGES.CREATE_ACCESS_DENIED);
  }

  let driverId = null;
  const tripId = order.tripId?._id || order.tripId || null;

  if (tripId) {
    const trip = await tripService.getById(tripId);
    if (trip) {
      driverId = trip.driverId?._id || trip.driverId || null;
    }
  }

  const feedbackData = {
    orderId,
    customerId: actor.customerId || order.customerId._id || order.customerId,
    driverId,
    tripId,
    rating,
    tags,
    comment,
  };

  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const existingFeedback = await feedbackRepository.findByOrderId(
        orderId,
        {},
        session,
      );
      if (existingFeedback) {
        throw new ApiError(400, FEEDBACK_MESSAGES.ALREADY_EXISTS);
      }

      const newFeedback = await feedbackRepository.create(feedbackData, session);

      if (driverId) {
        const stats = await feedbackRepository.getDriverStats(
          driverId,
          session,
        );
        await driverService.updateById(
          driverId,
          {
            rating: stats.averageRating,
            totalReviews: stats.totalReviews,
          },
          session,
        );
      }

      return newFeedback;
    });
  } finally {
    session.endSession();
  }
};

const replyFeedback = async (feedbackId, responseText, actor) => {
  const visibilityFilter =
    actor.role === ROLES.ADMIN ? {} : { status: "visible" };
  const feedback = await feedbackRepository.findById(
    feedbackId,
    null,
    visibilityFilter,
  );
  if (!feedback) {
    throw new ApiError(404, FEEDBACK_MESSAGES.NOT_FOUND);
  }

  if (actor.role === ROLES.DRIVER) {
    const feedbackDriverId = (
      feedback.driverId?._id || feedback.driverId
    )?.toString();
    if (!actor.driverId || feedbackDriverId !== actor.driverId.toString()) {
      throw new ApiError(403, FEEDBACK_MESSAGES.REPLY_ACCESS_DENIED);
    }
  }

  return feedbackRepository.updateById(feedbackId, {
    driverResponse: responseText,
  });
};

const getAll = async ({
  filter = {},
  page = 1,
  limit = 10,
  sort = { createdAt: -1 },
  user = null,
} = {}) => {
  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const limitNumber = Math.max(1, parseInt(limit, 10) || 10);
  const skip = (pageNumber - 1) * limitNumber;
  const queryFilter = { ...filter };

  if (user?.role !== ROLES.ADMIN) {
    queryFilter.status = "visible";
  }

  if (user?.role === ROLES.CUSTOMER) {
    if (!user.customerId) {
      throw new ApiError(403, FEEDBACK_MESSAGES.VIEW_ACCESS_DENIED);
    }
    queryFilter.customerId = user.customerId;
  } else if (user?.role === ROLES.DRIVER) {
    if (!user.driverId) {
      throw new ApiError(403, FEEDBACK_MESSAGES.VIEW_ACCESS_DENIED);
    }
    queryFilter.driverId = user.driverId;
  } else if (user?.role === ROLES.DISPATCHER) {
    if (!user.warehouseId) {
      throw new ApiError(403, FEEDBACK_MESSAGES.VIEW_ACCESS_DENIED);
    }
    const [orderIds, tripIds] = await Promise.all([
      orderService.getIdsByWarehouseId(user.warehouseId),
      tripService.getIdsByWarehouseId(user.warehouseId),
    ]);
    queryFilter.$and = [
      ...(queryFilter.$and || []),
      { orderId: { $in: orderIds } },
      { tripId: { $in: tripIds } },
    ];
  }

  const [feedbacks, total] = await Promise.all([
    feedbackRepository.findAll({
      filter: queryFilter,
      skip,
      limit: limitNumber,
      sort,
    }),
    feedbackRepository.countAll({ filter: queryFilter }),
  ]);

  return {
    feedbacks,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages: Math.ceil(total / limitNumber),
    },
  };
};

const getById = async (id, user = null) => {
  const filter = user?.role === ROLES.ADMIN ? {} : { status: "visible" };
  const feedback = await feedbackRepository.findById(id, null, filter);
  if (!feedback) {
    throw new ApiError(404, FEEDBACK_MESSAGES.NOT_FOUND);
  }

  if (user?.role === ROLES.CUSTOMER) {
    if (!user.customerId) {
      throw new ApiError(403, FEEDBACK_MESSAGES.VIEW_ONE_ACCESS_DENIED);
    }
    const feedbackCustomerId = (
      feedback.customerId?._id || feedback.customerId
    )?.toString();
    if (feedbackCustomerId !== user.customerId.toString()) {
      throw new ApiError(403, FEEDBACK_MESSAGES.VIEW_ONE_ACCESS_DENIED);
    }
  } else if (user?.role === ROLES.DRIVER) {
    if (!user.driverId) {
      throw new ApiError(403, FEEDBACK_MESSAGES.VIEW_ONE_ACCESS_DENIED);
    }
    const feedbackDriverId = (
      feedback.driverId?._id || feedback.driverId
    )?.toString();
    if (feedbackDriverId !== user.driverId.toString()) {
      throw new ApiError(403, FEEDBACK_MESSAGES.VIEW_ONE_ACCESS_DENIED);
    }
  } else if (user?.role === ROLES.DISPATCHER) {
    await orderService.getById(
      feedback.orderId?._id || feedback.orderId,
      true,
      user,
    );
    if (feedback.tripId) {
      await tripService.getById(
        feedback.tripId?._id || feedback.tripId,
        false,
        user,
      );
    }
  }

  return feedback;
};

const getByOrderId = async (orderId, user = null) => {
  const order = await orderService.getById(orderId, true, user);
  const filter = user?.role === ROLES.ADMIN ? {} : { status: "visible" };
  const feedback = await feedbackRepository.findByOrderId(orderId, filter);
  if (!feedback) {
    throw new ApiError(404, FEEDBACK_MESSAGES.ORDER_FEEDBACK_NOT_FOUND);
  }

  if (user?.role === ROLES.CUSTOMER) {
    if (!user.customerId) {
      throw new ApiError(403, FEEDBACK_MESSAGES.VIEW_ONE_ACCESS_DENIED);
    }
    const feedbackCustomerId = (
      feedback.customerId?._id || feedback.customerId
    )?.toString();
    if (feedbackCustomerId !== user.customerId.toString()) {
      throw new ApiError(403, FEEDBACK_MESSAGES.VIEW_ONE_ACCESS_DENIED);
    }
  } else if (user?.role === ROLES.DRIVER) {
    if (!user.driverId) {
      throw new ApiError(403, FEEDBACK_MESSAGES.VIEW_ONE_ACCESS_DENIED);
    }
    const feedbackDriverId = (
      feedback.driverId?._id || feedback.driverId
    )?.toString();
    if (feedbackDriverId !== user.driverId.toString()) {
      throw new ApiError(403, FEEDBACK_MESSAGES.VIEW_ONE_ACCESS_DENIED);
    }
  } else if (user?.role === ROLES.DISPATCHER && feedback.tripId) {
    await tripService.getById(
      feedback.tripId?._id || feedback.tripId,
      false,
      user,
    );
  }

  if (user?.role === ROLES.CUSTOMER) {
    const orderCustomerId = (
      order.customerId?._id || order.customerId
    )?.toString();
    if (!user.customerId || orderCustomerId !== user.customerId.toString()) {
      throw new ApiError(403, FEEDBACK_MESSAGES.VIEW_ONE_ACCESS_DENIED);
    }
  }

  return feedback;
};

export default {
  createFeedback,
  replyFeedback,
  getAll,
  getById,
  getByOrderId,
};
