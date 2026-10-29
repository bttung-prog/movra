import mongoose from "mongoose";

import ROLES from "../../constants/roles.js";
import {
  VEHICLE_MESSAGES,
  WAREHOUSE_MESSAGES,
} from "../../constants/messages.js";

import ApiError from "../../utils/ApiError.js";
import checkWarehouseAccess from "../../utils/checkWarehouseAccess.js";

import driverService from "../driver/driver.service.js";
import tripService from "../trip/trip.service.js";
import warehouseService from "../warehouse/warehouse.service.js";

import vehicleRepository from "./vehicle.repository.js";

const assertVehicleWarehouseAccess = async (vehicle, user) => {
  if (user?.role !== ROLES.DISPATCHER) return;
  if (!user.warehouseId) {
    throw new ApiError(403, WAREHOUSE_MESSAGES.DISPATCHER_NOT_ASSIGNED);
  }

  if (vehicle.warehouseId) {
    checkWarehouseAccess(vehicle.warehouseId, user);
    return;
  }

  const assignedVehicleIds = await driverService.getVehicleIdsByWarehouseId(
    user.warehouseId,
  );
  if (
    !assignedVehicleIds.some(
      (vehicleId) => vehicleId.toString() === vehicle._id.toString(),
    )
  ) {
    throw new ApiError(403, WAREHOUSE_MESSAGES.ACCESS_DENIED);
  }
};

const getDriverForUser = async (user) => {
  const driver = await driverService.getByUserId(user._id);

  if (!driver) {
    throw new ApiError(403, VEHICLE_MESSAGES.DRIVER_PROFILE_NOT_FOUND);
  }

  return driver;
};

const scopeUsageLogFilter = async (filter, user) => {
  if (user?.role === ROLES.DRIVER) {
    const driver = await getDriverForUser(user);
    return { $and: [filter, { driverId: driver._id }] };
  }

  if (user?.role !== ROLES.DISPATCHER) return filter;

  const [vehicleIds, driverIds, tripIds] = await Promise.all([
    getIdsByWarehouseId(user.warehouseId),
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

const createType = async ({ name, description, maxWeight, maxVolume }) => {
  const existingVehicleType = await vehicleRepository.findTypeByName(name);

  if (existingVehicleType && existingVehicleType.deletedAt === null) {
    throw new ApiError(409, VEHICLE_MESSAGES.TYPE_EXISTS);
  }

  if (existingVehicleType && existingVehicleType.deletedAt !== null) {
    return vehicleRepository.updateType(existingVehicleType._id, {
      description,
      maxWeight,
      maxVolume,
      deletedAt: null,
    });
  }

  return vehicleRepository.createType({
    name,
    description,
    maxWeight,
    maxVolume,
  });
};

const getActiveTypes = async ({ page = 1, limit = 10 }) => {
  const skip = (page - 1) * limit;

  const [vehicleTypes, total] = await Promise.all([
    vehicleRepository.findActiveTypes({ skip, limit }),
    vehicleRepository.countActiveTypes(),
  ]);

  return {
    data: vehicleTypes,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getDeletedTypes = async ({ page = 1, limit = 10 }) => {
  const skip = (page - 1) * limit;

  const [vehicleTypes, total] = await Promise.all([
    vehicleRepository.findDeletedTypes({ skip, limit }),
    vehicleRepository.countDeletedTypes(),
  ]);

  return {
    data: vehicleTypes,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getTypeById = async (vehicleTypeId, requireNotDeleted = true) => {
  const vehicleType = await vehicleRepository.findTypeById(vehicleTypeId);

  if (!vehicleType) {
    throw new ApiError(404, VEHICLE_MESSAGES.TYPE_NOT_FOUND);
  }

  if (requireNotDeleted && vehicleType.deletedAt !== null) {
    throw new ApiError(400, VEHICLE_MESSAGES.TYPE_ALREADY_DELETED);
  }

  return vehicleType;
};

const getTypeByName = async (vehicleTypeName) => {
  return vehicleRepository.findTypeByName(vehicleTypeName);
};

const updateType = async (vehicleTypeId, updateData) => {
  const existingVehicleType = await getTypeById(vehicleTypeId);

  if (updateData.name && updateData.name !== existingVehicleType.name) {
    const existingVehicleTypeByName = await vehicleRepository.findTypeByName(
      updateData.name,
    );

    if (
      existingVehicleTypeByName &&
      existingVehicleTypeByName.deletedAt === null &&
      existingVehicleTypeByName._id.toString() !== vehicleTypeId.toString()
    ) {
      throw new ApiError(409, VEHICLE_MESSAGES.TYPE_NAME_EXISTS);
    }
  }

  return vehicleRepository.updateType(vehicleTypeId, updateData);
};

const deleteType = async (vehicleTypeId) => {
  await getTypeById(vehicleTypeId);

  const assignedVehiclesCount = await vehicleRepository.countAll({
    vehicleTypeId,
  });

  if (assignedVehiclesCount > 0) {
    throw new ApiError(
      400,
      VEHICLE_MESSAGES.TYPE_CANNOT_DELETE_ASSIGNED(assignedVehiclesCount),
    );
  }

  return vehicleRepository.deleteType(vehicleTypeId);
};

const restoreType = async (vehicleTypeId) => {
  const vehicleType = await getTypeById(vehicleTypeId, false);

  if (vehicleType.deletedAt === null) {
    throw new ApiError(400, VEHICLE_MESSAGES.TYPE_NOT_DELETED);
  }

  return vehicleRepository.restoreType(vehicleTypeId);
};

const create = async ({
  plateNumber,
  vehicleTypeId,
  brand,
  model,
  yearManufactured,
  capacityWeight,
  capacityVolume,
  registrationExpiryDate,
  insuranceExpiryDate,
  warehouseId = null,
}) => {
  const [existingVehicle, existingVehicleType] = await Promise.all([
    vehicleRepository.findByPlateNumber(plateNumber),
    getTypeById(vehicleTypeId),
  ]);

  if (existingVehicle) {
    throw new ApiError(409, VEHICLE_MESSAGES.PLATE_EXISTS);
  }

  if (warehouseId) {
    await warehouseService.getById(warehouseId, true, true);
  }

  return vehicleRepository.create({
    plateNumber,
    vehicleTypeId,
    brand,
    model,
    yearManufactured,
    capacityWeight,
    capacityVolume,
    registrationExpiryDate,
    insuranceExpiryDate,
    warehouseId,
  });
};

const getAll = async ({ filter = {}, page = 1, limit = 10, user = null }) => {
  const skip = (page - 1) * limit;
  let queryFilter = filter;

  if (user?.role === ROLES.DISPATCHER) {
    if (!user.warehouseId) {
      throw new ApiError(403, WAREHOUSE_MESSAGES.DISPATCHER_NOT_ASSIGNED);
    }

    const assignedVehicleIds = await driverService.getVehicleIdsByWarehouseId(
      user.warehouseId,
    );

    queryFilter = {
      ...filter,
      $and: [
        ...(filter.$and || []),
        {
          $or: [
            { warehouseId: user.warehouseId },
            {
              _id: { $in: assignedVehicleIds },
              warehouseId: null,
            },
          ],
        },
      ],
    };
  }

  const [vehicles, total] = await Promise.all([
    vehicleRepository.findAll({ filter: queryFilter, skip, limit }),
    vehicleRepository.countAll(queryFilter),
  ]);

  return {
    data: vehicles,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getIdsByWarehouseId = async (warehouseId) => {
  if (!warehouseId) {
    throw new ApiError(403, WAREHOUSE_MESSAGES.DISPATCHER_NOT_ASSIGNED);
  }

  const assignedVehicleIds =
    await driverService.getVehicleIdsByWarehouseId(warehouseId);

  return vehicleRepository.findIds({
    $or: [
      { warehouseId },
      { _id: { $in: assignedVehicleIds }, warehouseId: null },
    ],
  });
};

const assignToWarehouse = async (vehicleId, warehouseId, session = null) => {
  const [vehicle, currentDriver] = await Promise.all([
    vehicleRepository.findById(vehicleId),
    driverService.getByCurrentVehicleId(vehicleId),
  ]);
  if (!vehicle) {
    throw new ApiError(404, VEHICLE_MESSAGES.NOT_FOUND);
  }

  const currentWarehouseId = vehicle.warehouseId?._id || vehicle.warehouseId;
  if (
    currentWarehouseId &&
    currentWarehouseId.toString() !== warehouseId.toString()
  ) {
    throw new ApiError(400, WAREHOUSE_MESSAGES.ACCESS_DENIED);
  }

  const driverWarehouseId =
    currentDriver?.warehouseId?._id || currentDriver?.warehouseId;
  if (
    driverWarehouseId &&
    driverWarehouseId.toString() !== warehouseId.toString()
  ) {
    throw new ApiError(400, WAREHOUSE_MESSAGES.ACCESS_DENIED);
  }

  if (!currentWarehouseId) {
    const assignedVehicle = await vehicleRepository.setWarehouseIdIfUnassigned(
      vehicleId,
      warehouseId,
      session,
    );
    if (!assignedVehicle) {
      const latestVehicle = await vehicleRepository.findById(vehicleId);
      const latestWarehouseId =
        latestVehicle?.warehouseId?._id || latestVehicle?.warehouseId;
      if (latestWarehouseId?.toString() !== warehouseId.toString()) {
        throw new ApiError(409, WAREHOUSE_MESSAGES.ACCESS_DENIED);
      }
    }
  }
};

const getById = async (vehicleId, user = null) => {
  const existingVehicle = await vehicleRepository.findById(vehicleId);

  if (!existingVehicle) {
    throw new ApiError(404, VEHICLE_MESSAGES.NOT_FOUND);
  }

  await assertVehicleWarehouseAccess(existingVehicle, user);

  return existingVehicle;
};

const getByPlateNumber = async (plateNumber, user = null) => {
  const existingVehicle =
    await vehicleRepository.findByPlateNumber(plateNumber);

  if (!existingVehicle) {
    throw new ApiError(404, VEHICLE_MESSAGES.NOT_FOUND);
  }

  await assertVehicleWarehouseAccess(existingVehicle, user);

  return existingVehicle;
};

const getExpiredRegistration = async ({ page = 1, limit = 10 }) => {
  const skip = (page - 1) * limit;
  const now = new Date();

  const [vehicles, total] = await Promise.all([
    vehicleRepository.findExpiredRegistration({ date: now, skip, limit }),
    vehicleRepository.countExpiredRegistration({ date: now }),
  ]);

  return {
    data: vehicles,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getExpiredInsurance = async ({ page = 1, limit = 10 }) => {
  const skip = (page - 1) * limit;
  const now = new Date();

  const [vehicles, total] = await Promise.all([
    vehicleRepository.findExpiredInsurance({ date: now, skip, limit }),
    vehicleRepository.countExpiredInsurance({ date: now }),
  ]);

  return {
    data: vehicles,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const updateById = async (vehicleId, updateData) => {
  const existingVehicle = await getById(vehicleId);

  if (updateData.warehouseId !== undefined) {
    const currentWarehouseId =
      existingVehicle.warehouseId?._id || existingVehicle.warehouseId;
    const nextWarehouseId = updateData.warehouseId;
    if (currentWarehouseId?.toString() !== nextWarehouseId?.toString()) {
      const [currentDriver, tripCount] = await Promise.all([
        driverService.getByCurrentVehicleId(vehicleId),
        tripService.countAll({ filter: { vehicleId } }),
      ]);
      const driverWarehouseId =
        currentDriver?.warehouseId?._id || currentDriver?.warehouseId;
      if (
        tripCount > 0 ||
        (currentDriver &&
          driverWarehouseId?.toString() !== nextWarehouseId?.toString())
      ) {
        throw new ApiError(400, WAREHOUSE_MESSAGES.ACCESS_DENIED);
      }
    }

    if (nextWarehouseId) {
      await warehouseService.getById(nextWarehouseId, true, true);
    }
  }

  if (updateData.vehicleTypeId) {
    await getTypeById(updateData.vehicleTypeId);
  }

  return vehicleRepository.updateById(vehicleId, updateData);
};

const changeStatus = async (vehicleId, status, session = null, user = null) => {
  if (status !== "available") {
    await getById(vehicleId, user);
    return vehicleRepository.updateById(vehicleId, { status }, session);
  }

  const ownsSession = !session;
  const activeSession = session || (await mongoose.startSession());
  if (ownsSession) {
    activeSession.startTransaction();
  }

  try {
    await getById(vehicleId, user);
    if (
      status === "available" &&
      (await vehicleRepository.countOpenUsageLogsByVehicleId(
        vehicleId,
        activeSession,
      )) > 0
    ) {
      throw new ApiError(400, VEHICLE_MESSAGES.VEHICLE_IN_USE);
    }

    const updatedVehicle = await vehicleRepository.updateById(
      vehicleId,
      { status },
      activeSession,
    );

    if (ownsSession) {
      await activeSession.commitTransaction();
    }
    return updatedVehicle;
  } catch (error) {
    if (ownsSession) {
      await activeSession.abortTransaction();
    }
    throw error;
  } finally {
    if (ownsSession) {
      activeSession.endSession();
    }
  }
};

const getStatsByStatus = async ({ filter = {}, warehouseId = null } = {}) => {
  return vehicleRepository.countByStatus(filter, warehouseId);
};

const updateOdometer = async (
  vehicleId,
  newOdo,
  session = null,
  user = null,
) => {
  if (user && user.role === ROLES.DRIVER) {
    const driver = await driverService.getByUserId(user._id);
    if (!driver) {
      throw new ApiError(403, VEHICLE_MESSAGES.DRIVER_PROFILE_NOT_FOUND);
    }

    const currentVehicleId = driver.currentVehicleId?._id?.toString();
    if (currentVehicleId !== vehicleId.toString()) {
      throw new ApiError(403, VEHICLE_MESSAGES.UPDATE_ODO_ONLY_ASSIGNED);
    }
  }

  const existingVehicle = await getById(vehicleId);
  await assertVehicleWarehouseAccess(existingVehicle, user);

  if (newOdo < (existingVehicle.currentOdometer || 0)) {
    throw new ApiError(400, VEHICLE_MESSAGES.ODO_LESS_THAN_CURRENT);
  }

  return vehicleRepository.updateById(
    vehicleId,
    { currentOdometer: newOdo },
    session,
  );
};

const renewRegistration = async (vehicleId, newExpiryDate) => {
  await getById(vehicleId);

  return vehicleRepository.updateById(vehicleId, {
    registrationExpiryDate: newExpiryDate,
  });
};

const renewInsurance = async (vehicleId, newExpiryDate) => {
  await getById(vehicleId);

  return vehicleRepository.updateById(vehicleId, {
    insuranceExpiryDate: newExpiryDate,
  });
};

// ==========================================
// VEHICLE USAGE LOG SERVICES
// ==========================================

const createUsageLog = async (
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
    getById(vehicleId, user),
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

  if (vehicle.status === "in_use") {
    throw new ApiError(400, VEHICLE_MESSAGES.VEHICLE_IN_USE);
  }

  if (vehicle.status === "maintenance" || vehicle.status === "retired") {
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
      (await vehicleRepository.countOpenUsageLogsByVehicleId(
        vehicleId,
        session,
      )) > 0
    ) {
      throw new ApiError(400, VEHICLE_MESSAGES.VEHICLE_IN_USE);
    }

    const newLog = await vehicleRepository.createUsageLog(
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
      { status: "in_use" },
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

const getUsageLogs = async ({
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
    vehicleRepository.findUsageLogs({
      filter: queryFilter,
      skip,
      limit: limitNumber,
      sort,
    }),
    vehicleRepository.countUsageLogs(queryFilter),
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

const getUsageLogById = async (logId, user = null) => {
  const log = await vehicleRepository.findUsageLogById(logId);

  if (!log || log.deletedAt !== null) {
    throw new ApiError(404, VEHICLE_MESSAGES.LOG_NOT_FOUND);
  }

  if (user?.role === ROLES.DISPATCHER) {
    await tripService.getById(log.tripId?._id || log.tripId, false, user);
    await getById(log.vehicleId?._id || log.vehicleId, user);
    const driverId = log.driverId?._id || log.driverId;
    const driver = await driverService.getById(driverId);
    checkWarehouseAccess(driver.warehouseId, user);
  }

  if (user?.role === ROLES.DRIVER) {
    const driver = await getDriverForUser(user);
    const logDriverId = log.driverId?._id || log.driverId;
    if (logDriverId?.toString() !== driver._id.toString()) {
      throw new ApiError(403, VEHICLE_MESSAGES.LOG_ACCESS_DENIED);
    }
  }

  return log;
};

const getUsageLogsByVehicleId = async ({
  vehicleId,
  filter = {},
  page = 1,
  limit = 20,
  sort = { createdAt: -1 },
  user = null,
} = {}) => {
  await getById(vehicleId, user);

  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const limitNumber = Math.max(1, parseInt(limit, 10) || 20);
  const skip = (pageNumber - 1) * limitNumber;

  const queryFilter = await scopeUsageLogFilter(
    { deletedAt: null, ...filter },
    user,
  );

  const [logs, total] = await Promise.all([
    vehicleRepository.findUsageLogsByVehicleId(vehicleId, {
      filter: queryFilter,
      skip,
      limit: limitNumber,
      sort,
    }),
    vehicleRepository.countUsageLogsByVehicleId(vehicleId, queryFilter),
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

const getUsageLogsByDriverId = async ({
  driverId,
  filter = {},
  page = 1,
  limit = 20,
  sort = { createdAt: -1 },
  user = null,
} = {}) => {
  let currentDriver = null;
  if (user?.role === ROLES.DRIVER) {
    currentDriver = await getDriverForUser(user);
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
    vehicleRepository.findUsageLogsByDriverId(driverId, {
      filter: queryFilter,
      skip,
      limit: limitNumber,
      sort,
    }),
    vehicleRepository.countUsageLogsByDriverId(driverId, queryFilter),
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

const getUsageLogsByTripId = async ({ tripId, user = null }) => {
  await tripService.getById(tripId, false, user);

  const queryFilter = await scopeUsageLogFilter({ deletedAt: null }, user);
  return vehicleRepository.findUsageLogsByTripId(tripId, queryFilter);
};

const getVehicleUsageStats = async ({
  vehicleId,
  startDate,
  endDate,
  user = null,
}) => {
  await getById(vehicleId, user);

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

  return vehicleRepository.aggregateVehicleUsageStats(vehicleId, matchFilter);
};

const updateUsageLogById = async (
  logId,
  updateData,
  externalSession = null,
  user = null,
) => {
  const existingLog = await getUsageLogById(logId, user);

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

  if (
    updateData.fuelConsumed !== undefined &&
    updateData.fuelConsumed !== null &&
    updateData.fuelConsumed < 0
  ) {
    throw new ApiError(400, VEHICLE_MESSAGES.FUEL_CONSUMED_INVALID);
  }

  const targetVehicleId =
    updateData.vehicleId || existingLog.vehicleId?._id || existingLog.vehicleId;
  const targetDriverId =
    updateData.driverId || existingLog.driverId?._id || existingLog.driverId;
  const targetTripId =
    updateData.tripId || existingLog.tripId?._id || existingLog.tripId;

  const [vehicle, driver, trip] = await Promise.all([
    getById(targetVehicleId, user),
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
    const updatedLog = await vehicleRepository.updateUsageLogById(
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

const checkOutUsageLog = async ({
  logId,
  endOdo,
  endTime = new Date(),
  fuelConsumed = 0,
  notes,
  user = null,
}) => {
  const existingLog = await getUsageLogById(logId, user);

  if (user && user.role === ROLES.DRIVER) {
    const driver = await driverService.getByUserId(user._id);
    if (!driver) {
      throw new ApiError(403, VEHICLE_MESSAGES.DRIVER_PROFILE_NOT_FOUND);
    }

    const logDriverId = existingLog.driverId?._id?.toString();
    if (logDriverId !== driver._id.toString()) {
      throw new ApiError(403, VEHICLE_MESSAGES.CHECKOUT_OWN_LOG_ONLY);
    }
  }

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

  if (fuelConsumed < 0) {
    throw new ApiError(400, VEHICLE_MESSAGES.FUEL_CONSUMED_INVALID);
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

    const updatedLog = await vehicleRepository.updateUsageLogById(
      logId,
      updatePayload,
      session,
    );

    await vehicleRepository.updateById(
      targetVehicleId,
      { $max: { currentOdometer: endOdo } },
      session,
    );

    const currentVehicle = await getById(targetVehicleId);
    if (
      currentVehicle.status !== "maintenance" &&
      currentVehicle.status !== "retired"
    ) {
      await vehicleRepository.updateById(
        targetVehicleId,
        { status: "available" },
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

const deleteUsageLogById = async (logId, user = null) => {
  const log = await getUsageLogById(logId, user);

  if (!log) {
    throw new ApiError(404, VEHICLE_MESSAGES.LOG_NOT_FOUND);
  }

  if (log.deletedAt !== null && log.deletedAt !== undefined) {
    throw new ApiError(400, VEHICLE_MESSAGES.LOG_ALREADY_DELETED);
  }

  return vehicleRepository.deleteUsageLogById(logId);
};

const restoreUsageLogById = async (logId, user = null) => {
  const log = await vehicleRepository.findUsageLogById(logId);

  if (!log) {
    throw new ApiError(404, VEHICLE_MESSAGES.LOG_NOT_FOUND);
  }

  if (user?.role === ROLES.DISPATCHER) {
    await tripService.getById(log.tripId?._id || log.tripId, false, user);
  }

  if (!log.deletedAt) {
    throw new ApiError(400, VEHICLE_MESSAGES.LOG_NOT_DELETED);
  }

  return vehicleRepository.restoreUsageLogById(logId);
};

export default {
  // Vehicle Type
  createType,
  getActiveTypes,
  getDeletedTypes,
  getTypeById,
  getTypeByName,
  updateType,
  deleteType,
  restoreType,

  // Vehicle Core
  create,
  getAll,
  getIdsByWarehouseId,
  assignToWarehouse,
  getById,
  getByPlateNumber,
  getExpiredRegistration,
  getExpiredInsurance,
  updateById,
  changeStatus,
  getStatsByStatus,
  updateOdometer,
  renewRegistration,
  renewInsurance,

  // Vehicle Usage Log methods
  createUsageLog,
  getUsageLogs,
  getUsageLogById,
  getUsageLogsByVehicleId,
  getUsageLogsByDriverId,
  getUsageLogsByTripId,
  getVehicleUsageStats,
  updateUsageLogById,
  checkOutUsageLog,
  deleteUsageLogById,
  restoreUsageLogById,
};
