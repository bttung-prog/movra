import mongoose from "mongoose";

import { TRIP_TYPES } from "../../constants/tripTypes.js";
import { TRIP_STATUSES } from "../../constants/tripStatuses.js";
import { VEHICLE_STATUSES } from "../../constants/vehicleStatuses.js";
import { USER_STATUSES } from "../../constants/userStatuses.js";
import { TRIP_MESSAGES } from "../../constants/messages.js";

import { ApiError } from "../../utils/ApiError.js";
import { generateCode } from "../../utils/generateCode.js";
import { checkWarehouseAccess } from "../../utils/checkWarehouseAccess.js";
import { getActorUserId } from "../../utils/actor.util.js";

import driverService from "../driver/driver.service.js";
import vehicleService from "../vehicle/vehicle.service.js";
import routeService from "../route/route.service.js";
import orderService from "../order/order.service.js";
import orderAssignmentService from "../order/orderAssignment.service.js";

import tripRepository from "./trip.repository.js";
import tripAuditLogRepository from "./tripAuditLog.repository.js";
import tripAccess from "./trip.access.js";
import tripAudit from "./trip.audit.js";

const validateTrip = (trip, requireNotDeleted = true) => {
  if (!trip) {
    throw new ApiError(404, TRIP_MESSAGES.NOT_FOUND);
  }

  if (requireNotDeleted && trip.deletedAt !== null) {
    throw new ApiError(400, TRIP_MESSAGES.ALREADY_DELETED);
  }

  return trip;
};

const lockTripScheduleResources = async ({ vehicleId, driverId }, session) => {
  const locked = await tripRepository.lockScheduleResources(
    { vehicleId, driverId },
    session,
  );

  if (!locked) {
    throw new ApiError(409, TRIP_MESSAGES.SCHEDULE_RESOURCE_UNAVAILABLE);
  }
};

const checkTripOverlap = async ({
  vehicleId,
  driverId,
  plannedStart,
  plannedEnd,
  excludeTripId = null,
  session = null,
}) => {
  const conflictingTrip = await tripRepository.findOverlappingTrip({
    vehicleId,
    driverId,
    plannedStart,
    plannedEnd,
    excludeTripId,
    session,
  });

  if (conflictingTrip) {
    if (
      vehicleId &&
      conflictingTrip.vehicleId?.toString() === vehicleId.toString()
    ) {
      throw new ApiError(
        400,
        TRIP_MESSAGES.VEHICLE_BUSY(conflictingTrip.tripCode),
      );
    }

    if (
      driverId &&
      conflictingTrip.driverId?.toString() === driverId.toString()
    ) {
      throw new ApiError(
        400,
        TRIP_MESSAGES.DRIVER_BUSY(conflictingTrip.tripCode),
      );
    }
  }
};

// ==========================================
// TRIP CORE SERVICES
// ==========================================

const create = async ({
  vehicleId,
  driverId,
  routeId = null,
  type = TRIP_TYPES.DELIVERY,
  plannedStart,
  plannedEnd,
  user = null,
}) => {
  if (type === TRIP_TYPES.TRANSFER && !routeId) {
    throw new ApiError(400, TRIP_MESSAGES.ROUTE_REQUIRED);
  }

  const startDate = new Date(plannedStart);
  const endDate = new Date(plannedEnd);

  const [vehicle, driver, route] = await Promise.all([
    vehicleService.getById(vehicleId, user),
    driverService.getById(driverId),
    routeId ? routeService.getById(routeId) : Promise.resolve(null),
  ]);

  if (driver.status !== USER_STATUSES.ACTIVE) {
    throw new ApiError(400, TRIP_MESSAGES.DRIVER_NOT_ACTIVE);
  }
  driverService.ensureLicenseIsValid(driver.licenseExpiryDate);

  checkWarehouseAccess(driver.warehouseId, user);

  const warehouseId = driver.warehouseId?._id || driver.warehouseId;
  if (route) {
    tripAccess.validateRouteOriginWarehouse(route, warehouseId);
  }

  const vehicleWarehouseId = vehicle.warehouseId?._id || vehicle.warehouseId;
  if (
    vehicleWarehouseId &&
    vehicleWarehouseId.toString() !== warehouseId?.toString()
  ) {
    throw new ApiError(400, TRIP_MESSAGES.VEHICLE_WAREHOUSE_MISMATCH);
  }

  if (
    vehicle.status === VEHICLE_STATUSES.MAINTENANCE ||
    vehicle.status === VEHICLE_STATUSES.RETIRED
  ) {
    throw new ApiError(
      400,
      TRIP_MESSAGES.VEHICLE_STATUS_INVALID(vehicle.status),
    );
  }

  let tripCode;
  let isUnique = false;
  let attempts = 0;

  while (!isUnique && attempts < 5) {
    tripCode = generateCode("TRIP-");

    const existing = await tripRepository.findByCode(tripCode);

    if (!existing) {
      isUnique = true;
    }

    attempts += 1;
  }

  if (!isUnique) {
    throw new ApiError(500, TRIP_MESSAGES.CODE_GEN_FAILED);
  }

  const session = await mongoose.startSession();

  try {
    return await session.withTransaction(async () => {
      await lockTripScheduleResources({ vehicleId, driverId }, session);
      await checkTripOverlap({
        vehicleId,
        driverId,
        plannedStart: startDate,
        plannedEnd: endDate,
        session,
      });
      await vehicleService.assignToWarehouse(vehicleId, warehouseId, session);

      const trip = await tripRepository.create(
        {
          tripCode,
          vehicleId,
          driverId,
          routeId,
          warehouseId,
          type,
          plannedStart: startDate,
          plannedEnd: endDate,
          status: TRIP_STATUSES.PLANNED,
          totalOrder: 0,
        },
        session,
      );
      const snapshot = tripAudit.getTripSnapshot(trip);
      await tripAuditLogRepository.create(
        {
          tripId: trip._id,
          action: "created",
          performedBy: getActorUserId(user),
          changes: tripAudit.getAuditChanges(
            {},
            snapshot,
            Object.keys(snapshot),
          ),
        },
        session,
      );
      return trip;
    });
  } finally {
    session.endSession();
  }
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

  const queryFilter = await tripAccess.scopeTripFilter(
    { deletedAt: null, ...filter },
    user,
  );

  const [trips, total] = await Promise.all([
    tripRepository.findAll({
      filter: queryFilter,
      skip,
      limit: limitNumber,
      sort,
    }),
    tripRepository.countAll({ filter: queryFilter }),
  ]);

  return {
    data: trips,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages: Math.ceil(total / limitNumber),
    },
  };
};

const getById = async (
  tripId,
  requireNotDeleted = true,
  user = null,
  session = null,
) => {
  const trip = await tripRepository.findById(tripId, session);
  const validatedTrip = validateTrip(trip, requireNotDeleted);
  await tripAccess.assertTripWarehouseAccess(validatedTrip, user);
  return validatedTrip;
};

const getByIds = async (tripIds = [], session = null) => {
  const uniqueTripIds = [
    ...new Set(
      (tripIds || []).map((tripId) => tripId?.toString()).filter(Boolean),
    ),
  ];

  if (uniqueTripIds.length === 0) {
    return [];
  }

  const trips = await tripRepository.findByIds(uniqueTripIds, session);
  if (trips.length !== uniqueTripIds.length) {
    throw new ApiError(404, TRIP_MESSAGES.NOT_FOUND);
  }

  return trips;
};

const assertTripAccess = async (trip, user = null) => {
  await tripAccess.assertTripWarehouseAccess(trip, user);
};

const getByCode = async (tripCode, user = null) => {
  const trip = await tripRepository.findByCode(tripCode);
  const validatedTrip = validateTrip(trip, true);
  await tripAccess.assertTripWarehouseAccess(validatedTrip, user);
  return validatedTrip;
};

const countAll = async ({ filter = {}, user = null } = {}) => {
  const scopedFilter = await tripAccess.scopeTripFilter(filter, user);
  return tripRepository.countAll({ filter: scopedFilter });
};

const countActiveByDriverId = (driverId) => {
  return tripRepository.countActiveByDriverId(driverId);
};

const countActiveByVehicleId = (vehicleId, session = null) => {
  return tripRepository.countActiveByVehicleId(vehicleId, session);
};

const findActiveByVehicleId = (vehicleId, session = null) => {
  return tripRepository.findActiveByVehicleId(vehicleId, session);
};

const getIdsByWarehouseId = async (warehouseId) => {
  const [driverIds, vehicleIds] = await Promise.all([
    driverService.getIdsByWarehouseId(warehouseId),
    vehicleService.getIdsByWarehouseId(warehouseId),
  ]);
  return tripRepository.findIdsByWarehouseId(
    warehouseId,
    driverIds,
    vehicleIds,
  );
};

const syncTotalOrder = async (tripId, session = null) => {
  const synchronize = async (activeSession) => {
    const currentTrip = validateTrip(
      await tripRepository.findById(tripId, activeSession),
      false,
    );
    const totalOrder = await orderAssignmentService.countByTripId(
      tripId,
      activeSession,
    );
    const updatedTrip = await tripRepository.setTotalOrder(
      tripId,
      totalOrder,
      activeSession,
    );
    const changes = tripAudit.getAuditChanges(currentTrip, updatedTrip, [
      "totalOrder",
    ]);

    if (changes.length > 0) {
      await tripAuditLogRepository.create(
        {
          tripId,
          action: "updated",
          performedBy: null,
          changes,
        },
        activeSession,
      );
    }

    return updatedTrip;
  };

  if (session) return synchronize(session);

  const localSession = await mongoose.startSession();
  try {
    return await localSession.withTransaction(() => synchronize(localSession));
  } finally {
    localSession.endSession();
  }
};

const syncTotalOrders = async (tripIds = [], session = null) => {
  const uniqueTripIds = [
    ...new Set(
      (tripIds || []).map((tripId) => tripId?.toString()).filter(Boolean),
    ),
  ];

  if (uniqueTripIds.length === 0) {
    return [];
  }

  const synchronize = async (activeSession) => {
    const trips = await tripRepository.findByIds(uniqueTripIds, activeSession);
    if (trips.length !== uniqueTripIds.length) {
      throw new ApiError(404, TRIP_MESSAGES.NOT_FOUND);
    }

    const counts = await orderAssignmentService.countByTripIds(
      uniqueTripIds,
      activeSession,
    );
    const totalOrderByTripId = new Map(
      counts.map((item) => [item._id.toString(), item.count]),
    );

    const operations = [];
    const auditLogs = [];

    for (const trip of trips) {
      const totalOrder = totalOrderByTripId.get(trip._id.toString()) || 0;
      operations.push({
        updateOne: {
          filter: { _id: trip._id },
          update: { $set: { totalOrder } },
        },
      });

      const changes = tripAudit.getAuditChanges(trip, { ...trip, totalOrder }, [
        "totalOrder",
      ]);
      if (changes.length > 0) {
        auditLogs.push({
          tripId: trip._id,
          action: "updated",
          performedBy: null,
          changes,
        });
      }
    }

    await tripRepository.setTotalOrders(operations, activeSession);
    if (auditLogs.length > 0) {
      await tripAuditLogRepository.insertMany(auditLogs, activeSession);
    }

    return operations.length;
  };

  if (session) return synchronize(session);

  const localSession = await mongoose.startSession();
  try {
    return await localSession.withTransaction(() => synchronize(localSession));
  } finally {
    localSession.endSession();
  }
};

const updateById = async (tripId, updateData, user = null) => {
  const existingTrip = await getById(tripId, true, user);

  if (
    updateData.type !== undefined &&
    updateData.type !== existingTrip.type &&
    (await orderService.countAll({
      filter: { tripId, deletedAt: null },
    })) > 0
  ) {
    throw new ApiError(400, TRIP_MESSAGES.TRIP_TYPE_HAS_ORDERS);
  }

  if (updateData.totalOrder !== undefined) {
    throw new ApiError(400, TRIP_MESSAGES.TOTAL_ORDER_SYSTEM_MANAGED);
  }

  if (updateData.vehicleId !== undefined || updateData.driverId !== undefined) {
    throw new ApiError(400, TRIP_MESSAGES.REASSIGN_ENDPOINT_REQUIRED);
  }

  const plannedStart = updateData.plannedStart
    ? new Date(updateData.plannedStart)
    : new Date(existingTrip.plannedStart);
  const plannedEnd = updateData.plannedEnd
    ? new Date(updateData.plannedEnd)
    : new Date(existingTrip.plannedEnd);

  if (plannedStart >= plannedEnd) {
    throw new ApiError(400, TRIP_MESSAGES.START_BEFORE_END);
  }

  const effectiveType = updateData.type || existingTrip.type;
  if (effectiveType === TRIP_TYPES.TRANSFER) {
    const effectiveRouteId =
      updateData.routeId !== undefined
        ? updateData.routeId
        : existingTrip.routeId;
    if (!effectiveRouteId) {
      throw new ApiError(400, TRIP_MESSAGES.ROUTE_REQUIRED);
    }
  }

  if (updateData.routeId) {
    const route = await routeService.getById(updateData.routeId);
    const operationalWarehouseId =
      existingTrip.warehouseId ||
      existingTrip.driverId?.warehouseId?._id ||
      existingTrip.driverId?.warehouseId;
    tripAccess.validateRouteOriginWarehouse(route, operationalWarehouseId);
  }

  if (updateData.routeId) {
    const mismatchedOrders =
      await orderAssignmentService.countRouteMismatchesByTripId(
        tripId,
        updateData.routeId,
      );
    if (mismatchedOrders > 0) {
      throw new ApiError(400, TRIP_MESSAGES.ROUTE_HAS_ORDERS);
    }
  }

  const scheduleChanged =
    updateData.plannedStart !== undefined ||
    updateData.plannedEnd !== undefined;

  const session = await mongoose.startSession();

  try {
    return await session.withTransaction(async () => {
      const currentTrip = validateTrip(
        await tripRepository.findById(tripId, session),
      );
      const vehicleId = currentTrip.vehicleId?._id || currentTrip.vehicleId;
      const driverId = currentTrip.driverId?._id || currentTrip.driverId;
      const currentStart = updateData.plannedStart
        ? new Date(updateData.plannedStart)
        : new Date(currentTrip.plannedStart);
      const currentEnd = updateData.plannedEnd
        ? new Date(updateData.plannedEnd)
        : new Date(currentTrip.plannedEnd);

      if (currentStart >= currentEnd) {
        throw new ApiError(400, TRIP_MESSAGES.START_BEFORE_END);
      }

      if (scheduleChanged) {
        await lockTripScheduleResources({ vehicleId, driverId }, session);
        await checkTripOverlap({
          vehicleId,
          driverId,
          plannedStart: currentStart,
          plannedEnd: currentEnd,
          excludeTripId: tripId,
          session,
        });
      }

      const updatedTrip = validateTrip(
        await tripRepository.updateById(tripId, updateData, session),
      );
      const changes = tripAudit.getAuditChanges(
        currentTrip,
        updatedTrip,
        Object.keys(updateData),
      );
      if (changes.length > 0) {
        await tripAuditLogRepository.create(
          {
            tripId,
            action: "updated",
            performedBy: getActorUserId(user),
            changes,
          },
          session,
        );
      }
      return updatedTrip;
    });
  } finally {
    session.endSession();
  }
};

const deleteById = async (tripId, user = null) => {
  const trip = await getById(tripId, true, user);

  if (trip.status === TRIP_STATUSES.IN_PROGRESS) {
    throw new ApiError(400, TRIP_MESSAGES.CANNOT_DELETE_IN_PROGRESS);
  }

  const activeOrdersCount = await orderService.countAll({
    filter: { tripId, deletedAt: null },
  });

  if (activeOrdersCount > 0) {
    throw new ApiError(
      400,
      TRIP_MESSAGES.CANNOT_DELETE_ACTIVE_ORDERS(activeOrdersCount),
    );
  }

  const session = await mongoose.startSession();

  try {
    return await session.withTransaction(async () => {
      const currentTrip = validateTrip(
        await tripRepository.findById(tripId, session),
      );
      if (currentTrip.status === TRIP_STATUSES.IN_PROGRESS) {
        throw new ApiError(400, TRIP_MESSAGES.CANNOT_DELETE_IN_PROGRESS);
      }
      const deletedTrip = validateTrip(
        await tripRepository.deleteById(tripId, session),
      );
      await tripAuditLogRepository.create(
        {
          tripId,
          action: "deleted",
          performedBy: getActorUserId(user),
          changes: tripAudit.getAuditChanges(currentTrip, deletedTrip, [
            "deletedAt",
          ]),
        },
        session,
      );
      return deletedTrip;
    });
  } finally {
    session.endSession();
  }
};

const restoreById = async (tripId, user = null) => {
  const trip = await getById(tripId, false, user);

  if (trip.deletedAt === null) {
    throw new ApiError(400, TRIP_MESSAGES.NOT_DELETED);
  }

  const driver = await driverService.getById(
    trip.driverId?._id || trip.driverId,
  );
  if (driver.status !== USER_STATUSES.ACTIVE) {
    throw new ApiError(400, TRIP_MESSAGES.DRIVER_NOT_ACTIVE);
  }
  driverService.ensureLicenseIsValid(driver.licenseExpiryDate);

  const session = await mongoose.startSession();

  try {
    return await session.withTransaction(async () => {
      const currentTrip = validateTrip(
        await tripRepository.findById(tripId, session),
        false,
      );
      if (currentTrip.deletedAt === null) {
        throw new ApiError(400, TRIP_MESSAGES.NOT_DELETED);
      }

      const currentVehicleId =
        currentTrip.vehicleId?._id || currentTrip.vehicleId;
      const currentDriverId = currentTrip.driverId?._id || currentTrip.driverId;
      await lockTripScheduleResources(
        { vehicleId: currentVehicleId, driverId: currentDriverId },
        session,
      );
      await checkTripOverlap({
        vehicleId: currentVehicleId,
        driverId: currentDriverId,
        plannedStart: currentTrip.plannedStart,
        plannedEnd: currentTrip.plannedEnd,
        excludeTripId: tripId,
        session,
      });

      const restoredTrip = validateTrip(
        await tripRepository.restoreById(tripId, session),
        false,
      );
      await tripAuditLogRepository.create(
        {
          tripId,
          action: "restored",
          performedBy: getActorUserId(user),
          changes: tripAudit.getAuditChanges(currentTrip, restoredTrip, [
            "deletedAt",
          ]),
        },
        session,
      );
      return restoredTrip;
    });
  } finally {
    session.endSession();
  }
};

const getStatsByStatus = async ({ filter = {}, warehouseId = null } = {}) => {
  return tripRepository.countByStatus(
    { deletedAt: null, ...filter },
    warehouseId,
  );
};

const getTopDriverPerformance = async ({
  limit = 5,
  warehouseId = null,
} = {}) => {
  return tripRepository.getTopDriverPerformance({ limit, warehouseId });
};

export default {
  create,
  getAll,
  getById,
  getByIds,
  assertTripAccess,
  getByCode,
  countAll,
  countActiveByDriverId,
  countActiveByVehicleId,
  findActiveByVehicleId,
  getIdsByWarehouseId,
  syncTotalOrder,
  syncTotalOrders,
  updateById,
  deleteById,
  restoreById,
  getStatsByStatus,
  getTopDriverPerformance,
};
