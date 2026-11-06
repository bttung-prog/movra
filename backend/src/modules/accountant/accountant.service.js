import {
  ACCOUNTANT_MESSAGES,
  USER_MESSAGES,
} from "../../constants/messages.js";
import { ROLES } from "../../constants/roles.js";
import { USER_STATUSES } from "../../constants/userStatuses.js";

import ApiError from "../../utils/ApiError.js";
import generateCode from "../../utils/generateCode.js";

import userService from "../user/user.service.js";

import accountantRepository from "./accountant.repository.js";

const create = async ({ userId }, session = null) => {
  const user = await userService.getById(userId, session);
  if (user.role !== ROLES.ACCOUNTANT) {
    throw new ApiError(400, USER_MESSAGES.ACCOUNTANT_ROLE_INVALID);
  }
  if (user.status !== USER_STATUSES.ACTIVE) {
    throw new ApiError(400, USER_MESSAGES.ACCOUNTANT_USER_NOT_ACTIVE);
  }

  if (await accountantRepository.findByUserId(userId, session)) {
    throw new ApiError(409, ACCOUNTANT_MESSAGES.ALREADY_EXISTS);
  }

  let accountantCode;
  let isUnique = false;
  let attempts = 0;

  while (!isUnique && attempts < 5) {
    accountantCode = generateCode.generateCode("ACC-");
    if (!(await accountantRepository.findByCode(accountantCode))) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) {
    throw new ApiError(500, ACCOUNTANT_MESSAGES.CODE_GEN_FAILED);
  }

  try {
    return await accountantRepository.create(
      { userId, accountantCode },
      session,
    );
  } catch (error) {
    if (error?.code !== 11000) {
      throw error;
    }

    if (error.keyPattern?.userId || error.keyValue?.userId) {
      throw new ApiError(409, ACCOUNTANT_MESSAGES.ALREADY_EXISTS);
    }
    if (error.keyPattern?.accountantCode || error.keyValue?.accountantCode) {
      throw new ApiError(409, ACCOUNTANT_MESSAGES.CODE_ALREADY_EXISTS);
    }
    throw error;
  }
};

const getAll = async ({ filter = {}, page = 1, limit = 10 } = {}) => {
  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const limitNumber = Math.max(1, parseInt(limit, 10) || 10);
  const skip = (pageNumber - 1) * limitNumber;

  const [accountants, total] = await Promise.all([
    accountantRepository.findAll({ filter, skip, limit: limitNumber }),
    accountantRepository.countAll(filter),
  ]);

  return {
    data: accountants,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages: Math.ceil(total / limitNumber),
    },
  };
};

const getById = async (accountantId, session = null) => {
  const accountant = await accountantRepository.findById(accountantId, session);
  if (!accountant) {
    throw new ApiError(404, ACCOUNTANT_MESSAGES.NOT_FOUND);
  }

  return accountant;
};

const getByUserId = async (userId, session = null) => {
  const accountant = await accountantRepository.findByUserId(userId, session);
  if (!accountant) {
    throw new ApiError(404, ACCOUNTANT_MESSAGES.NOT_FOUND);
  }

  return accountant;
};

const getByCode = async (accountantCode) => {
  const accountant = await accountantRepository.findByCode(accountantCode);
  if (!accountant) {
    throw new ApiError(404, ACCOUNTANT_MESSAGES.NOT_FOUND);
  }

  return accountant;
};

const getMyProfile = (userId) => getByUserId(userId);

const updateStatus = async (accountantId, status, session = null) => {
  const accountant = await getById(accountantId, session);
  if (status === "active") {
    const userId = accountant.userId?._id || accountant.userId;
    const user = await userService.getById(userId, session);
    if (
      user.role !== ROLES.ACCOUNTANT ||
      user.status !== USER_STATUSES.ACTIVE
    ) {
      throw new ApiError(400, USER_MESSAGES.ACCOUNTANT_USER_NOT_ACTIVE);
    }
  }

  const updatedAccountant = await accountantRepository.updateById(
    accountantId,
    { status },
    session,
  );
  if (!updatedAccountant) {
    throw new ApiError(404, ACCOUNTANT_MESSAGES.NOT_FOUND);
  }

  return updatedAccountant;
};

const deleteById = (accountantId) => updateStatus(accountantId, "inactive");

export default {
  create,
  getAll,
  getById,
  getByUserId,
  getByCode,
  getMyProfile,
  updateStatus,
  deleteById,
};
