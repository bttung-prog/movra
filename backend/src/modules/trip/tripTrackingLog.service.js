import mongoose from "mongoose";

import { ROLES } from "../../constants/roles.js";
import {
  TRIP_STATUSES,
  TRACKING_STATUSES,
  TRIP_TRACKING_TRANSITIONS,
} from "../../constants/tripStatuses.js";
import { VEHICLE_STATUSES } from "../../constants/vehicleStatuses.js";
import { USER_STATUSES } from "../../constants/userStatuses.js";
import { TRIP_MESSAGES } from "../../constants/messages.js";

import { ApiError } from "../../utils/ApiError.js";
import {
  getActorUserId,
  getActorUserIdString,
  getReferenceIdString,
} from "../../utils/actor.util.js";

import driverService from "../driver/driver.service.js";
import vehicleService from "../vehicle/vehicle.service.js";
import vehicleUsageLogService from "../vehicle/vehicleUsageLog.service.js";
import userService from "../user/user.service.js";
import orderAssignmentService from "../order/orderAssignment.service.js";

import tripRepository from "./trip.repository.js";
import tripTrackingLogRepository from "./tripTrackingLog.repository.js";
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

const handleTripDeparture = async ({
  trip,
  targetVehicleId,
  targetDriverId,
  odometerReading,
  session,
}) => {
  const actualStart = trip.actualStart || new Date();
  const existingUsageLogs = await vehicleUsageLogService.getByTripId({
    tripId: trip._id,
  });

  if (existingUsageLogs.length === 0) {
    const vehicle = await vehicleService.getById(targetVehicleId);
    const startOdo = odometerReading ?? (vehicle.currentOdometer || 0);

    await vehicleUsageLogService.create({
      vehicleId: targetVehicleId,
      driverId: targetDriverId,
      tripId: trip._id,
      startOdo,
      startTime: actualStart,
      notes: "Tự động tạo khi chuyến xe khởi hành",
      session,
    });
  }

  return { status: TRIP_STATUSES.IN_PROGRESS, actualStart };
};

const handleTripCompletion = async ({
  trip,
  targetVehicleId,
  odometerReading,
  session,
  user = null,
}) => {
  const unfinishedOrdersCount =
    await orderAssignmentService.countUnfinishedOrdersByTrip(trip, session);

  if (unfinishedOrdersCount > 0) {
    throw new ApiError(
      400,
      TRIP_MESSAGES.CANNOT_COMPLETE_ACTIVE_ORDERS(unfinishedOrdersCount),
    );
  }

  await orderAssignmentService.handleOrdersOnTripCompletion(
    trip,
    session,
    user,
  );

  const actualEnd = new Date();
  const existingUsageLogs = await vehicleUsageLogService.getByTripId({
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

    await vehicleUsageLogService.updateById(
      activeLog._id,
      {
        endOdo,
        endTime: actualEnd,
        notes: activeLog.notes
          ? `${activeLog.notes} | Tự động hoàn thành theo chuyến xe`
          : "Tự động hoàn thành theo chuyến xe",
      },
      session,
    );

    await vehicleService.changeStatus(
      targetVehicleId,
      VEHICLE_STATUSES.AVAILABLE,
      session,
    );
  }

  return { status: TRIP_STATUSES.COMPLETED, actualEnd };
};

const handleTripCancellation = async ({
  trip,
  tripId,
  targetVehicleId,
  session,
  user = null,
}) => {
  const resolvedTripId = tripId || trip?._id;
  const resolvedTrip =
    trip || (await tripRepository.findById(resolvedTripId, session));

  if (resolvedTrip) {
    await orderAssignmentService.handleOrdersOnTripCancellation(
      resolvedTrip,
      session,
      user,
    );
  }

  const existingUsageLogs = await vehicleUsageLogService.getByTripId({
    tripId: resolvedTripId,
  });

  const activeLog = existingUsageLogs.find(
    (log) => log.endOdo === null || log.endOdo === undefined,
  );

  if (activeLog) {
    const vehicle = await vehicleService.getById(targetVehicleId);
    const endOdo = Math.max(activeLog.startOdo, vehicle.currentOdometer || 0);

    await vehicleUsageLogService.updateById(
      activeLog._id,
      {
        endOdo,
        endTime: new Date(),
        notes: activeLog.notes
          ? `${activeLog.notes} | Tự động hủy theo chuyến xe`
          : "Tự động hủy theo chuyến xe",
      },
      session,
    );

    await vehicleService.changeStatus(
      targetVehicleId,
      VEHICLE_STATUSES.AVAILABLE,
      session,
    );
  }

  return { status: TRIP_STATUSES.CANCELLED };
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
  const trip = await ensureTripAccess(tripId, true, user);

  if (
    trip.status === TRIP_STATUSES.COMPLETED ||
    trip.status === TRIP_STATUSES.CANCELLED
  ) {
    throw new ApiError(400, TRIP_MESSAGES.CANNOT_LOG_STATUS(trip.status));
  }

  if (status === TRACKING_STATUSES.PLANNED) {
    throw new ApiError(400, TRIP_MESSAGES.CANNOT_LOG_PLANNED_STATUS);
  }

  if (user && user.role === ROLES.DRIVER) {
    const driver = await driverService.getById(trip.driverId?._id);
    if (getReferenceIdString(driver.userId) !== getActorUserIdString(user)) {
      throw new ApiError(403, TRIP_MESSAGES.NOT_ASSIGNED_DRIVER);
    }
  }

  const latestTrackingLog =
    await tripTrackingLogRepository.getLatestByTripId(tripId);
  const currentTrackingStatus = latestTrackingLog?.status || trip.status;

  if (!TRIP_TRACKING_TRANSITIONS[currentTrackingStatus]?.includes(status)) {
    throw new ApiError(
      400,
      TRIP_MESSAGES.INVALID_TRACKING_STATUS_TRANSITION(
        currentTrackingStatus,
        status,
      ),
    );
  }

  if (
    status === TRACKING_STATUSES.DEPARTED ||
    status === TRACKING_STATUSES.IN_PROGRESS
  ) {
    const driver = await driverService.getById(
      trip.driverId?._id || trip.driverId,
    );
    if (driver.status !== USER_STATUSES.ACTIVE) {
      throw new ApiError(400, TRIP_MESSAGES.DRIVER_NOT_ACTIVE);
    }
    driverService.ensureLicenseIsValid(driver.licenseExpiryDate);
  }

  if (reportedBy) {
    await userService.getById(reportedBy);
  }

  let tripStatusUpdates = {};

  const targetVehicleId = trip.vehicleId?._id || trip.vehicleId;
  const targetDriverId = trip.driverId?._id || trip.driverId;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const trackingLog = await tripTrackingLogRepository.create(
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

    if (status === TRACKING_STATUSES.DEPARTED) {
      if (trip.status === TRIP_STATUSES.PLANNED) {
        tripStatusUpdates = await handleTripDeparture({
          trip,
          targetVehicleId,
          targetDriverId,
          odometerReading,
          session,
        });
      }
    } else if (status === TRACKING_STATUSES.COMPLETED) {
      tripStatusUpdates = await handleTripCompletion({
        trip,
        targetVehicleId,
        odometerReading,
        session,
        user,
      });
    } else if (status === TRACKING_STATUSES.CANCELLED) {
      tripStatusUpdates = await handleTripCancellation({
        trip,
        tripId,
        targetVehicleId,
        session,
        user,
      });
    }

    if (Object.keys(tripStatusUpdates).length > 0) {
      await tripRepository.updateById(tripId, tripStatusUpdates, session);
      const changes = tripAudit.getAuditChanges(
        trip,
        tripStatusUpdates,
        Object.keys(tripStatusUpdates),
      );
      await tripAuditLogRepository.create(
        {
          tripId,
          action: "status_changed",
          performedBy: getActorUserId(user),
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
  await ensureTripAccess(tripId, false, user);

  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const limitNumber = Math.max(1, parseInt(limit, 10) || 50);
  const skip = (pageNumber - 1) * limitNumber;

  const [logs, total] = await Promise.all([
    tripTrackingLogRepository.findByTripId(tripId, {
      skip,
      limit: limitNumber,
      sort,
    }),
    tripTrackingLogRepository.countByTripId(tripId),
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
  await ensureTripAccess(tripId, false, user);

  const log = await tripTrackingLogRepository.getLatestByTripId(tripId);

  if (!log) {
    throw new ApiError(404, TRIP_MESSAGES.LOG_NOT_FOUND);
  }

  return log;
};

export default {
  addTrackingLog,
  getTrackingLogsByTripId,
  getLatestTrackingLog,
  handleTripDeparture,
  handleTripCompletion,
  handleTripCancellation,
};
