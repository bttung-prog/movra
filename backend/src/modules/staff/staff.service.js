import { STAFF_MESSAGES } from "../../constants/messages.js";

import ApiError from "../../utils/ApiError.js";
import generateCode from "../../utils/generateCode.js";
import { escapeRegex } from "../../utils/regexUtils.js";

import userService from "../user/user.service.js";
import warehouseService from "../warehouse/warehouse.service.js";

import staffRepository from "./staff.repository.js";

const create = async ({ userId, warehouseId }, session = null) => {
  await userService.getById(userId, session);
  await warehouseService.getById(warehouseId, true, true);

  const existByUserId = await staffRepository.findByUserId(userId, session);
  if (existByUserId) {
    throw new ApiError(409, STAFF_MESSAGES.ALREADY_EXISTS);
  }

  let staffCode;
  let isUnique = false;
  let attempts = 0;

  while (!isUnique && attempts < 5) {
    staffCode = generateCode("ST-");
    const existing = await staffRepository.findByCode(staffCode);
    if (!existing) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) {
    throw new ApiError(500, STAFF_MESSAGES.CODE_GEN_FAILED);
  }

  return staffRepository.create({ userId, warehouseId, staffCode }, session);
};

const getAll = async ({
  filter = {},
  page = 1,
  limit = 10,
  search = "",
} = {}) => {
  const pageNumber = parseInt(page, 10) || 1;
  const limitNumber = parseInt(limit, 10) || 10;
  const skip = (pageNumber - 1) * limitNumber;

  const queryFilter = { ...filter };
  if (search && search.trim()) {
    queryFilter.staffCode = {
      $regex: escapeRegex(search.trim()),
      $options: "i",
    };
  }

  const [staffs, total] = await Promise.all([
    staffRepository.findAll({ filter: queryFilter, skip, limit: limitNumber }),
    staffRepository.countAll(queryFilter),
  ]);

  return {
    data: staffs,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages: Math.ceil(total / limitNumber),
    },
  };
};

const getById = async (staffId, session = null) => {
  const staff = await staffRepository.findById(staffId, session);

  if (!staff) {
    throw new ApiError(404, STAFF_MESSAGES.NOT_FOUND);
  }

  return staff;
};

const countActiveByWarehouseId = (warehouseId) => {
  return staffRepository.countActiveByWarehouseId(warehouseId);
};

const getByUserId = async (userId, session = null) => {
  const staff = await staffRepository.findByUserId(userId, session);

  if (!staff) {
    throw new ApiError(404, STAFF_MESSAGES.NOT_FOUND);
  }

  return staff;
};

const getByCode = async (staffCode) => {
  const staff = await staffRepository.findByCode(staffCode);

  if (!staff) {
    throw new ApiError(404, STAFF_MESSAGES.NOT_FOUND);
  }

  return staff;
};

const updateById = async (staffId, updateData, session = null) => {
  await getById(staffId, session);

  if (updateData.warehouseId) {
    await warehouseService.getById(updateData.warehouseId, true, true);
  }

  const updatedStaff = await staffRepository.updateById(
    staffId,
    updateData,
    session,
  );

  if (!updatedStaff) {
    throw new ApiError(404, STAFF_MESSAGES.NOT_FOUND);
  }

  return updatedStaff;
};

const deleteById = async (staffId) => {
  await getById(staffId);

  const deletedStaff = await staffRepository.deleteById(staffId);

  if (!deletedStaff) {
    throw new ApiError(404, STAFF_MESSAGES.NOT_FOUND);
  }

  return deletedStaff;
};

const restoreById = async (staffId) => {
  await getById(staffId);

  const restoredStaff = await staffRepository.restoreById(staffId);

  if (!restoredStaff) {
    throw new ApiError(404, STAFF_MESSAGES.NOT_FOUND);
  }

  return restoredStaff;
};

const transferWarehouse = async (staffId, warehouseId) => {
  await getById(staffId);
  await warehouseService.getById(warehouseId, true, true);

  const updatedStaff = await staffRepository.transferWarehouse(
    staffId,
    warehouseId,
  );

  if (!updatedStaff) {
    throw new ApiError(404, STAFF_MESSAGES.NOT_FOUND);
  }

  return updatedStaff;
};

const getMyProfile = async (userId) => {
  return getByUserId(userId);
};

export default {
  create,
  getAll,
  getById,
  countActiveByWarehouseId,
  getByUserId,
  getByCode,
  getMyProfile,
  updateById,
  deleteById,
  restoreById,
  transferWarehouse,
};
