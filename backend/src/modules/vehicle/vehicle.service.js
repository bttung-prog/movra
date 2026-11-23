import mongoose from "mongoose";

import { ROLES } from "../../constants/roles.js";
import {
  VEHICLE_MESSAGES,
  WAREHOUSE_MESSAGES,
} from "../../constants/messages.js";
import { VEHICLE_STATUSES } from "../../constants/vehicleStatuses.js";

import { ApiError } from "../../utils/ApiError.js";
import { checkWarehouseAccess } from "../../utils/checkWarehouseAccess.js";
import { getActorUserId } from "../../utils/actor.util.js";

import driverService from "../driver/driver.service.js";
import tripService from "../trip/trip.service.js";
import warehouseService from "../warehouse/warehouse.service.js";
import vehicleTypeService from "./vehicleType.service.js";

import vehicleUsageLogRepository from "./vehicleUsageLog.repository.js";
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
    vehicleTypeService.getById(vehicleTypeId),
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

const updateById = async (vehicleId, updateData, session = null) => {
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
    await vehicleTypeService.getById(updateData.vehicleTypeId);
  }

  return vehicleRepository.updateById(vehicleId, updateData, session);
};

const changeStatus = async (vehicleId, status, session = null, user = null) => {
  if (status !== VEHICLE_STATUSES.AVAILABLE) {
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
      (await vehicleUsageLogRepository.countOpenByVehicleId(
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
    const driver = await driverService.getByUserId(getActorUserId(user));

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

export default {
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
};
