import mongoose from "mongoose";

import { ROLES } from "../../constants/roles.js";
import { TRIP_TYPES } from "../../constants/tripTypes.js";
import { TRIP_STATUSES } from "../../constants/tripStatuses.js";
import {
  ORDER_STATUSES,
  PICKUP_ASSIGNABLE_ORDER_STATUSES,
} from "../../constants/orderStatuses.js";
import {
  ORDER_MESSAGES,
  WAREHOUSE_MESSAGES,
} from "../../constants/messages.js";
import { CM3_PER_M3 } from "../../constants/pricingUnits.js";

import { ApiError } from "../../utils/ApiError.js";

import tripService from "../trip/trip.service.js";

import orderRepository from "./order.repository.js";
import orderTrackingLogRepository from "./orderTrackingLog.repository.js";
import orderAccess from "./order.access.js";

const getTripLoadMetrics = async (
  tripId,
  excludeOrderIds = [],
  session = null,
) => {
  if (!tripId) {
    return { totalWeight: 0, totalVolumeCm3: 0, count: 0 };
  }

  const orders = await orderRepository.findLoadsByTripId(tripId, session);
  const excludeSet = new Set(
    (excludeOrderIds || []).map((id) => id?.toString()),
  );

  return orders.reduce(
    (acc, order) => {
      if (!excludeSet.has(order._id?.toString())) {
        const quantity = Number(order.quantity) || 1;

        acc.totalWeight += (Number(order.weight) || 0) * quantity;
        acc.totalVolumeCm3 += (Number(order.volume) || 0) * quantity;
        acc.count += 1;
      }
      return acc;
    },
    { totalWeight: 0, totalVolumeCm3: 0, count: 0 },
  );
};

const assertTripCapacity = async (
  trip,
  candidateOrders = [],
  session = null,
) => {
  const vehicle = trip?.vehicleId;
  const hasCapacityLimit =
    vehicle &&
    typeof vehicle === "object" &&
    ((typeof vehicle.capacityWeight === "number" &&
      vehicle.capacityWeight > 0) ||
      (typeof vehicle.capacityVolume === "number" &&
        vehicle.capacityVolume > 0));

  if (!hasCapacityLimit) {
    return;
  }

  const candidateOrderIds = candidateOrders
    .map((o) => {
      if (o?._id) return o._id.toString();
      if (typeof o === "string") return o;
      return null;
    })
    .filter(Boolean);

  const existingMetrics = await getTripLoadMetrics(
    trip._id || trip.id,
    candidateOrderIds,
    session,
  );

  const newWeight = candidateOrders.reduce(
    (sum, o) => sum + (Number(o.weight) || 0) * (Number(o.quantity) || 1),
    0,
  );
  const newVolumeCm3 = candidateOrders.reduce(
    (sum, o) => sum + (Number(o.volume) || 0) * (Number(o.quantity) || 1),
    0,
  );

  const totalWeight =
    Math.round((existingMetrics.totalWeight + newWeight) * 100) / 100;
  const totalVolumeCm3 =
    Math.round((existingMetrics.totalVolumeCm3 + newVolumeCm3) * 100) / 100;
  const totalVolumeM3 = totalVolumeCm3 / CM3_PER_M3;

  if (
    typeof vehicle.capacityWeight === "number" &&
    vehicle.capacityWeight > 0 &&
    totalWeight > vehicle.capacityWeight
  ) {
    throw new ApiError(
      400,
      ORDER_MESSAGES.EXCEED_VEHICLE_WEIGHT(totalWeight, vehicle.capacityWeight),
    );
  }

  if (
    typeof vehicle.capacityVolume === "number" &&
    vehicle.capacityVolume > 0 &&
    totalVolumeM3 > vehicle.capacityVolume
  ) {
    throw new ApiError(
      400,
      ORDER_MESSAGES.EXCEED_VEHICLE_VOLUME(
        Number(totalVolumeM3.toFixed(2)),
        vehicle.capacityVolume,
      ),
    );
  }
};

const countByTripId = (tripId, session = null) => {
  return orderRepository.countByTripId(tripId, session);
};

const countRouteMismatchesByTripId = (tripId, routeId) => {
  return orderRepository.countRouteMismatchesByTripId(tripId, routeId);
};

const getByTripId = async ({
  tripId,
  page = 1,
  limit = 20,
  sort = { createdAt: -1 },
  user = null,
} = {}) => {
  const trip = await tripService.getById(tripId, false, user);
  orderAccess.assertDriverAssignedToTrip(trip, user);

  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const limitNumber = Math.max(1, parseInt(limit, 10) || 20);
  const skip = (pageNumber - 1) * limitNumber;

  const [orders, total] = await Promise.all([
    orderRepository.findByTripId(tripId, {
      skip,
      limit: limitNumber,
      sort,
    }),
    orderRepository.countByTripId(tripId),
  ]);

  return {
    data: orders,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages: Math.ceil(total / limitNumber),
    },
  };
};

const assignOrdersToTrip = async ({ tripId, orderIds = [] }, user = null) => {
  const trip = await tripService.getById(tripId, true, user);
  if (trip.status !== TRIP_STATUSES.PLANNED) {
    throw new ApiError(400, ORDER_MESSAGES.TRIP_NOT_PLANNED);
  }

  const tripWarehouseId =
    trip.warehouseId ||
    trip.driverId?.warehouseId?._id ||
    trip.driverId?.warehouseId;

  const orders = await orderRepository.findByIds(orderIds);
  if (orders.length !== orderIds.length) {
    throw new ApiError(404, ORDER_MESSAGES.ORDERS_NOT_FOUND);
  }

  const isOrderAssignable = (order, targetTrip) =>
    targetTrip.type === TRIP_TYPES.PICKUP
      ? PICKUP_ASSIGNABLE_ORDER_STATUSES.includes(order.status)
      : order.status === ORDER_STATUSES.STORED;
  const invalidOrder = orders.find((order) => !isOrderAssignable(order, trip));
  if (invalidOrder) {
    throw new ApiError(400, ORDER_MESSAGES.ORDER_TRIP_TYPE_MISMATCH);
  }

  for (const order of orders) {
    await orderAccess.assertOrderWarehouseAccess(order, user);

    const assignedTripId = order.tripId?._id || order.tripId;
    if (assignedTripId && assignedTripId.toString() !== tripId.toString()) {
      throw new ApiError(409, ORDER_MESSAGES.ORDER_ALREADY_ASSIGNED);
    }

    const orderRouteId = order.routeId?._id || order.routeId;
    const tripRouteId = trip.routeId?._id || trip.routeId;
    if (
      trip.type === TRIP_TYPES.TRANSFER &&
      (!orderRouteId || orderRouteId.toString() !== tripRouteId?.toString())
    ) {
      throw new ApiError(400, ORDER_MESSAGES.ROUTE_TRIP_MISMATCH);
    }

    const orderWarehouseId = order.warehouseId?._id || order.warehouseId;
    if (
      orderWarehouseId &&
      orderWarehouseId.toString() !== tripWarehouseId?.toString()
    ) {
      throw new ApiError(400, WAREHOUSE_MESSAGES.ACCESS_DENIED);
    }

    const orderDestinationWarehouseId =
      order.destinationWarehouseId?._id || order.destinationWarehouseId;
    if (
      trip.type === TRIP_TYPES.DELIVERY &&
      orderDestinationWarehouseId &&
      tripWarehouseId &&
      orderDestinationWarehouseId.toString() !== tripWarehouseId.toString()
    ) {
      throw new ApiError(400, ORDER_MESSAGES.TRANSFER_REQUIRED_BEFORE_DELIVERY);
    }
  }

  if (user?.role === ROLES.DISPATCHER) {
    for (const order of orders) {
      if (!order.warehouseId && !order.tripId) {
        throw new ApiError(403, WAREHOUSE_MESSAGES.INVALID_WAREHOUSE_REF);
      }
    }
  }

  await assertTripCapacity(trip, orders);

  const storedOrderIds = orders
    .filter((o) => o.status === ORDER_STATUSES.STORED)
    .map((o) => o._id);

  const pickupOrderIds = orders
    .filter((o) => o.status !== ORDER_STATUSES.STORED)
    .map((o) => o._id);

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const currentTrip = await tripService.getById(tripId, true, user, session);
    if (currentTrip.status !== TRIP_STATUSES.PLANNED) {
      throw new ApiError(400, ORDER_MESSAGES.TRIP_NOT_PLANNED);
    }
    const currentTripWarehouseId =
      currentTrip.warehouseId ||
      currentTrip.driverId?.warehouseId?._id ||
      currentTrip.driverId?.warehouseId;
    const currentTripRouteId = currentTrip.routeId?._id || currentTrip.routeId;
    const currentOrders = await orderRepository.findByIds(orderIds, session);
    if (currentOrders.length !== orderIds.length) {
      throw new ApiError(404, ORDER_MESSAGES.ORDERS_NOT_FOUND);
    }
    for (const order of currentOrders) {
      await orderAccess.assertOrderWarehouseAccess(order, user);
      if (!isOrderAssignable(order, currentTrip)) {
        throw new ApiError(400, ORDER_MESSAGES.ORDER_TRIP_TYPE_MISMATCH);
      }

      const currentAssignedTripId = order.tripId?._id || order.tripId;
      if (
        currentAssignedTripId &&
        currentAssignedTripId.toString() !== tripId.toString()
      ) {
        throw new ApiError(409, ORDER_MESSAGES.ORDER_ALREADY_ASSIGNED);
      }

      const currentOrderRouteId = order.routeId?._id || order.routeId;
      if (
        currentTrip.type === TRIP_TYPES.TRANSFER &&
        (!currentOrderRouteId ||
          currentOrderRouteId.toString() !== currentTripRouteId?.toString())
      ) {
        throw new ApiError(400, ORDER_MESSAGES.ROUTE_TRIP_MISMATCH);
      }

      const currentOrderWarehouseId =
        order.warehouseId?._id || order.warehouseId;
      if (
        currentOrderWarehouseId &&
        currentOrderWarehouseId.toString() !==
          currentTripWarehouseId?.toString()
      ) {
        throw new ApiError(400, WAREHOUSE_MESSAGES.ACCESS_DENIED);
      }

      const currentOrderDestinationWarehouseId =
        order.destinationWarehouseId?._id || order.destinationWarehouseId;
      if (
        currentTrip.type === TRIP_TYPES.DELIVERY &&
        currentOrderDestinationWarehouseId &&
        currentTripWarehouseId &&
        currentOrderDestinationWarehouseId.toString() !==
          currentTripWarehouseId.toString()
      ) {
        throw new ApiError(
          400,
          ORDER_MESSAGES.TRANSFER_REQUIRED_BEFORE_DELIVERY,
        );
      }
    }

    await assertTripCapacity(currentTrip, currentOrders, session);

    if (storedOrderIds.length > 0) {
      const result = await orderRepository.updateMany(
        {
          _id: { $in: storedOrderIds },
          status: ORDER_STATUSES.STORED,
          $or: [{ tripId: null }, { tripId }],
        },
        { tripId, warehouseId: currentTripWarehouseId },
        session,
      );
      if (result.modifiedCount !== storedOrderIds.length) {
        throw new ApiError(409, ORDER_MESSAGES.ORDER_ASSIGNMENT_CHANGED);
      }
    }

    if (pickupOrderIds.length > 0) {
      const result = await orderRepository.updateMany(
        {
          _id: { $in: pickupOrderIds },
          status: { $in: PICKUP_ASSIGNABLE_ORDER_STATUSES },
          $or: [{ tripId: null }, { tripId }],
        },
        {
          tripId,
          status: ORDER_STATUSES.DRIVER_ASSIGNED,
          warehouseId: currentTripWarehouseId,
        },
        session,
      );
      if (result.modifiedCount !== pickupOrderIds.length) {
        throw new ApiError(409, ORDER_MESSAGES.ORDER_ASSIGNMENT_CHANGED);
      }
    }

    for (const order of currentOrders) {
      await orderTrackingLogRepository.create(
        {
          orderId: order._id,
          tripId,
          status:
            order.status === ORDER_STATUSES.STORED
              ? ORDER_STATUSES.STORED
              : ORDER_STATUSES.DRIVER_ASSIGNED,
          notes: `Đơn hàng được gán vào chuyến ${currentTrip.tripCode || tripId}`,
          changedBy: user?.userId || user?._id,
        },
        session,
      );
    }

    await tripService.syncTotalOrder(tripId, session);

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  return { assignedCount: orderIds.length, tripId };
};

const unassignOrdersFromTrip = async ({ orderIds = [] }, user = null) => {
  const orders = await orderRepository.findByIds(orderIds);
  if (orders.length !== orderIds.length) {
    throw new ApiError(404, ORDER_MESSAGES.ORDERS_NOT_FOUND);
  }

  for (const order of orders) {
    await orderAccess.assertOrderWarehouseAccess(order, user);
    if (!order.tripId) {
      throw new ApiError(400, ORDER_MESSAGES.ORDER_NOT_ASSIGNED);
    }

    const trip = await tripService.getById(order.tripId, false, user);
    const canReleaseResolvedOrder =
      [TRIP_STATUSES.COMPLETED, TRIP_STATUSES.CANCELLED].includes(
        trip.status,
      ) &&
      (trip.type === TRIP_TYPES.PICKUP
        ? [
            ORDER_STATUSES.DRIVER_ASSIGNED,
            ORDER_STATUSES.PICKUP_SCHEDULED,
            ORDER_STATUSES.FAILED,
          ].includes(order.status)
        : [
            ORDER_STATUSES.STORED,
            ORDER_STATUSES.FAILED,
            ORDER_STATUSES.RETURNED,
          ].includes(order.status));
    if (trip.status !== TRIP_STATUSES.PLANNED && !canReleaseResolvedOrder) {
      throw new ApiError(400, ORDER_MESSAGES.TRIP_NOT_PLANNED);
    }

    if (
      ![
        ORDER_STATUSES.STORED,
        ORDER_STATUSES.DRIVER_ASSIGNED,
        ORDER_STATUSES.PICKUP_SCHEDULED,
        ORDER_STATUSES.FAILED,
        ORDER_STATUSES.RETURNED,
      ].includes(order.status)
    ) {
      throw new ApiError(
        400,
        ORDER_MESSAGES.CANNOT_UNASSIGN_ORDER_STATUS(
          order.orderCode,
          order.status,
        ),
      );
    }
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const affectedTripIds = new Map();
    for (const order of orders) {
      const sourceTripId = order.tripId?._id || order.tripId;
      const sourceTrip = await tripService.getById(
        sourceTripId,
        false,
        user,
        session,
      );

      const canReleaseResolvedOrder =
        [TRIP_STATUSES.COMPLETED, TRIP_STATUSES.CANCELLED].includes(
          sourceTrip.status,
        ) &&
        (sourceTrip.type === TRIP_TYPES.PICKUP
          ? [
              ORDER_STATUSES.DRIVER_ASSIGNED,
              ORDER_STATUSES.PICKUP_SCHEDULED,
              ORDER_STATUSES.FAILED,
            ].includes(order.status)
          : [
              ORDER_STATUSES.STORED,
              ORDER_STATUSES.FAILED,
              ORDER_STATUSES.RETURNED,
            ].includes(order.status));
      if (
        sourceTrip.status !== TRIP_STATUSES.PLANNED &&
        !canReleaseResolvedOrder
      ) {
        throw new ApiError(400, ORDER_MESSAGES.TRIP_NOT_PLANNED);
      }

      const tripWarehouseId =
        sourceTrip.warehouseId ||
        sourceTrip.driverId?.warehouseId?._id ||
        sourceTrip.driverId?.warehouseId;
      const updateData =
        order.status === ORDER_STATUSES.STORED
          ? { tripId: null }
          : [ORDER_STATUSES.FAILED, ORDER_STATUSES.RETURNED].includes(
                order.status,
              )
            ? { tripId: null, status: ORDER_STATUSES.STORED }
            : { tripId: null, status: ORDER_STATUSES.CREATED };
      if (!order.warehouseId) {
        updateData.warehouseId = tripWarehouseId;
      }

      const updatedOrder = await orderRepository.updateById(
        order._id,
        updateData,
        session,
        { tripId: sourceTripId, status: order.status, deletedAt: null },
      );
      if (!updatedOrder) {
        throw new ApiError(409, ORDER_MESSAGES.ORDER_ASSIGNMENT_CHANGED);
      }

      affectedTripIds.set(sourceTripId.toString(), sourceTripId);
    }

    for (const tripId of affectedTripIds.values()) {
      await tripService.syncTotalOrder(tripId, session);
    }

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  return { unassignedCount: orders.length };
};

const countUnfinishedOrdersByTrip = async (trip, session = null) => {
  const tripId = trip._id || trip;
  const tripType = trip.type;
  return orderRepository.countUnfinishedOrdersByTrip(tripId, tripType, session);
};

const handleOrdersOnTripCompletion = async (
  trip,
  session = null,
  user = null,
) => {
  const tripId = trip._id || trip;
  const tripType = trip.type;
  const actorId = user?.userId || user?._id;

  if (tripType === TRIP_TYPES.PICKUP) {
    const failedOrders = await orderRepository.findRawByFilter(
      {
        tripId,
        status: ORDER_STATUSES.FAILED,
        deletedAt: null,
      },
      session,
    );

    for (const order of failedOrders) {
      await orderRepository.updateById(
        order._id,
        { tripId: null, status: ORDER_STATUSES.CREATED },
        session,
      );
      await orderTrackingLogRepository.create(
        {
          orderId: order._id,
          tripId,
          status: ORDER_STATUSES.CREATED,
          notes:
            "Chuyến xe kết thúc, đơn lấy hàng thất bại được hoàn về trạng thái chờ điều phối",
          changedBy: actorId,
        },
        session,
      );
    }
  } else {
    const failedOrders = await orderRepository.findRawByFilter(
      {
        tripId,
        status: { $in: [ORDER_STATUSES.FAILED, ORDER_STATUSES.RETURNED] },
        deletedAt: null,
      },
      session,
    );

    for (const order of failedOrders) {
      const nextStatus =
        order.status === ORDER_STATUSES.RETURNED
          ? ORDER_STATUSES.RETURNED
          : ORDER_STATUSES.STORED;

      await orderRepository.updateById(
        order._id,
        { tripId: null, status: nextStatus },
        session,
      );

      await orderTrackingLogRepository.create(
        {
          orderId: order._id,
          tripId,
          status: nextStatus,
          notes:
            nextStatus === ORDER_STATUSES.RETURNED
              ? "Chuyến xe kết thúc, đơn hàng chuyển trạng thái chuyển hoàn"
              : "Chuyến xe kết thúc, đơn hàng chưa giao thành công được trả về kho",
          changedBy: actorId,
        },
        session,
      );
    }
  }
};

const handleOrdersOnTripCancellation = async (
  trip,
  session = null,
  user = null,
) => {
  const tripId = trip._id || trip;
  const tripType = trip.type;
  const actorId = user?.userId || user?._id;

  const orders = await orderRepository.findRawByFilter(
    { tripId, deletedAt: null },
    session,
  );

  for (const order of orders) {
    const nextStatus =
      tripType === TRIP_TYPES.PICKUP
        ? ORDER_STATUSES.CREATED
        : ORDER_STATUSES.STORED;

    await orderRepository.updateById(
      order._id,
      { tripId: null, status: nextStatus },
      session,
    );

    await orderTrackingLogRepository.create(
      {
        orderId: order._id,
        tripId,
        status: nextStatus,
        notes: "Chuyến xe bị hủy, đơn hàng được gỡ khỏi chuyến xe",
        changedBy: actorId,
      },
      session,
    );
  }
};

export default {
  getTripLoadMetrics,
  assertTripCapacity,
  countByTripId,
  countRouteMismatchesByTripId,
  getByTripId,
  assignOrdersToTrip,
  unassignOrdersFromTrip,
  countUnfinishedOrdersByTrip,
  handleOrdersOnTripCompletion,
  handleOrdersOnTripCancellation,
};
