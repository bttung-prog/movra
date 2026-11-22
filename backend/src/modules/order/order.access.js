import { ROLES } from "../../constants/roles.js";
import {
  ORDER_MESSAGES,
  WAREHOUSE_MESSAGES,
} from "../../constants/messages.js";

import { ApiError } from "../../utils/ApiError.js";

import tripService from "../trip/trip.service.js";

const getActorId = (user) => user?.userId || user?._id || null;

const validateOrder = (order, requireNotDeleted = true) => {
  if (!order) {
    throw new ApiError(404, ORDER_MESSAGES.NOT_FOUND);
  }

  if (requireNotDeleted && order.deletedAt !== null) {
    throw new ApiError(400, ORDER_MESSAGES.ALREADY_DELETED);
  }

  return order;
};

const checkOrderOwnership = (order, user) => {
  if (user?.role === ROLES.CUSTOMER) {
    const orderCustomerId = (
      order.customerId?._id || order.customerId
    )?.toString();

    if (!user.customerId || orderCustomerId !== user.customerId.toString()) {
      throw new ApiError(403, ORDER_MESSAGES.ACCESS_DENIED);
    }
  }
};

const assertDriverAssignedToTrip = (trip, user) => {
  if (user?.role !== ROLES.DRIVER) return;

  const assignedDriverId = (trip.driverId?._id || trip.driverId)?.toString();
  const assignedUserId = (
    trip.driverId?.userId?._id || trip.driverId?.userId
  )?.toString();
  const isAssigned =
    (user.driverId && assignedDriverId === user.driverId.toString()) ||
    (user.userId && assignedUserId === user.userId.toString());

  if (!isAssigned) {
    throw new ApiError(403, ORDER_MESSAGES.NOT_DRIVER_OF_TRIP);
  }
};

const assertOrderWarehouseAccess = async (order, user) => {
  if (user?.role === ROLES.DRIVER) {
    const tripId = order.tripId?._id || order.tripId;
    if (!tripId) {
      throw new ApiError(403, ORDER_MESSAGES.NOT_DRIVER_OF_TRIP);
    }

    const trip = order.tripId?.driverId
      ? order.tripId
      : await tripService.getById(tripId, false, user);
    assertDriverAssignedToTrip(trip, user);
    return;
  }

  if (user?.role === ROLES.DISPATCHER) {
    const userWarehouseId = user.warehouseId?.toString();
    const orderWarehouseId = (
      order.warehouseId?._id || order.warehouseId
    )?.toString();
    const orderDestWarehouseId = (
      order.destinationWarehouseId?._id || order.destinationWarehouseId
    )?.toString();

    const isOriginMatch = Boolean(
      orderWarehouseId && orderWarehouseId === userWarehouseId,
    );
    const isDestMatch = Boolean(
      orderDestWarehouseId && orderDestWarehouseId === userWarehouseId,
    );

    if (!isOriginMatch && !isDestMatch) {
      throw new ApiError(403, WAREHOUSE_MESSAGES.ACCESS_DENIED);
    }

    const tripId = order.tripId?._id || order.tripId;
    if (tripId && isOriginMatch) {
      await tripService.getById(tripId, false, user);
    }

    return;
  }
};

const scopeOrderFilter = async (filter, user) => {
  const { warehouseScope, ...cleanFilter } = filter;

  if (user?.role !== ROLES.DISPATCHER) {
    return cleanFilter;
  }

  if (!user.warehouseId) {
    throw new ApiError(403, WAREHOUSE_MESSAGES.DISPATCHER_NOT_ASSIGNED);
  }

  const userWarehouseId = user.warehouseId.toString();

  // If dispatcher queries inbound orders specifically
  if (cleanFilter.destinationWarehouseId) {
    if (cleanFilter.destinationWarehouseId.toString() !== userWarehouseId) {
      throw new ApiError(403, WAREHOUSE_MESSAGES.ACCESS_DENIED);
    }
    return cleanFilter;
  }

  // If dispatcher queries outbound/origin orders specifically
  if (cleanFilter.warehouseId) {
    if (cleanFilter.warehouseId.toString() !== userWarehouseId) {
      throw new ApiError(403, WAREHOUSE_MESSAGES.ACCESS_DENIED);
    }
    return cleanFilter;
  }

  // If dispatcher wants to see all orders involving their warehouse (both outbound and inbound)
  if (warehouseScope === "all") {
    return {
      $and: [
        cleanFilter,
        {
          $or: [
            { warehouseId: user.warehouseId },
            { destinationWarehouseId: user.warehouseId },
          ],
        },
      ],
    };
  }

  if (warehouseScope === "destination") {
    return {
      ...cleanFilter,
      destinationWarehouseId: user.warehouseId,
    };
  }

  return {
    ...cleanFilter,
    warehouseId: user.warehouseId,
  };
};

export default {
  getActorId,
  validateOrder,
  checkOrderOwnership,
  assertDriverAssignedToTrip,
  assertOrderWarehouseAccess,
  scopeOrderFilter,
};
