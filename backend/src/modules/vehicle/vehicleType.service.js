import { VEHICLE_MESSAGES } from "../../constants/messages.js";
import { ApiError } from "../../utils/ApiError.js";

import vehicleRepository from "./vehicle.repository.js";
import vehicleTypeRepository from "./vehicleType.repository.js";

const create = async ({ name, description, maxWeight, maxVolume }) => {
  const existingVehicleType = await vehicleTypeRepository.findByName(name);

  if (existingVehicleType && existingVehicleType.deletedAt === null) {
    throw new ApiError(409, VEHICLE_MESSAGES.TYPE_EXISTS);
  }

  if (existingVehicleType && existingVehicleType.deletedAt !== null) {
    return vehicleTypeRepository.updateById(existingVehicleType._id, {
      description,
      maxWeight,
      maxVolume,
      deletedAt: null,
    });
  }

  return vehicleTypeRepository.create({
    name,
    description,
    maxWeight,
    maxVolume,
  });
};

const getActive = async ({ page = 1, limit = 10 }) => {
  const skip = (page - 1) * limit;

  const [vehicleTypes, total] = await Promise.all([
    vehicleTypeRepository.findActive({ skip, limit }),
    vehicleTypeRepository.countActive(),
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

const getDeleted = async ({ page = 1, limit = 10 }) => {
  const skip = (page - 1) * limit;

  const [vehicleTypes, total] = await Promise.all([
    vehicleTypeRepository.findDeleted({ skip, limit }),
    vehicleTypeRepository.countDeleted(),
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

const getById = async (vehicleTypeId, requireNotDeleted = true) => {
  const vehicleType = await vehicleTypeRepository.findById(vehicleTypeId);

  if (!vehicleType) {
    throw new ApiError(404, VEHICLE_MESSAGES.TYPE_NOT_FOUND);
  }

  if (requireNotDeleted && vehicleType.deletedAt !== null) {
    throw new ApiError(400, VEHICLE_MESSAGES.TYPE_ALREADY_DELETED);
  }

  return vehicleType;
};

const getByName = async (vehicleTypeName) => {
  return vehicleTypeRepository.findByName(vehicleTypeName);
};

const update = async (vehicleTypeId, updateData) => {
  const existingVehicleType = await getById(vehicleTypeId);

  if (updateData.name && updateData.name !== existingVehicleType.name) {
    const existingVehicleTypeByName = await vehicleTypeRepository.findByName(
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

  return vehicleTypeRepository.updateById(vehicleTypeId, updateData);
};

const deleteById = async (vehicleTypeId) => {
  await getById(vehicleTypeId);

  const assignedVehiclesCount = await vehicleRepository.countAll({
    vehicleTypeId,
  });

  if (assignedVehiclesCount > 0) {
    throw new ApiError(
      400,
      VEHICLE_MESSAGES.TYPE_CANNOT_DELETE_ASSIGNED(assignedVehiclesCount),
    );
  }

  return vehicleTypeRepository.deleteById(vehicleTypeId);
};

const restoreById = async (vehicleTypeId) => {
  const vehicleType = await getById(vehicleTypeId, false);

  if (vehicleType.deletedAt === null) {
    throw new ApiError(400, VEHICLE_MESSAGES.TYPE_NOT_DELETED);
  }

  return vehicleTypeRepository.restoreById(vehicleTypeId);
};

export default {
  create,
  getActive,
  getDeleted,
  getById,
  getByName,
  update,
  deleteById,
  restoreById,
};
