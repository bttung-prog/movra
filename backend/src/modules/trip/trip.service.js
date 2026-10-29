import mongoose from "mongoose";

import TRIP_TYPES from "../../constants/tripTypes.js";
import ROLES from "../../constants/roles.js";
import {
  COMMON_MESSAGES,
  TRIP_MESSAGES,
  WAREHOUSE_MESSAGES,
} from "../../constants/messages.js";

import ApiError from "../../utils/ApiError.js";
import generateCode from "../../utils/generateCode.js";
import checkWarehouseAccess from "../../utils/checkWarehouseAccess.js";

import driverService from "../driver/driver.service.js";
import vehicleService from "../vehicle/vehicle.service.js";
import routeService from "../route/route.service.js";
import userService from "../user/user.service.js";
import orderService from "../order/order.service.js";

import tripRepository from "./trip.repository.js";

const validateTrip = (trip, requireNotDeleted = true) => {
  if (!trip) {
    throw new ApiError(404, TRIP_MESSAGES.NOT_FOUND);
  }

  if (requireNotDeleted && trip.deletedAt !== null) {
    throw new ApiError(400, TRIP_MESSAGES.ALREADY_DELETED);
  }

  return trip;
};

const getReferenceId = (value) => {
  return value?._id || value || null;
};

const sameReference = (left, right) => {
  return getReferenceId(left)?.toString() === getReferenceId(right)?.toString();
};

const normalizeAuditValue = (value) => {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (value?._id) return value._id.toString();
  if (
    typeof value === "object" &&
    typeof value.toString === "function" &&
    value.toString() !== "[object Object]"
  ) {
    return value.toString();
  }
  return value;
};

const getAuditChanges = (before, after, fields) =>
  fields.flatMap((field) => {
    const oldValue = normalizeAuditValue(before?.[field]);
    const newValue = normalizeAuditValue(after?.[field]);
    return JSON.stringify(oldValue) === JSON.stringify(newValue)
      ? []
      : [{ field, oldValue, newValue }];
  });

const getTripSnapshot = (trip) => ({
  tripCode: trip.tripCode,
  vehicleId: trip.vehicleId,
  driverId: trip.driverId,
  warehouseId: trip.warehouseId,
  routeId: trip.routeId,
  type: trip.type,
  status: trip.status,
  plannedStart: trip.plannedStart,
  plannedEnd: trip.plannedEnd,
});

const getActorId = (user) => user?.userId || user?._id || null;

const validateRouteOriginWarehouse = (route, warehouseId) => {
  const originWarehouseId =
    route.originWarehouseId?._id || route.originWarehouseId;

  if (
    !warehouseId ||
    originWarehouseId?.toString() !== warehouseId.toString()
  ) {
    throw new ApiError(400, TRIP_MESSAGES.ROUTE_ORIGIN_WAREHOUSE_MISMATCH);
  }
};

const assertTripWarehouseAccess = async (trip, user) => {
  if (user?.role === ROLES.DRIVER) {
    const driver = await driverService.getByUserId(user._id);
    const assignedDriverId = trip.driverId?._id || trip.driverId;
    if (assignedDriverId?.toString() !== driver._id.toString()) {
      throw new ApiError(403, TRIP_MESSAGES.NOT_ASSIGNED_DRIVER);
    }
    return;
  }

  if (user?.role !== ROLES.DISPATCHER) return;

  if (trip.warehouseId) {
    checkWarehouseAccess(trip.warehouseId, user);
    const vehicleId = trip.vehicleId?._id || trip.vehicleId;
    if (vehicleId) {
      await vehicleService.getById(vehicleId, user);
    }
    return;
  }

  const driverId = trip.driverId?._id || trip.driverId;
  if (!driverId) {
    throw new ApiError(403, TRIP_MESSAGES.DRIVER_REQUIRED_FOR_WAREHOUSE_SCOPE);
  }

  const driver = await driverService.getById(driverId);
  checkWarehouseAccess(driver.warehouseId, user);

  const vehicleId = trip.vehicleId?._id || trip.vehicleId;
  if (vehicleId) {
    await vehicleService.getById(vehicleId, user);
  }
};

const scopeTripFilter = async (filter, user) => {
  if (user?.role === ROLES.DRIVER) {
    const driver = await driverService.getByUserId(user._id);
    return { $and: [filter, { driverId: driver._id }] };
  }

  if (user?.role !== ROLES.DISPATCHER) return filter;
  if (!user.warehouseId) {
    throw new ApiError(403, WAREHOUSE_MESSAGES.DISPATCHER_NOT_ASSIGNED);
  }

  const driverIds = await driverService.getIdsByWarehouseId(user.warehouseId);
  const vehicleIds = await vehicleService.getIdsByWarehouseId(user.warehouseId);
  return {
    $and: [
      filter,
      {
        $or: [
          { warehouseId: user.warehouseId },
          {
            warehouseId: null,
            driverId: { $in: driverIds },
            vehicleId: { $in: vehicleIds },
          },
        ],
      },
    ],
  };
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
  routeId,
  type = TRIP_TYPES.DELIVERY,
  plannedStart,
  plannedEnd,
  user = null,
}) => {
  const startDate = new Date(plannedStart);
  const endDate = new Date(plannedEnd);

  if (startDate >= endDate) {
    throw new ApiError(400, TRIP_MESSAGES.START_BEFORE_END);
  }

  const [vehicle, driver, route] = await Promise.all([
    vehicleService.getById(vehicleId, user),
    driverService.getById(driverId),
    routeId ? routeService.getById(routeId) : Promise.resolve(null),
  ]);

  if (type !== TRIP_TYPES.PICKUP && !route) {
    throw new ApiError(400, TRIP_MESSAGES.ROUTE_REQUIRED);
  }

  if (driver.status !== "active") {
    throw new ApiError(400, TRIP_MESSAGES.DRIVER_NOT_ACTIVE);
  }
  driverService.ensureLicenseIsValid(driver.licenseExpiryDate);

  checkWarehouseAccess(driver.warehouseId, user);

  const warehouseId = driver.warehouseId?._id || driver.warehouseId;
  if (route) {
    validateRouteOriginWarehouse(route, warehouseId);
  }

  const vehicleWarehouseId = vehicle.warehouseId?._id || vehicle.warehouseId;
  if (
    vehicleWarehouseId &&
    vehicleWarehouseId.toString() !== warehouseId?.toString()
  ) {
    throw new ApiError(400, TRIP_MESSAGES.VEHICLE_WAREHOUSE_MISMATCH);
  }

  if (vehicle.status === "maintenance" || vehicle.status === "retired") {
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
          status: "planned",
          totalOrder: 0,
        },
        session,
      );
      const snapshot = getTripSnapshot(trip);
      await tripRepository.createAuditLog(
        {
          tripId: trip._id,
          action: "created",
          performedBy: getActorId(user),
          changes: getAuditChanges({}, snapshot, Object.keys(snapshot)),
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

  const queryFilter = await scopeTripFilter(
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
  await assertTripWarehouseAccess(validatedTrip, user);
  return validatedTrip;
};

const getByCode = async (tripCode, user = null) => {
  const trip = await tripRepository.findByCode(tripCode);
  const validatedTrip = validateTrip(trip, true);
  await assertTripWarehouseAccess(validatedTrip, user);
  return validatedTrip;
};

const countAll = async ({ filter = {}, user = null } = {}) => {
  const scopedFilter = await scopeTripFilter(filter, user);
  return tripRepository.countAll({ filter: scopedFilter });
};

const countActiveByDriverId = (driverId) => {
  return tripRepository.countActiveByDriverId(driverId);
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
    const totalOrder = await orderService.countByTripId(tripId, activeSession);
    const updatedTrip = await tripRepository.setTotalOrder(
      tripId,
      totalOrder,
      activeSession,
    );
    const changes = getAuditChanges(currentTrip, updatedTrip, ["totalOrder"]);

    if (changes.length > 0) {
      await tripRepository.createAuditLog(
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

  if (updateData.type && updateData.type !== TRIP_TYPES.PICKUP) {
    const effectiveRouteId = updateData.routeId || existingTrip.routeId;
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
    validateRouteOriginWarehouse(route, operationalWarehouseId);
  }

  if (updateData.routeId) {
    const mismatchedOrders = await orderService.countRouteMismatchesByTripId(
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
      const changes = getAuditChanges(
        currentTrip,
        updatedTrip,
        Object.keys(updateData),
      );
      if (changes.length > 0) {
        await tripRepository.createAuditLog(
          {
            tripId,
            action: "updated",
            performedBy: getActorId(user),
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

  if (trip.status === "in_progress") {
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
      if (currentTrip.status === "in_progress") {
        throw new ApiError(400, TRIP_MESSAGES.CANNOT_DELETE_IN_PROGRESS);
      }
      const deletedTrip = validateTrip(
        await tripRepository.deleteById(tripId, session),
      );
      await tripRepository.createAuditLog(
        {
          tripId,
          action: "deleted",
          performedBy: getActorId(user),
          changes: getAuditChanges(currentTrip, deletedTrip, ["deletedAt"]),
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
  if (driver.status !== "active") {
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
      await tripRepository.createAuditLog(
        {
          tripId,
          action: "restored",
          performedBy: getActorId(user),
          changes: getAuditChanges(currentTrip, restoredTrip, ["deletedAt"]),
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

// ==========================================
// TRIP ASSIGNMENT (CHANGE DRIVER / VEHICLE)
// ==========================================

const reassign = async (
  tripId,
  { newDriverId, newVehicleId, reason, changedBy },
  user = null,
) => {
  const trip = await getById(tripId, true, user);

  if (trip.status === "completed" || trip.status === "cancelled") {
    throw new ApiError(400, TRIP_MESSAGES.CANNOT_REASSIGN_STATUS(trip.status));
  }

  if (trip.status === "in_progress" && (newVehicleId || newDriverId)) {
    throw new ApiError(400, TRIP_MESSAGES.CANNOT_REASSIGN_IN_PROGRESS);
  }

  if (!newDriverId && !newVehicleId) {
    throw new ApiError(400, TRIP_MESSAGES.REASSIGN_PARAMS_REQUIRED);
  }

  if (changedBy) {
    await userService.getById(changedBy);
  }

  const assignmentPayload = {
    tripId,
    reason,
    changedBy,
  };

  const tripUpdatePayload = {};

  if (newDriverId) {
    const driver = await driverService.getById(newDriverId);
    checkWarehouseAccess(driver.warehouseId, user);
    const tripWarehouseId =
      trip.warehouseId ||
      trip.driverId?.warehouseId?._id ||
      trip.driverId?.warehouseId;
    const driverWarehouseId = driver.warehouseId?._id || driver.warehouseId;
    if (
      tripWarehouseId &&
      tripWarehouseId.toString() !== driverWarehouseId?.toString()
    ) {
      throw new ApiError(400, TRIP_MESSAGES.DRIVER_WAREHOUSE_MISMATCH);
    }

    const routeId = trip.routeId?._id || trip.routeId;
    const route = await routeService.getById(routeId);
    validateRouteOriginWarehouse(route, driverWarehouseId);

    if (driver.status !== "active") {
      throw new ApiError(400, TRIP_MESSAGES.NEW_DRIVER_NOT_ACTIVE);
    }
    driverService.ensureLicenseIsValid(driver.licenseExpiryDate);

    assignmentPayload.oldDriverId = trip.driverId?._id;
    assignmentPayload.newDriverId = newDriverId;
    tripUpdatePayload.driverId = newDriverId;
  }

  if (newVehicleId) {
    const vehicle = await vehicleService.getById(newVehicleId, user);
    const tripWarehouseId =
      trip.warehouseId ||
      trip.driverId?.warehouseId?._id ||
      trip.driverId?.warehouseId;
    const vehicleWarehouseId = vehicle.warehouseId?._id || vehicle.warehouseId;
    if (
      vehicleWarehouseId &&
      tripWarehouseId &&
      vehicleWarehouseId.toString() !== tripWarehouseId.toString()
    ) {
      throw new ApiError(400, TRIP_MESSAGES.VEHICLE_WAREHOUSE_MISMATCH);
    }

    if (vehicle.status === "maintenance" || vehicle.status === "retired") {
      throw new ApiError(
        400,
        TRIP_MESSAGES.NEW_VEHICLE_NOT_AVAILABLE(vehicle.status),
      );
    }

    assignmentPayload.oldVehicleId = trip.vehicleId?._id;
    assignmentPayload.newVehicleId = newVehicleId;
    tripUpdatePayload.vehicleId = newVehicleId;
  }

  const vehicleId = newVehicleId || trip.vehicleId?._id || trip.vehicleId;
  const driverId = newDriverId || trip.driverId?._id || trip.driverId;
  const session = await mongoose.startSession();

  try {
    return await session.withTransaction(async () => {
      const currentTrip = validateTrip(
        await tripRepository.findById(tripId, session),
      );
      const changedDuringReassignment =
        !sameReference(currentTrip.vehicleId, trip.vehicleId) ||
        !sameReference(currentTrip.driverId, trip.driverId) ||
        !sameReference(currentTrip.warehouseId, trip.warehouseId) ||
        currentTrip.plannedStart.getTime() !== trip.plannedStart.getTime() ||
        currentTrip.plannedEnd.getTime() !== trip.plannedEnd.getTime() ||
        currentTrip.status !== trip.status;
      if (changedDuringReassignment) {
        throw new ApiError(409, TRIP_MESSAGES.TRIP_CHANGED_RETRY);
      }

      await lockTripScheduleResources({ vehicleId, driverId }, session);
      await checkTripOverlap({
        vehicleId,
        driverId,
        plannedStart: currentTrip.plannedStart,
        plannedEnd: currentTrip.plannedEnd,
        excludeTripId: tripId,
        session,
      });

      if (newVehicleId) {
        const tripWarehouseId =
          trip.warehouseId ||
          trip.driverId?.warehouseId?._id ||
          trip.driverId?.warehouseId;
        await vehicleService.assignToWarehouse(
          newVehicleId,
          tripWarehouseId,
          session,
        );
      }

      const assignmentLog = await tripRepository.createAssignment(
        assignmentPayload,
        session,
      );

      const updatedTrip = await tripRepository.updateById(
        tripId,
        tripUpdatePayload,
        session,
      );
      const changes = getAuditChanges(currentTrip, updatedTrip, [
        "vehicleId",
        "driverId",
      ]);
      if (changes.length > 0) {
        await tripRepository.createAuditLog(
          {
            tripId,
            action: "reassigned",
            performedBy: getActorId(user),
            changes,
          },
          session,
        );
      }

      return {
        trip: updatedTrip,
        assignment: assignmentLog,
      };
    });
  } finally {
    session.endSession();
  }
};

const getAssignmentsByTripId = async (
  tripId,
  { page = 1, limit = 20 } = {},
  user = null,
) => {
  await getById(tripId, false, user);

  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const limitNumber = Math.max(1, parseInt(limit, 10) || 20);
  const skip = (pageNumber - 1) * limitNumber;

  const [assignments, total] = await Promise.all([
    tripRepository.findAssignmentsByTripId(tripId, {
      skip,
      limit: limitNumber,
    }),
    tripRepository.countAssignmentsByTripId(tripId),
  ]);

  return {
    data: assignments,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages: Math.ceil(total / limitNumber),
    },
  };
};

// ==========================================
// TRIP TRACKING LOG SERVICES
// ==========================================

const handleTripDeparture = async ({
  trip,
  targetVehicleId,
  targetDriverId,
  odometerReading,
  session,
}) => {
  const actualStart = trip.actualStart || new Date();
  const existingUsageLogs = await vehicleService.getUsageLogsByTripId({
    tripId: trip._id,
  });

  if (existingUsageLogs.length === 0) {
    const vehicle = await vehicleService.getById(targetVehicleId);
    const startOdo = odometerReading ?? (vehicle.currentOdometer || 0);

    await vehicleService.createUsageLog({
      vehicleId: targetVehicleId,
      driverId: targetDriverId,
      tripId: trip._id,
      startOdo,
      startTime: actualStart,
      notes: "Auto-created upon trip departure",
      session,
    });
  }

  return { status: "in_progress", actualStart };
};

const handleTripCompletion = async ({
  trip,
  targetVehicleId,
  odometerReading,
  session,
}) => {
  const actualEnd = new Date();
  const existingUsageLogs = await vehicleService.getUsageLogsByTripId({
    tripId: trip._id,
  });

  const activeLog = existingUsageLogs.find(
    (log) => log.endOdo === null || log.endOdo === undefined,
  );

  if (activeLog) {
    const vehicle = await vehicleService.getById(targetVehicleId);
    const endOdo =
      odometerReading ??
      Math.max(
        activeLog.startOdo,
        vehicle.currentOdometer || 0,
        activeLog.startOdo + (trip.totalDistance || 0),
      );

    await vehicleService.updateUsageLogById(
      activeLog._id,
      {
        endOdo,
        endTime: actualEnd,
        notes: activeLog.notes
          ? `${activeLog.notes} | Auto-completed with trip`
          : "Auto-completed with trip",
      },
      session,
    );

    await vehicleService.changeStatus(targetVehicleId, "available", session);
  }

  return { status: "completed", actualEnd };
};

const handleTripCancellation = async ({ tripId, targetVehicleId, session }) => {
  const existingUsageLogs = await vehicleService.getUsageLogsByTripId({
    tripId,
  });

  const activeLog = existingUsageLogs.find(
    (log) => log.endOdo === null || log.endOdo === undefined,
  );

  if (activeLog) {
    const vehicle = await vehicleService.getById(targetVehicleId);
    const endOdo = Math.max(activeLog.startOdo, vehicle.currentOdometer || 0);

    await vehicleService.updateUsageLogById(
      activeLog._id,
      {
        endOdo,
        endTime: new Date(),
        notes: activeLog.notes
          ? `${activeLog.notes} | Cancelled with trip`
          : "Cancelled with trip",
      },
      session,
    );

    await vehicleService.changeStatus(targetVehicleId, "available", session);
  }

  return { status: "cancelled" };
};

const addTrackingLog = async (
  tripId,
  {
    status,
    latitude,
    longitude,
    address,
    speed,
    notes,
    reportedBy,
    odometerReading,
  },
  user = null,
) => {
  const trip = await getById(tripId, true, user);

  if (trip.status === "completed" || trip.status === "cancelled") {
    throw new ApiError(400, TRIP_MESSAGES.CANNOT_LOG_STATUS(trip.status));
  }

  if (user && user.role === ROLES.DRIVER) {
    const driver = await driverService.getById(trip.driverId?._id);
    if (driver.userId?.toString() !== user._id?.toString()) {
      throw new ApiError(403, TRIP_MESSAGES.NOT_ASSIGNED_DRIVER);
    }
  }

  if (status === "departed" || status === "in_progress") {
    const driver = await driverService.getById(
      trip.driverId?._id || trip.driverId,
    );
    if (driver.status !== "active") {
      throw new ApiError(400, TRIP_MESSAGES.DRIVER_NOT_ACTIVE);
    }
    driverService.ensureLicenseIsValid(driver.licenseExpiryDate);
  }

  if (reportedBy) {
    await userService.getById(reportedBy);
  }

  let tripStatusUpdates = {};

  const targetVehicleId = trip.vehicleId?._id;
  const targetDriverId = trip.driverId?._id;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const trackingLog = await tripRepository.createTrackingLog(
      {
        tripId,
        status,
        latitude,
        longitude,
        address,
        speed,
        notes,
        reportedBy,
      },
      session,
    );

    if (
      status === "departed" ||
      status === "in_progress" ||
      status === "arrived_destination" ||
      status === "incident"
    ) {
      if (trip.status === "planned") {
        tripStatusUpdates = await handleTripDeparture({
          trip,
          targetVehicleId,
          targetDriverId,
          odometerReading,
          session,
        });
      }
    } else if (status === "completed") {
      if (trip.status === "planned") {
        throw new ApiError(400, TRIP_MESSAGES.CANNOT_COMPLETE_STATUS);
      }

      tripStatusUpdates = await handleTripCompletion({
        trip,
        targetVehicleId,
        odometerReading,
        session,
      });
    } else if (status === "cancelled") {
      tripStatusUpdates = await handleTripCancellation({
        tripId,
        targetVehicleId,
        session,
      });
    }

    if (Object.keys(tripStatusUpdates).length > 0) {
      await tripRepository.updateById(tripId, tripStatusUpdates, session);
      const changes = getAuditChanges(
        trip,
        tripStatusUpdates,
        Object.keys(tripStatusUpdates),
      );
      await tripRepository.createAuditLog(
        {
          tripId,
          action: "status_changed",
          performedBy: getActorId(user),
          changes,
        },
        session,
      );
    }

    await session.commitTransaction();
    return trackingLog;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const getTrackingLogsByTripId = async (
  tripId,
  { page = 1, limit = 50, sort = { createdAt: -1 }, user = null } = {},
) => {
  await getById(tripId, false, user);

  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const limitNumber = Math.max(1, parseInt(limit, 10) || 50);
  const skip = (pageNumber - 1) * limitNumber;

  const [logs, total] = await Promise.all([
    tripRepository.findTrackingLogsByTripId(tripId, {
      skip,
      limit: limitNumber,
      sort,
    }),
    tripRepository.countTrackingLogsByTripId(tripId),
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

const getLatestTrackingLog = async (tripId, user = null) => {
  await getById(tripId, false, user);

  const log = await tripRepository.getLatestTrackingLogByTripId(tripId);

  if (!log) {
    throw new ApiError(404, TRIP_MESSAGES.LOG_NOT_FOUND);
  }

  return log;
};

const getAuditLogsByTripId = async (
  tripId,
  { page = 1, limit = 20, user = null } = {},
) => {
  await getById(tripId, false, user);

  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const limitNumber = Math.max(1, parseInt(limit, 10) || 20);
  const skip = (pageNumber - 1) * limitNumber;

  const [logs, total] = await Promise.all([
    tripRepository.findAuditLogsByTripId(tripId, {
      skip,
      limit: limitNumber,
    }),
    tripRepository.countAuditLogsByTripId(tripId),
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

// ==========================================
// TRIP EXPENSE SERVICES
// ==========================================

const addExpense = async (
  tripId,
  { expenseType, expenseAmount, expenseDate, note, receiptUrl, createdBy },
  user = null,
) => {
  const trip = await getById(tripId, true, user);

  if (user && user.role === ROLES.DRIVER) {
    const driver = await driverService.getById(trip.driverId?._id);

    if (driver.userId?.toString() !== user._id?.toString()) {
      throw new ApiError(403, TRIP_MESSAGES.NOT_ASSIGNED_DRIVER);
    }
  }

  if (createdBy) {
    await userService.getById(createdBy);
  }

  if (expenseAmount <= 0) {
    throw new ApiError(400, TRIP_MESSAGES.EXPENSE_AMOUNT_POSITIVE);
  }

  return tripRepository.createExpense({
    tripId,
    expenseType,
    expenseAmount,
    expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
    note,
    receiptUrl,
    createdBy,
  });
};

const getExpensesByTripId = async (
  tripId,
  { page = 1, limit = 20, user = null } = {},
) => {
  await getById(tripId, false, user);

  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const limitNumber = Math.max(1, parseInt(limit, 10) || 20);
  const skip = (pageNumber - 1) * limitNumber;

  const [expenses, total, totalAmount] = await Promise.all([
    tripRepository.findExpensesByTripId(tripId, {
      skip,
      limit: limitNumber,
    }),
    tripRepository.countExpensesByTripId(tripId),
    tripRepository.calculateTotalExpensesByTripId(tripId),
  ]);

  return {
    data: expenses,
    totalExpenseAmount: totalAmount,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages: Math.ceil(total / limitNumber),
    },
  };
};

const getTotalExpensesByTripId = async (tripId, user = null) => {
  await getById(tripId, false, user);

  const totalAmount =
    await tripRepository.calculateTotalExpensesByTripId(tripId);

  return { tripId, totalAmount };
};

const updateExpenseById = async (expenseId, updateData, user = null) => {
  if (user?.role === ROLES.DRIVER) {
    throw new ApiError(403, COMMON_MESSAGES.FORBIDDEN);
  }

  const existingExpense = await tripRepository.findExpenseById(expenseId);

  if (!existingExpense) {
    throw new ApiError(404, TRIP_MESSAGES.EXPENSE_NOT_FOUND);
  }

  await getById(existingExpense.tripId, false, user);

  if (updateData.expenseAmount !== undefined && updateData.expenseAmount <= 0) {
    throw new ApiError(400, TRIP_MESSAGES.EXPENSE_AMOUNT_POSITIVE);
  }

  return tripRepository.updateExpenseById(expenseId, updateData);
};

const deleteExpenseById = async (expenseId, user = null) => {
  const existingExpense = await tripRepository.findExpenseById(expenseId);

  if (!existingExpense) {
    throw new ApiError(404, TRIP_MESSAGES.EXPENSE_NOT_FOUND);
  }

  await getById(existingExpense.tripId, false, user);

  if (user && user.role === ROLES.DRIVER) {
    const creatorId = existingExpense.createdBy?._id?.toString();
    if (creatorId !== user._id?.toString()) {
      throw new ApiError(403, TRIP_MESSAGES.EXPENSE_DELETE_OWN_ONLY);
    }
  }

  return tripRepository.deleteExpenseById(expenseId);
};

export default {
  create,
  getAll,
  getById,
  getByCode,
  countAll,
  countActiveByDriverId,
  getIdsByWarehouseId,
  syncTotalOrder,
  updateById,
  deleteById,
  restoreById,
  getStatsByStatus,
  getTopDriverPerformance,

  // Assignment methods
  reassign,
  getAssignmentsByTripId,

  // Tracking Log methods
  addTrackingLog,
  getTrackingLogsByTripId,
  getLatestTrackingLog,
  getAuditLogsByTripId,

  // Expense methods
  addExpense,
  getExpensesByTripId,
  getTotalExpensesByTripId,
  updateExpenseById,
  deleteExpenseById,
};
