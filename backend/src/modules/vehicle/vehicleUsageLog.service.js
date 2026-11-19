import mongoose from "mongoose";

import { ROLES } from "../../constants/roles.js";
import { VEHICLE_MESSAGES } from "../../constants/messages.js";
import { VEHICLE_STATUSES } from "../../constants/vehicleStatuses.js";

import { ApiError } from "../../utils/ApiError.js";
import { checkWarehouseAccess } from "../../utils/checkWarehouseAccess.js";

import driverService from "../driver/driver.service.js";
import tripService from "../trip/trip.service.js";
import vehicleService from "./vehicle.service.js";

import vehicleRepository from "./vehicle.repository.js";
import vehicleUsageLogRepository from "./vehicleUsageLog.repository.js";

const scopeUsageLogFilter = async (filter, user) => {
  if (user?.role === ROLES.DRIVER) {
    const driver = await driverService.getByUserId(user._id);
    return { $and: [filter, { driverId: driver._id }] };
  }

  if (user?.role !== ROLES.DISPATCHER) return filter;

  const [vehicleIds, driverIds, tripIds] = await Promise.all([
    vehicleService.getIdsByWarehouseId(user.warehouseId),
    driverService.getIdsByWarehouseId(user.warehouseId),
    tripService.getIdsByWarehouseId(user.warehouseId),
  ]);

  return {
    $and: [
      filter,
      { vehicleId: { $in: vehicleIds } },
      { driverId: { $in: driverIds } },
      { tripId: { $in: tripIds } },
    ],
  };
};

const create = async (
  {
    vehicleId,
    driverId,
    tripId,
    startOdo,
    startTime = new Date(),
    notes = "",
    session: externalSession = null,
  },
  user = null,
) => {
  const start = new Date(startTime);

  const [vehicle, driver, trip] = await Promise.all([
    vehicleService.getById(vehicleId, user),
    driverService.getById(driverId),
    tripService.getById(tripId, false, user),
  ]);

  checkWarehouseAccess(driver.warehouseId, user);

  const tripVehicleId = trip.vehicleId?._id?.toString();
  const tripDriverId = trip.driverId?._id?.toString();

  if (tripVehicleId !== vehicleId.toString()) {
    throw new ApiError(400, VEHICLE_MESSAGES.VEHICLE_NOT_MATCH_TRIP);
  }

  if (tripDriverId !== driverId.toString()) {
    throw new ApiError(400, VEHICLE_MESSAGES.DRIVER_NOT_MATCH_TRIP);
  }

  if (vehicle.status === VEHICLE_STATUSES.IN_USE) {
    throw new ApiError(400, VEHICLE_MESSAGES.VEHICLE_IN_USE);
  }

  if (
    vehicle.status === VEHICLE_STATUSES.MAINTENANCE ||
    vehicle.status === VEHICLE_STATUSES.RETIRED
  ) {
    throw new ApiError(
      400,
      VEHICLE_MESSAGES.VEHICLE_STATUS_INVALID(vehicle.status),
    );
  }

  if (startOdo < (vehicle.currentOdometer || 0)) {
    throw new ApiError(
      400,
      VEHICLE_MESSAGES.START_ODO_LESS_THAN_CURRENT(
        startOdo,
        vehicle.currentOdometer,
      ),
    );
  }

  const ownsSession = !externalSession;
  const session = externalSession || (await mongoose.startSession());
  if (ownsSession) {
    session.startTransaction();
  }

  try {
    if (
      (await vehicleUsageLogRepository.countOpenByVehicleId(
        vehicleId,
        session,
      )) > 0
    ) {
      throw new ApiError(400, VEHICLE_MESSAGES.VEHICLE_IN_USE);
    }

    const newLog = await vehicleUsageLogRepository.create(
      {
        vehicleId,
        driverId,
        tripId,
        startOdo,
        startTime: start,
        notes,
      },
      session,
    );

    await vehicleRepository.updateById(
      vehicleId,
      { status: VEHICLE_STATUSES.IN_USE },
      session,
    );

    if (ownsSession) {
      await session.commitTransaction();
    }

    return newLog;
  } catch (error) {
    if (ownsSession) {
      await session.abortTransaction();
    }
    throw error;
  } finally {
    if (ownsSession) {
      session.endSession();
    }
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

  const queryFilter = await scopeUsageLogFilter(
    { deletedAt: null, ...filter },
    user,
  );

  const [logs, total] = await Promise.all([
    vehicleUsageLogRepository.find({
      filter: queryFilter,
      skip,
      limit: limitNumber,
      sort,
    }),
    vehicleUsageLogRepository.count(queryFilter),
  ]);

  return {
    data: logs,
    pagination: {
      page,
      limit: limitNumber,
      total,
      totalPages: Math.ceil(total / limitNumber),
    },
  };
};

const getById = async (logId, user = null) => {
  const log = await vehicleUsageLogRepository.findById(logId);

  if (!log || log.deletedAt !== null) {
    throw new ApiError(404, VEHICLE_MESSAGES.LOG_NOT_FOUND);
  }

  if (user?.role === ROLES.DISPATCHER) {
    await tripService.getById(log.tripId?._id || log.tripId, false, user);
    await vehicleService.getById(log.vehicleId?._id || log.vehicleId, user);
    const driverId = log.driverId?._id || log.driverId;
    const driver = await driverService.getById(driverId);
    checkWarehouseAccess(driver.warehouseId, user);
  }

  if (user?.role === ROLES.DRIVER) {
    const driver = await driverService.getByUserId(user._id);
    const logDriverId = log.driverId?._id || log.driverId;
    if (logDriverId?.toString() !== driver._id.toString()) {
      throw new ApiError(403, VEHICLE_MESSAGES.LOG_ACCESS_DENIED);
    }
  }

  return log;
};

const getByVehicleId = async ({
  vehicleId,
  filter = {},
  page = 1,
  limit = 20,
  sort = { createdAt: -1 },
  user = null,
} = {}) => {
  await vehicleService.getById(vehicleId, user);

  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const limitNumber = Math.max(1, parseInt(limit, 10) || 20);
  const skip = (pageNumber - 1) * limitNumber;

  const queryFilter = await scopeUsageLogFilter(
    { deletedAt: null, ...filter },
    user,
  );

  const [logs, total] = await Promise.all([
    vehicleUsageLogRepository.findByVehicleId(vehicleId, {
      filter: queryFilter,
      skip,
      limit: limitNumber,
      sort,
    }),
    vehicleUsageLogRepository.countByVehicleId(vehicleId, queryFilter),
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

const getByDriverId = async ({
  driverId,
  filter = {},
  page = 1,
  limit = 20,
  sort = { createdAt: -1 },
  user = null,
} = {}) => {
  let currentDriver = null;
  if (user?.role === ROLES.DRIVER) {
    currentDriver = await driverService.getByUserId(user._id);
    if (currentDriver._id.toString() !== driverId.toString()) {
      throw new ApiError(403, VEHICLE_MESSAGES.LOG_ACCESS_DENIED);
    }
  }

  const driver = currentDriver || (await driverService.getById(driverId));
  checkWarehouseAccess(driver.warehouseId, user);

  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const limitNumber = Math.max(1, parseInt(limit, 10) || 20);
  const skip = (pageNumber - 1) * limitNumber;

  const queryFilter = await scopeUsageLogFilter(
    { deletedAt: null, ...filter },
    user,
  );

  const [logs, total] = await Promise.all([
    vehicleUsageLogRepository.findByDriverId(driverId, {
      filter: queryFilter,
      skip,
      limit: limitNumber,
      sort,
    }),
    vehicleUsageLogRepository.countByDriverId(driverId, queryFilter),
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

const getByTripId = async ({ tripId, user = null }) => {
  await tripService.getById(tripId, false, user);

  const queryFilter = await scopeUsageLogFilter({ deletedAt: null }, user);
  return vehicleUsageLogRepository.findByTripId(tripId, queryFilter);
};

const getStatsByVehicleId = async ({
  vehicleId,
  startDate,
  endDate,
  user = null,
}) => {
  await vehicleService.getById(vehicleId, user);

  const matchFilter = {
    deletedAt: null,
  };

  if (startDate || endDate) {
    matchFilter.startTime = {};
    if (startDate) {
      matchFilter.startTime.$gte = new Date(startDate);
    }

    if (endDate) {
      matchFilter.startTime.$lte = new Date(endDate);
    }
  }

  if (user?.role === ROLES.DISPATCHER) {
    const [driverIds, tripIds] = await Promise.all([
      driverService.getIdsByWarehouseId(user.warehouseId),
      tripService.getIdsByWarehouseId(user.warehouseId),
    ]);
    matchFilter.driverId = { $in: driverIds };
    matchFilter.tripId = { $in: tripIds };
  }

  return vehicleUsageLogRepository.aggregateStats(vehicleId, matchFilter);
};

const updateById = async (
  logId,
  updateData,
  externalSession = null,
  user = null,
) => {
  const existingLog = await getById(logId, user);

  const startOdo =
    updateData.startOdo !== undefined
      ? updateData.startOdo
      : existingLog.startOdo;
  const endOdo =
    updateData.endOdo !== undefined ? updateData.endOdo : existingLog.endOdo;

  if (
    endOdo !== undefined &&
    endOdo !== null &&
    startOdo !== undefined &&
    startOdo !== null &&
    endOdo < startOdo
  ) {
    throw new ApiError(
      400,
      VEHICLE_MESSAGES.END_ODO_LESS_THAN_START(endOdo, startOdo),
    );
  }

  const startTime = updateData.startTime
    ? new Date(updateData.startTime)
    : existingLog.startTime
      ? new Date(existingLog.startTime)
      : null;
  const endTime = updateData.endTime
    ? new Date(updateData.endTime)
    : existingLog.endTime
      ? new Date(existingLog.endTime)
      : null;

  if (startTime && endTime && startTime > endTime) {
    throw new ApiError(400, VEHICLE_MESSAGES.START_TIME_MUST_BEFORE_END);
  }

  const targetVehicleId =
    updateData.vehicleId || existingLog.vehicleId?._id || existingLog.vehicleId;
  const targetDriverId =
    updateData.driverId || existingLog.driverId?._id || existingLog.driverId;
  const targetTripId =
    updateData.tripId || existingLog.tripId?._id || existingLog.tripId;

  await vehicleService.getById(targetVehicleId, user);
  const [driver, trip] = await Promise.all([
    driverService.getById(targetDriverId),
    tripService.getById(targetTripId, false, user),
  ]);
  checkWarehouseAccess(driver.warehouseId, user);

  const tripVehicleId = trip.vehicleId?._id || trip.vehicleId;
  const tripDriverId = trip.driverId?._id || trip.driverId;
  if (tripVehicleId?.toString() !== targetVehicleId.toString()) {
    throw new ApiError(400, VEHICLE_MESSAGES.VEHICLE_NOT_MATCH_TRIP);
  }
  if (tripDriverId?.toString() !== targetDriverId.toString()) {
    throw new ApiError(400, VEHICLE_MESSAGES.DRIVER_NOT_MATCH_TRIP);
  }

  const ownsSession = !externalSession;
  const session = externalSession || (await mongoose.startSession());
  if (ownsSession) {
    session.startTransaction();
  }

  try {
    const updatedLog = await vehicleUsageLogRepository.updateById(
      logId,
      updateData,
      session,
    );

    if (updateData.endOdo !== undefined && updateData.endOdo !== null) {
      await vehicleRepository.updateById(
        targetVehicleId,
        { $max: { currentOdometer: updateData.endOdo } },
        session,
      );
    }

    if (ownsSession) {
      await session.commitTransaction();
    }

    return updatedLog;
  } catch (error) {
    if (ownsSession) {
      await session.abortTransaction();
    }
    throw error;
  } finally {
    if (ownsSession) {
      session.endSession();
    }
  }
};

const checkOut = async ({
  logId,
  endOdo,
  endTime = new Date(),
  fuelConsumed = 0,
  notes,
  user = null,
}) => {
  const existingLog = await getById(logId, user);

  if (existingLog.endOdo !== undefined && existingLog.endOdo !== null) {
    throw new ApiError(400, VEHICLE_MESSAGES.LOG_ALREADY_CHECKED_OUT);
  }

  const end = new Date(endTime);
  const start = new Date(existingLog.startTime);

  if (start > end) {
    throw new ApiError(400, VEHICLE_MESSAGES.END_TIME_MUST_AFTER_START);
  }

  if (endOdo < existingLog.startOdo) {
    throw new ApiError(
      400,
      VEHICLE_MESSAGES.END_ODO_LESS_THAN_START(endOdo, existingLog.startOdo),
    );
  }

  const targetVehicleId = existingLog.vehicleId?._id;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const updatePayload = {
      endOdo,
      endTime: end,
      fuelConsumed,
    };

    if (notes !== undefined) {
      updatePayload.notes = notes;
    }

    const updatedLog = await vehicleUsageLogRepository.updateById(
      logId,
      updatePayload,
      session,
    );

    await vehicleRepository.updateById(
      targetVehicleId,
      { $max: { currentOdometer: endOdo } },
      session,
    );

    const currentVehicle = await vehicleService.getById(targetVehicleId);
    if (
      currentVehicle.status !== VEHICLE_STATUSES.MAINTENANCE &&
      currentVehicle.status !== VEHICLE_STATUSES.RETIRED
    ) {
      await vehicleRepository.updateById(
        targetVehicleId,
        { status: VEHICLE_STATUSES.AVAILABLE },
        session,
      );
    }

    await session.commitTransaction();

    return updatedLog;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const deleteById = async (logId, user = null) => {
  // getById throws 404 when the log does not exist or is already soft-deleted
  await getById(logId, user);

  return vehicleUsageLogRepository.deleteById(logId);
};

const restoreById = async (logId, user = null) => {
  const log = await vehicleUsageLogRepository.findById(logId);

  if (!log) {
    throw new ApiError(404, VEHICLE_MESSAGES.LOG_NOT_FOUND);
  }

  if (user?.role === ROLES.DISPATCHER) {
    await tripService.getById(log.tripId?._id || log.tripId, false, user);
  }

  if (!log.deletedAt) {
    throw new ApiError(400, VEHICLE_MESSAGES.LOG_NOT_DELETED);
  }

  return vehicleUsageLogRepository.restoreById(logId);
};

export default {
  create,
  getAll,
  getById,
  getByVehicleId,
  getByDriverId,
  getByTripId,
  getStatsByVehicleId,
  updateById,
  checkOut,
  deleteById,
  restoreById,
};
