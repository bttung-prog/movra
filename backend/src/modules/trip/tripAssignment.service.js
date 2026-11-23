import mongoose from "mongoose";

import { TRIP_STATUSES } from "../../constants/tripStatuses.js";
import { VEHICLE_STATUSES } from "../../constants/vehicleStatuses.js";
import { USER_STATUSES } from "../../constants/userStatuses.js";
import { TRIP_MESSAGES } from "../../constants/messages.js";

import { ApiError } from "../../utils/ApiError.js";
import { checkWarehouseAccess } from "../../utils/checkWarehouseAccess.js";
import { getActorUserId } from "../../utils/actor.util.js";

import driverService from "../driver/driver.service.js";
import vehicleService from "../vehicle/vehicle.service.js";
import userService from "../user/user.service.js";
import routeService from "../route/route.service.js";

import tripRepository from "./trip.repository.js";
import tripAssignmentRepository from "./tripAssignment.repository.js";
import tripAuditLogRepository from "./tripAuditLog.repository.js";
import tripAccess from "./trip.access.js";
import tripAudit from "./trip.audit.js";

const ensureTripAccess = async (
  tripId,
  requireNotDeleted = true,
  user = null,
  session = null,
) => {
  const trip = await tripRepository.findById(tripId, session);
  if (!trip) {
    throw new ApiError(404, TRIP_MESSAGES.NOT_FOUND);
  }
  if (requireNotDeleted && trip.deletedAt !== null) {
    throw new ApiError(400, TRIP_MESSAGES.ALREADY_DELETED);
  }
  await tripAccess.assertTripWarehouseAccess(trip, user);
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

const reassign = async (
  tripId,
  { newDriverId, newVehicleId, reason, changedBy },
  user = null,
) => {
  const trip = await ensureTripAccess(tripId, true, user);

  if (
    trip.status === TRIP_STATUSES.COMPLETED ||
    trip.status === TRIP_STATUSES.CANCELLED
  ) {
    throw new ApiError(400, TRIP_MESSAGES.CANNOT_REASSIGN_STATUS(trip.status));
  }

  if (
    trip.status === TRIP_STATUSES.IN_PROGRESS &&
    (newVehicleId || newDriverId)
  ) {
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
    if (routeId) {
      const route = await routeService.getById(routeId);
      tripAccess.validateRouteOriginWarehouse(route, driverWarehouseId);
    }

    if (driver.status !== USER_STATUSES.ACTIVE) {
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

    if (
      vehicle.status === VEHICLE_STATUSES.MAINTENANCE ||
      vehicle.status === VEHICLE_STATUSES.RETIRED
    ) {
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
      const currentTrip = await ensureTripAccess(tripId, true, user, session);
      const changedDuringReassignment =
        !tripAudit.sameReference(currentTrip.vehicleId, trip.vehicleId) ||
        !tripAudit.sameReference(currentTrip.driverId, trip.driverId) ||
        !tripAudit.sameReference(currentTrip.warehouseId, trip.warehouseId) ||
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

      const assignmentLog = await tripAssignmentRepository.create(
        assignmentPayload,
        session,
      );

      const updatedTrip = await tripRepository.updateById(
        tripId,
        tripUpdatePayload,
        session,
      );
      const changes = tripAudit.getAuditChanges(currentTrip, updatedTrip, [
        "vehicleId",
        "driverId",
      ]);
      if (changes.length > 0) {
        await tripAuditLogRepository.create(
          {
            tripId,
            action: "reassigned",
            performedBy: getActorUserId(user),
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
  await ensureTripAccess(tripId, false, user);

  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const limitNumber = Math.max(1, parseInt(limit, 10) || 20);
  const skip = (pageNumber - 1) * limitNumber;

  const [assignments, total] = await Promise.all([
    tripAssignmentRepository.findByTripId(tripId, {
      skip,
      limit: limitNumber,
    }),
    tripAssignmentRepository.countByTripId(tripId),
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

export default {
  reassign,
  getAssignmentsByTripId,
};
