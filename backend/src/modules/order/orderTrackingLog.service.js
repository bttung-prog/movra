import mongoose from "mongoose";

import {
  ORDER_STATUSES,
  TRACKING_STATUS_TRANSITIONS,
} from "../../constants/orderStatuses.js";
import { ORDER_MESSAGES } from "../../constants/messages.js";
import { TRIP_TYPES } from "../../constants/tripTypes.js";
import { TRIP_STATUSES } from "../../constants/tripStatuses.js";

import { ApiError } from "../../utils/ApiError.js";

import userService from "../user/user.service.js";
import tripService from "../trip/trip.service.js";

import orderRepository from "./order.repository.js";
import orderTrackingLogRepository from "./orderTrackingLog.repository.js";
import orderAccess from "./order.access.js";

const ensureOrderAccess = async (
  orderId,
  requireNotDeleted = true,
  user = null,
  session = null,
) => {
  const order = await orderRepository.findById(orderId, session);
  const validatedOrder = orderAccess.validateOrder(order, requireNotDeleted);
  orderAccess.checkOrderOwnership(validatedOrder, user);
  await orderAccess.assertOrderWarehouseAccess(validatedOrder, user);
  return validatedOrder;
};

const create = async ({
  orderId,
  tripId,
  status,
  latitude,
  longitude,
  address,
  notes,
  changedBy,
  warehouseId,
  expectedStatus,
  expectedWarehouseId,
  session = null,
  user = null,
  allowPickupConfirmation = false,
  clearTrip = false,
}) => {
  const order = await ensureOrderAccess(orderId, true, user, session);
  const assignedTripId = order.tripId?._id || order.tripId;
  const currentWarehouseId = (
    order.warehouseId?._id || order.warehouseId
  )?.toString();
  const expectedWarehouseIdString = (
    expectedWarehouseId?._id || expectedWarehouseId
  )?.toString();

  if (
    (expectedStatus !== undefined && order.status !== expectedStatus) ||
    (expectedWarehouseId !== undefined &&
      currentWarehouseId !== expectedWarehouseIdString)
  ) {
    throw new ApiError(409, ORDER_MESSAGES.ORDER_ASSIGNMENT_CHANGED);
  }

  if (user && status === ORDER_STATUSES.STORED) {
    throw new ApiError(400, ORDER_MESSAGES.STORAGE_REQUIRES_RECEIPT);
  }

  if (user && status === ORDER_STATUSES.PICKED_UP && !allowPickupConfirmation) {
    throw new ApiError(400, ORDER_MESSAGES.PICKUP_CONFIRMATION_REQUIRED);
  }

  if (
    tripId &&
    (!assignedTripId || tripId.toString() !== assignedTripId.toString())
  ) {
    throw new ApiError(400, ORDER_MESSAGES.ORDER_ALREADY_ASSIGNED);
  }

  if (
    user &&
    status !== order.status &&
    !TRACKING_STATUS_TRANSITIONS[order.status]?.includes(status)
  ) {
    throw new ApiError(
      400,
      ORDER_MESSAGES.INVALID_TRACKING_STATUS_TRANSITION(order.status, status),
    );
  }

  if (changedBy) {
    await userService.getById(changedBy);
  }

  if (tripId) {
    await tripService.getById(tripId, false, user);
  }

  const isInternalSession = !session;
  const dbSession = session || (await mongoose.startSession());
  if (isInternalSession) {
    dbSession.startTransaction();
  }

  try {
    const trackingLog = await orderTrackingLogRepository.create(
      {
        orderId,
        tripId: tripId || order.tripId?._id || order.tripId,
        status,
        latitude,
        longitude,
        address,
        notes,
        changedBy,
      },
      dbSession,
    );

    const updatePayload = { status };
    if (warehouseId !== undefined) {
      updatePayload.warehouseId = warehouseId;
    }
    if (clearTrip) {
      updatePayload.tripId = null;
    }

    const updatedOrder = await orderRepository.updateById(
      orderId,
      updatePayload,
      dbSession,
      {
        status: order.status,
        deletedAt: null,
        ...(expectedWarehouseId !== undefined
          ? { warehouseId: expectedWarehouseId }
          : {}),
        ...(assignedTripId ? { tripId: assignedTripId } : {}),
      },
    );
    if (!updatedOrder) {
      throw new ApiError(409, ORDER_MESSAGES.ORDER_ASSIGNMENT_CHANGED);
    }

    if (isInternalSession) {
      await dbSession.commitTransaction();
    }

    return trackingLog;
  } catch (error) {
    if (isInternalSession) {
      await dbSession.abortTransaction();
    }
    throw error;
  } finally {
    if (isInternalSession) {
      dbSession.endSession();
    }
  }
};

const confirmPickup = async ({
  orderId,
  outcome,
  notes = "",
  changedBy,
  user,
  session = null,
}) => {
  const order = await ensureOrderAccess(orderId, true, user);
  const trip = order.tripId;

  if (!trip || trip.type !== TRIP_TYPES.PICKUP) {
    throw new ApiError(400, ORDER_MESSAGES.PICKUP_TRIP_REQUIRED);
  }

  if (trip.status !== TRIP_STATUSES.IN_PROGRESS) {
    throw new ApiError(400, ORDER_MESSAGES.PICKUP_TRIP_NOT_IN_PROGRESS);
  }

  if (
    ![ORDER_STATUSES.DRIVER_ASSIGNED, ORDER_STATUSES.PICKUP_SCHEDULED].includes(
      order.status,
    )
  ) {
    throw new ApiError(
      400,
      ORDER_MESSAGES.PICKUP_ORDER_STATUS_INVALID(order.status),
    );
  }

  const status =
    outcome === ORDER_STATUSES.PICKED_UP
      ? ORDER_STATUSES.PICKED_UP
      : order.status;
  const trackingNotes =
    outcome === ORDER_STATUSES.FAILED ? `Lấy hàng thất bại: ${notes}` : notes;

  return create({
    orderId,
    tripId: trip._id,
    status,
    notes: trackingNotes,
    changedBy,
    user,
    expectedStatus: order.status,
    session,
    allowPickupConfirmation: outcome === ORDER_STATUSES.PICKED_UP,
  });
};

const getByOrderId = async ({
  orderId,
  page = 1,
  limit = 20,
  sort = { createdAt: -1 },
  user = null,
} = {}) => {
  await ensureOrderAccess(orderId, false, user);

  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const limitNumber = Math.max(1, parseInt(limit, 10) || 20);
  const skip = (pageNumber - 1) * limitNumber;

  const [logs, total] = await Promise.all([
    orderTrackingLogRepository.findByOrderId(orderId, {
      skip,
      limit: limitNumber,
      sort,
    }),
    orderTrackingLogRepository.countByOrderId(orderId),
  ]);

  return {
    data: logs,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages: Math.ceil(total / limitNumber),
    },
  };
};

const getLatestByOrderId = async ({ orderId, user = null }) => {
  await ensureOrderAccess(orderId, false, user);

  const log = await orderTrackingLogRepository.getLatestByOrderId(orderId);
  if (!log) {
    throw new ApiError(404, ORDER_MESSAGES.TRACKING_NOT_FOUND);
  }

  return log;
};

const getPublicByCode = async (orderCode) => {
  const order = await orderRepository.findByCode(orderCode);
  const validatedOrder = orderAccess.validateOrder(order, true);

  const trackingLogs = await orderTrackingLogRepository.findPublicByOrderId(
    validatedOrder._id,
    {
      skip: 0,
      limit: 100,
      sort: { createdAt: 1 },
    },
  );

  return {
    orderCode: validatedOrder.orderCode,
    status: validatedOrder.status,
    weight: validatedOrder.weight,
    volume: validatedOrder.volume,
    type: validatedOrder.type,
    deliveredAt: validatedOrder.deliveredAt,
    createdAt: validatedOrder.createdAt,
    trackingLogs,
  };
};

export default {
  create,
  confirmPickup,
  getByOrderId,
  getLatestByOrderId,
  getPublicByCode,
};
