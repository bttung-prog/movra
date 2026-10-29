import mongoose from "mongoose";

import ROLES from "../../constants/roles.js";
import { FAILURE_REASON_MESSAGES } from "../../constants/messages.js";

import ApiError from "../../utils/ApiError.js";

import orderService from "../order/order.service.js";
import tripService from "../trip/trip.service.js";
import userService from "../user/user.service.js";

import failureReasonRepository from "./failureReason.repository.js";

const validateFailureReason = (failureReason) => {
  if (!failureReason) {
    throw new ApiError(404, FAILURE_REASON_MESSAGES.NOT_FOUND);
  }
};

const checkDriverAssignment = (trip, user) => {
  if (user?.role === ROLES.DRIVER) {
    const tripAssignedDriverId = (
      trip.driverId?._id || trip.driverId
    )?.toString();

    const tripAssignedUserId = (
      trip.driverId?.userId?._id || trip.driverId?.userId
    )?.toString();

    const isAssigned =
      (user.driverId && tripAssignedDriverId === user.driverId.toString()) ||
      (user.userId && tripAssignedUserId === user.userId.toString());

    if (!isAssigned) {
      throw new ApiError(403, FAILURE_REASON_MESSAGES.NOT_ASSIGNED_DRIVER);
    }
  }
};

const checkDriverOrderAssignment = async (
  order,
  user,
  expectedTripId = null,
) => {
  const orderTripId = (order.tripId?._id || order.tripId)?.toString();
  if (
    !orderTripId ||
    (expectedTripId && orderTripId !== expectedTripId.toString())
  ) {
    throw new ApiError(403, FAILURE_REASON_MESSAGES.NOT_ASSIGNED_DRIVER);
  }

  const trip = await tripService.getById(orderTripId, false, user);
  checkDriverAssignment(trip, user);
};

const getEndDateFilter = (endDate) => {
  if (typeof endDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    const nextDay = new Date(`${endDate}T00:00:00.000Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    return { $lt: nextDay };
  }

  return { $lte: new Date(endDate) };
};

const create = async ({
  orderId,
  tripId,
  failureReasonType,
  failureReasonDescription,
  reportedBy,
  latitude,
  longitude,
  address,
  user = null,
}) => {
  const [order, trip] = await Promise.all([
    orderService.getById(orderId, true, user),
    tripService.getById(tripId, true, user),
    userService.getById(reportedBy),
  ]);

  checkDriverAssignment(trip, user);

  if (["delivered", "returned", "cancelled"].includes(order.status)) {
    throw new ApiError(
      400,
      FAILURE_REASON_MESSAGES.CANNOT_REPORT_STATUS(order.status),
    );
  }

  const orderTripId = (order.tripId?._id || order.tripId)?.toString();

  if (!orderTripId || orderTripId !== tripId.toString()) {
    throw new ApiError(400, FAILURE_REASON_MESSAGES.ORDER_NOT_IN_TRIP);
  }

  if (trip.status === "cancelled") {
    throw new ApiError(
      400,
      FAILURE_REASON_MESSAGES.CANNOT_REPORT_CANCELLED_TRIP,
    );
  }

  const session = await mongoose.startSession();
  let failureLogId;

  try {
    await session.withTransaction(async () => {
      const currentOrder = await orderService.getById(
        orderId,
        true,
        user,
        session,
      );
      if (
        ["delivered", "returned", "cancelled"].includes(currentOrder.status)
      ) {
        throw new ApiError(
          400,
          FAILURE_REASON_MESSAGES.CANNOT_REPORT_STATUS(currentOrder.status),
        );
      }

      const currentOrderTripId = (
        currentOrder.tripId?._id || currentOrder.tripId
      )?.toString();
      if (!currentOrderTripId || currentOrderTripId !== tripId.toString()) {
        throw new ApiError(400, FAILURE_REASON_MESSAGES.ORDER_NOT_IN_TRIP);
      }

      const failureLog = await failureReasonRepository.create(
        {
          orderId,
          tripId,
          failureReasonType,
          failureReasonDescription,
          reportedBy,
          latitude,
          longitude,
          address,
        },
        session,
      );

      const updatedOrder = await orderService.recordFailureAttempt({
        orderId,
        notes: failureReasonDescription,
        session,
        user,
      });
      if (!updatedOrder) {
        throw new ApiError(
          409,
          FAILURE_REASON_MESSAGES.CONCURRENT_UPDATE_ERROR,
        );
      }

      await orderService.addTrackingLog({
        orderId,
        tripId,
        status: updatedOrder.status,
        latitude,
        longitude,
        address,
        notes: failureReasonDescription,
        changedBy: reportedBy,
        session,
        user,
      });

      failureLogId = failureLog._id;
    });

    return await failureReasonRepository.findById(failureLogId);
  } finally {
    session.endSession();
  }
};

const getAll = async ({
  filter = {},
  page = 1,
  limit = 20,
  sort = { createdAt: -1 },
  user = null,
} = {}) => {
  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const limitNumber = Math.max(1, parseInt(limit, 10) || 20);
  const skip = (pageNumber - 1) * limitNumber;

  const queryFilter = { ...filter };
  if (queryFilter.startDate || queryFilter.endDate) {
    queryFilter.createdAt = {};

    if (queryFilter.startDate) {
      queryFilter.createdAt.$gte = new Date(queryFilter.startDate);
      delete queryFilter.startDate;
    }

    if (queryFilter.endDate) {
      Object.assign(
        queryFilter.createdAt,
        getEndDateFilter(queryFilter.endDate),
      );
      delete queryFilter.endDate;
    }
  }

  if (user?.role === ROLES.DISPATCHER) {
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

  const [logs, total] = await Promise.all([
    failureReasonRepository.findAll({
      filter: queryFilter,
      skip,
      limit: limitNumber,
      sort,
    }),
    failureReasonRepository.countAll({ filter: queryFilter }),
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

const getById = async (failureReasonId, user = null) => {
  const failureReason = await failureReasonRepository.findById(failureReasonId);

  validateFailureReason(failureReason);
  if (user?.role === ROLES.DISPATCHER) {
    await orderService.getById(
      failureReason.orderId?._id || failureReason.orderId,
      true,
      user,
    );
    await tripService.getById(
      failureReason.tripId?._id || failureReason.tripId,
      false,
      user,
    );
  } else if (user?.role === ROLES.DRIVER) {
    const order = await orderService.getById(
      failureReason.orderId?._id || failureReason.orderId,
      true,
      user,
    );
    await checkDriverOrderAssignment(
      order,
      user,
      failureReason.tripId?._id || failureReason.tripId,
    );
  }

  return failureReason;
};

const getByOrderId = async ({
  orderId,
  user = null,
  page = 1,
  limit = 10,
  sort = { createdAt: -1 },
} = {}) => {
  const order = await orderService.getById(orderId, true, user);

  if (user?.role === ROLES.CUSTOMER) {
    const orderCustomerId = (
      order.customerId?._id || order.customerId
    )?.toString();

    if (!user.customerId || orderCustomerId !== user.customerId.toString()) {
      throw new ApiError(403, FAILURE_REASON_MESSAGES.ACCESS_DENIED);
    }
  } else if (user?.role === ROLES.DRIVER) {
    await checkDriverOrderAssignment(order, user);
  }

  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const limitNumber = Math.max(1, parseInt(limit, 10) || 10);
  const skip = (pageNumber - 1) * limitNumber;
  const filter = { orderId };

  const [logs, total] = await Promise.all([
    failureReasonRepository.findByOrderId(orderId, {
      skip,
      limit: limitNumber,
      sort,
    }),
    failureReasonRepository.countAll({ filter }),
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

const getByTripId = async ({
  tripId,
  user = null,
  page = 1,
  limit = 20,
  sort = { createdAt: -1 },
} = {}) => {
  const trip = await tripService.getById(tripId, false, user);

  checkDriverAssignment(trip, user);

  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const limitNumber = Math.max(1, parseInt(limit, 10) || 20);
  const skip = (pageNumber - 1) * limitNumber;
  const filter = { tripId };

  const [logs, total] = await Promise.all([
    failureReasonRepository.findByTripId(tripId, {
      skip,
      limit: limitNumber,
      sort,
    }),
    failureReasonRepository.countAll({ filter }),
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

const getStatsByFailureType = async ({ filter = {}, user = null } = {}) => {
  const matchFilter = {};

  if (filter.failureReasonType) {
    matchFilter.failureReasonType = filter.failureReasonType;
  }

  if (filter.orderId) {
    matchFilter.orderId = mongoose.Types.ObjectId.createFromHexString(
      String(filter.orderId),
    );
  }

  if (filter.tripId) {
    matchFilter.tripId = mongoose.Types.ObjectId.createFromHexString(
      String(filter.tripId),
    );
  }

  if (filter.reportedBy) {
    matchFilter.reportedBy = mongoose.Types.ObjectId.createFromHexString(
      String(filter.reportedBy),
    );
  }

  if (filter.startDate || filter.endDate) {
    matchFilter.createdAt = {};
    if (filter.startDate) {
      matchFilter.createdAt.$gte = new Date(filter.startDate);
    }

    if (filter.endDate) {
      Object.assign(matchFilter.createdAt, getEndDateFilter(filter.endDate));
    }
  }

  if (user?.role === ROLES.DISPATCHER) {
    const [orderIds, tripIds] = await Promise.all([
      orderService.getIdsByWarehouseId(user.warehouseId),
      tripService.getIdsByWarehouseId(user.warehouseId),
    ]);
    matchFilter.$and = [
      { orderId: { $in: orderIds } },
      { tripId: { $in: tripIds } },
    ];
  }

  return failureReasonRepository.countByFailureType(matchFilter);
};

const updateById = async ({
  failureReasonId,
  updateData,
  session = null,
  user = null,
}) => {
  await getById(failureReasonId, user);

  return failureReasonRepository.updateById(
    failureReasonId,
    updateData,
    session,
  );
};

const deleteById = async ({ failureReasonId, session = null }) => {
  await getById(failureReasonId);

  return failureReasonRepository.deleteById(failureReasonId, session);
};

export default {
  create,
  getAll,
  getById,
  getByOrderId,
  getByTripId,
  getStatsByFailureType,
  updateById,
  deleteById,
};
