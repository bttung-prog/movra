import mongoose from "mongoose";

import {
  DRIVER_MESSAGES,
  USER_MESSAGES,
  WAREHOUSE_MESSAGES,
} from "../../constants/messages.js";
import USER_STATUSES from "../../constants/userStatuses.js";
import ROLES from "../../constants/roles.js";

import ApiError from "../../utils/ApiError.js";
import checkWarehouseAccess from "../../utils/checkWarehouseAccess.js";
import generateCode from "../../utils/generateCode.js";

import userService from "../user/user.service.js";
import warehouseService from "../warehouse/warehouse.service.js";
import vehicleService from "../vehicle/vehicle.service.js";
import tripService from "../trip/trip.service.js";

import driverRepository from "./driver.repository.js";

const ensureLicenseIsValid = (licenseExpiryDate) => {
  const expiryDate = new Date(licenseExpiryDate);
  if (isNaN(expiryDate.getTime()) || expiryDate <= new Date()) {
    throw new ApiError(400, DRIVER_MESSAGES.EXPIRY_MUST_BE_FUTURE);
  }
};

const create = async (
  {
    userId,
    warehouseId,
    idCardNumber,
    dateOfBirth,
    gender,
    address,
    licenseNumber,
    licenseType,
    licenseExpiryDate,
  },
  session = null,
) => {
  ensureLicenseIsValid(licenseExpiryDate);

  const user = await userService.getById(userId, session);
  if (user.role !== ROLES.DRIVER) {
    throw new ApiError(400, USER_MESSAGES.DRIVER_ROLE_INVALID);
  }
  await warehouseService.getById(warehouseId, true, true);

  const conflictDriver = await driverRepository.checkIdentityConflict(
    {
      userId,
      idCardNumber,
      licenseNumber,
    },
    session,
  );

  if (conflictDriver) {
    if (conflictDriver.userId.toString() === userId.toString()) {
      throw new ApiError(409, DRIVER_MESSAGES.ALREADY_EXISTS);
    }

    if (conflictDriver.idCardNumber === idCardNumber) {
      throw new ApiError(409, DRIVER_MESSAGES.ID_CARD_EXISTS);
    }

    if (conflictDriver.licenseNumber === licenseNumber) {
      throw new ApiError(409, DRIVER_MESSAGES.LICENSE_EXISTS);
    }

    throw new ApiError(409, DRIVER_MESSAGES.IDENTITY_CONFLICT);
  }

  let driverCode;
  let isUnique = false;
  let attempts = 0;

  while (!isUnique && attempts < 5) {
    driverCode = generateCode("DR-");
    const existing = await driverRepository.findByCode(driverCode);
    if (!existing) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) {
    throw new ApiError(500, DRIVER_MESSAGES.CODE_GEN_FAILED);
  }

  return driverRepository.create(
    {
      userId,
      driverCode,
      warehouseId,
      idCardNumber,
      dateOfBirth,
      gender,
      address,
      licenseNumber,
      licenseType,
      licenseExpiryDate,
    },
    session,
  );
};

const getAll = async ({ filter = {}, page = 1, limit = 10, user = null }) => {
  let queryFilter = filter;
  if (user?.role === ROLES.DISPATCHER) {
    if (!user.warehouseId) {
      throw new ApiError(403, WAREHOUSE_MESSAGES.DISPATCHER_NOT_ASSIGNED);
    }
    queryFilter = { ...filter, warehouseId: user.warehouseId };
  }

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.max(1, parseInt(limit, 10) || 10);
  const skip = (parsedPage - 1) * parsedLimit;

  const [drivers, totalDrivers] = await Promise.all([
    driverRepository.findAll({ filter: queryFilter, skip, limit: parsedLimit }),
    driverRepository.countAll(queryFilter),
  ]);

  return {
    data: drivers,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      totalDrivers,
      totalPages: Math.ceil(totalDrivers / parsedLimit),
    },
  };
};

const getById = async (driverId, user = null, session = null) => {
  const driver = await driverRepository.findById(driverId, session);

  if (!driver) {
    throw new ApiError(404, DRIVER_MESSAGES.NOT_FOUND);
  }

  checkWarehouseAccess(driver.warehouseId, user);

  return driver;
};

const getVehicleIdsByWarehouseId = (warehouseId) => {
  return driverRepository.findVehicleIdsByWarehouseId(warehouseId);
};

const getIdsByWarehouseId = (warehouseId) => {
  return driverRepository.findIdsByWarehouseId(warehouseId);
};

const countActiveByWarehouseId = (warehouseId) => {
  return driverRepository.countActiveByWarehouseId(warehouseId);
};

const getByCurrentVehicleId = (vehicleId) => {
  return driverRepository.findByCurrentVehicleId(vehicleId);
};

const ensureNoActiveTrips = async (
  driverId,
  message = DRIVER_MESSAGES.CANNOT_DEACTIVATE_ACTIVE_TRIPS,
) => {
  if ((await tripService.countActiveByDriverId(driverId)) > 0) {
    throw new ApiError(400, message);
  }
};

const updateById = async (driverId, updateData, externalSession = null) => {
  const existingDriver = await getById(driverId, null, externalSession);
  if (updateData.licenseExpiryDate !== undefined) {
    ensureLicenseIsValid(updateData.licenseExpiryDate);
  }
  const existingVehicleId =
    existingDriver.currentVehicleId?._id?.toString() ||
    existingDriver.currentVehicleId?.toString() ||
    null;
  const requestedVehicleId = updateData.currentVehicleId?.toString() || null;
  const isDeactivating =
    updateData.status !== undefined &&
    updateData.status !== "active" &&
    existingDriver.status === "active";
  const isChangingVehicle =
    updateData.currentVehicleId !== undefined &&
    requestedVehicleId !== existingVehicleId;

  if (isDeactivating || isChangingVehicle) {
    await ensureNoActiveTrips(
      driverId,
      isChangingVehicle
        ? DRIVER_MESSAGES.CANNOT_CHANGE_VEHICLE_ACTIVE_TRIPS
        : DRIVER_MESSAGES.CANNOT_DEACTIVATE_ACTIVE_TRIPS,
    );
  }

  if (updateData.warehouseId) {
    await warehouseService.getById(updateData.warehouseId, true, true);
    const existingWarehouseId =
      existingDriver.warehouseId?._id || existingDriver.warehouseId;
    if (
      existingWarehouseId?.toString() !== updateData.warehouseId.toString() &&
      (await tripService.countActiveByDriverId(driverId)) > 0
    ) {
      throw new ApiError(400, WAREHOUSE_MESSAGES.ACCESS_DENIED);
    }
    if (
      existingWarehouseId?.toString() !== updateData.warehouseId.toString() &&
      existingDriver.currentVehicleId
    ) {
      throw new ApiError(400, WAREHOUSE_MESSAGES.ACCESS_DENIED);
    }
  }

  if (updateData.currentVehicleId) {
    const vehicle = await vehicleService.getById(updateData.currentVehicleId);
    const driverWarehouseId =
      updateData.warehouseId ||
      existingDriver.warehouseId?._id ||
      existingDriver.warehouseId;
    const vehicleWarehouseId = vehicle.warehouseId?._id || vehicle.warehouseId;
    if (
      vehicleWarehouseId &&
      vehicleWarehouseId.toString() !== driverWarehouseId?.toString()
    ) {
      throw new ApiError(400, WAREHOUSE_MESSAGES.ACCESS_DENIED);
    }
    if (vehicle.status === "maintenance" || vehicle.status === "retired") {
      throw new ApiError(
        400,
        `Xe mang biển số ${vehicle.plateNumber} đang ở trạng thái '${vehicle.status}', không thể bàn giao cho tài xế`,
      );
    }
    await vehicleService.assignToWarehouse(
      updateData.currentVehicleId,
      driverWarehouseId,
    );
  }

  if (updateData.warehouseId && existingDriver.currentVehicleId) {
    const vehicleId =
      existingDriver.currentVehicleId?._id || existingDriver.currentVehicleId;
    const vehicle = await vehicleService.getById(vehicleId);
    const vehicleWarehouseId = vehicle.warehouseId?._id || vehicle.warehouseId;
    if (
      vehicleWarehouseId &&
      vehicleWarehouseId.toString() !== updateData.warehouseId.toString()
    ) {
      throw new ApiError(400, WAREHOUSE_MESSAGES.ACCESS_DENIED);
    }
  }

  if (updateData.status === undefined) {
    return driverRepository.updateById(driverId, updateData, externalSession);
  }

  const userStatus =
    updateData.status === "active"
      ? USER_STATUSES.ACTIVE
      : USER_STATUSES.INACTIVE;
  const ownsSession = !externalSession;
  const session = externalSession || (await mongoose.startSession());
  if (ownsSession) {
    session.startTransaction();
  }

  try {
    const updatedDriver = await driverRepository.updateById(
      driverId,
      updateData,
      session,
    );

    await userService.updateStatus(
      existingDriver.userId?._id || existingDriver.userId,
      userStatus,
      session,
    );

    if (ownsSession) {
      await session.commitTransaction();
    }

    return updatedDriver;
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

const deleteById = async (driverId) => {
  const driver = await getById(driverId);
  await ensureNoActiveTrips(driverId);

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const deletedDriver = await driverRepository.deleteById(driverId, session);

    await userService.updateStatus(
      driver.userId?._id || driver.userId,
      USER_STATUSES.INACTIVE,
      session,
    );

    await session.commitTransaction();

    return deletedDriver;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const getByUserId = async (userId, session = null) => {
  const driver = await driverRepository.findByUserId(userId, session);

  if (!driver) {
    throw new ApiError(404, DRIVER_MESSAGES.NOT_FOUND);
  }

  return driver;
};

const getByCode = async (driverCode, user = null) => {
  const driver = await driverRepository.findByCode(driverCode);

  if (!driver) {
    throw new ApiError(404, DRIVER_MESSAGES.NOT_FOUND);
  }

  checkWarehouseAccess(driver.warehouseId, user);

  return driver;
};

const renewLicense = async (driverId, newExpiryDate) => {
  await getById(driverId);
  ensureLicenseIsValid(newExpiryDate);

  return driverRepository.renewLicense(driverId, new Date(newExpiryDate));
};

export default {
  create,
  getAll,
  getById,
  getVehicleIdsByWarehouseId,
  getIdsByWarehouseId,
  countActiveByWarehouseId,
  getByCurrentVehicleId,
  ensureLicenseIsValid,
  getByUserId,
  updateById,
  deleteById,
  getByCode,
  renewLicense,
};
