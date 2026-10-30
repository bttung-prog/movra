import mongoose from "mongoose";

import { USER_MESSAGES, COMMON_MESSAGES } from "../../constants/messages.js";

import ApiError from "../../utils/ApiError.js";
import { escapeRegex } from "../../utils/regexUtils.js";

import customerService from "../customer/customer.service.js";
import driverService from "../driver/driver.service.js";
import staffService from "../staff/staff.service.js";
import dispatcherService from "../dispatcher/dispatcher.service.js";

import userRepository from "./user.repository.js";

const createWithHashedPassword = async ({
  email,
  passwordHash,
  phone,
  fullName,
  role = "customer",
  driverData,
  staffData,
  dispatcherData,
}) => {
  if (!email || !passwordHash || !phone || !fullName || !role) {
    throw new ApiError(400, COMMON_MESSAGES.ALL_FIELDS_REQUIRED);
  }

  if (role === "driver" && !driverData) {
    throw new ApiError(400, USER_MESSAGES.DRIVER_DATA_REQUIRED);
  }

  if (role === "warehouse_staff" && !staffData) {
    throw new ApiError(400, USER_MESSAGES.STAFF_DATA_REQUIRED);
  }

  if (role === "dispatcher" && !dispatcherData) {
    throw new ApiError(400, USER_MESSAGES.DISPATCHER_DATA_REQUIRED);
  }

  const cleanEmail = email.toLowerCase().trim();
  const cleanPhone = phone.trim();
  const cleanFullName = fullName.trim();
  const cleanRole = role.trim();

  const existingEmailUser = await userRepository.findByEmail(cleanEmail);
  if (existingEmailUser) {
    throw new ApiError(409, USER_MESSAGES.EMAIL_EXISTS);
  }

  const existingPhoneUser = await userRepository.findByPhone(cleanPhone);
  if (existingPhoneUser) {
    throw new ApiError(409, USER_MESSAGES.PHONE_EXISTS);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const newUser = await userRepository.create(
      {
        email: cleanEmail,
        password: passwordHash,
        fullName: cleanFullName,
        phone: cleanPhone,
        role: cleanRole,
      },
      session,
    );

    if (cleanRole === "customer") {
      await customerService.create(newUser._id, session);
    }

    if (cleanRole === "driver") {
      await driverService.create(
        {
          userId: newUser._id,
          ...driverData,
        },
        session,
      );
    }

    if (cleanRole === "warehouse_staff") {
      await staffService.create(
        {
          userId: newUser._id,
          warehouseId: staffData.warehouseId,
        },
        session,
      );
    }

    if (cleanRole === "dispatcher") {
      await dispatcherService.create(
        {
          userId: newUser._id,
          warehouseId: dispatcherData.warehouseId,
        },
        session,
      );
    }

    await session.commitTransaction();
    return newUser;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const getById = async (userId, session = null) => {
  const user = await userRepository.findById(userId, session);
  if (!user) {
    throw new ApiError(404, USER_MESSAGES.NOT_FOUND);
  }

  return user;
};

const getMe = async (userId) => {
  return getById(userId);
};

const getByEmail = async (email) => {
  if (!email || !email.trim()) return null;
  return userRepository.findByEmail(email.toLowerCase().trim());
};

const getByPhone = async (phone) => {
  if (!phone || !phone.trim()) return null;
  return userRepository.findByPhone(phone.trim());
};

const getPasswordHash = (userId) => {
  return userRepository.findPassword(userId);
};

const updatePasswordHash = (userId, passwordHash) => {
  return userRepository.updateById(userId, {
    $set: { password: passwordHash },
    $inc: { tokenVersion: 1 },
  });
};

const updateLastLoginAt = (userId) => {
  return userRepository.updateById(userId, { lastLoginAt: new Date() });
};

const updateMe = async (userId, { phone, fullName }) => {
  const updateData = {};

  if (phone !== undefined) {
    const cleanPhone = phone.trim();
    const existingPhoneUser = await userRepository.findByPhone(cleanPhone);
    if (
      existingPhoneUser &&
      existingPhoneUser._id.toString() !== userId.toString()
    ) {
      throw new ApiError(409, USER_MESSAGES.PHONE_EXISTS);
    }
    updateData.phone = cleanPhone;
  }

  if (fullName !== undefined) {
    updateData.fullName = fullName.trim();
  }

  const user = await userRepository.updateById(userId, updateData);

  if (!user) {
    throw new ApiError(404, USER_MESSAGES.NOT_FOUND);
  }

  return user;
};

const getByIdWithStatus = (userId) => {
  return userRepository.findById(userId);
};

const getAll = async ({ filter = {}, page = 1, limit = 10 } = {}) => {
  const pageNumber = parseInt(page, 10) || 1;
  const limitNumber = parseInt(limit, 10) || 10;
  const skip = (pageNumber - 1) * limitNumber;

  const [users, totalUsers] = await Promise.all([
    userRepository.findAll({ filter, skip, limit: limitNumber }),
    userRepository.countAll(filter),
  ]);

  return {
    data: users,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      totalUsers,
      totalPages: Math.ceil(totalUsers / limitNumber),
    },
  };
};

const search = async (keyword) => {
  if (!keyword || !keyword.trim()) {
    return [];
  }

  const cleanKeyword = escapeRegex(keyword.trim());
  return userRepository.search(cleanKeyword);
};

const searchPaginated = async (
  keyword,
  { page = 1, limit = 10, filter = {} } = {},
) => {
  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const limitNumber = Math.max(1, parseInt(limit, 10) || 10);
  const skip = (pageNumber - 1) * limitNumber;

  if (!keyword || !keyword.trim()) {
    return {
      data: [],
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        totalUsers: 0,
        totalPages: 0,
      },
    };
  }

  const cleanKeyword = escapeRegex(keyword.trim());
  const [users, totalUsers] = await Promise.all([
    userRepository.searchPaginated(cleanKeyword, {
      skip,
      limit: limitNumber,
      filter,
    }),
    userRepository.countSearch(cleanKeyword, filter),
  ]);

  return {
    data: users,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      totalUsers,
      totalPages: Math.ceil(totalUsers / limitNumber),
    },
  };
};

const updateById = async (userId, updateData) => {
  await getById(userId);

  if (updateData.role !== undefined || updateData.status !== undefined) {
    throw new ApiError(
      400,
      USER_MESSAGES.ROLE_STATUS_CHANGE_REQUIRES_DEDICATED_OPERATION,
    );
  }

  const cleanData = {};

  if (updateData.email !== undefined) {
    const cleanEmail = updateData.email.toLowerCase().trim();
    const existingEmailUser = await userRepository.findByEmail(cleanEmail);
    if (
      existingEmailUser &&
      existingEmailUser._id.toString() !== userId.toString()
    ) {
      throw new ApiError(409, USER_MESSAGES.EMAIL_EXISTS);
    }
    cleanData.email = cleanEmail;
  }

  if (updateData.phone !== undefined) {
    const cleanPhone = updateData.phone.trim();
    const existingPhoneUser = await userRepository.findByPhone(cleanPhone);
    if (
      existingPhoneUser &&
      existingPhoneUser._id.toString() !== userId.toString()
    ) {
      throw new ApiError(409, USER_MESSAGES.PHONE_EXISTS);
    }
    cleanData.phone = cleanPhone;
  }

  if (updateData.fullName !== undefined) {
    cleanData.fullName = updateData.fullName.trim();
  }

  return userRepository.updateById(userId, cleanData);
};

const updateRole = async (userId, role, roleData = {}) => {
  const existingUser = await getById(userId);

  const cleanRole = typeof role === "string" ? role.trim() : role;
  const { driverData, staffData, dispatcherData } = roleData;

  if (cleanRole === "dispatcher" && existingUser.status !== "active") {
    throw new ApiError(400, USER_MESSAGES.DISPATCHER_USER_NOT_ACTIVE);
  }

  if (cleanRole === "driver" && !driverData) {
    throw new ApiError(400, USER_MESSAGES.DRIVER_DATA_REQUIRED);
  }

  if (cleanRole === "warehouse_staff" && !staffData) {
    throw new ApiError(400, USER_MESSAGES.STAFF_DATA_REQUIRED);
  }

  if (cleanRole === "dispatcher" && !dispatcherData) {
    throw new ApiError(400, USER_MESSAGES.DISPATCHER_DATA_REQUIRED);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (existingUser.role === "dispatcher" && cleanRole !== "dispatcher") {
      const dispatcher = await dispatcherService.getByUserId(userId, session);
      await dispatcherService.updateStatus(dispatcher._id, "inactive", session);
    }

    const updatedUser = await userRepository.updateById(
      userId,
      { role: cleanRole },
      session,
    );

    if (cleanRole === "customer") {
      try {
        await customerService.getByUserId(userId, session);
      } catch (error) {
        if (!(error instanceof ApiError) || error.statusCode !== 404) {
          throw error;
        }
        await customerService.create(userId, session);
      }
    }

    if (cleanRole === "driver") {
      let driver;
      try {
        driver = await driverService.getByUserId(userId, session);
      } catch (error) {
        if (!(error instanceof ApiError) || error.statusCode !== 404) {
          throw error;
        }
        await driverService.create(
          {
            userId,
            ...driverData,
          },
          session,
        );
      }

      if (driver) {
        await driverService.updateById(
          driver._id,
          {
            ...driverData,
            ...(existingUser.status === "active" ? { status: "active" } : {}),
          },
          session,
        );
      }
    }

    if (cleanRole === "warehouse_staff") {
      let staff;
      try {
        staff = await staffService.getByUserId(userId, session);
      } catch (e) {
        if (!(e instanceof ApiError) || e.statusCode !== 404) {
          throw e;
        }
      }

      if (staff) {
        await staffService.updateById(
          staff._id,
          {
            warehouseId: staffData.warehouseId,
            status: "active",
          },
          session,
        );
      } else {
        await staffService.create(
          { userId, warehouseId: staffData.warehouseId },
          session,
        );
      }
    }

    if (cleanRole === "dispatcher") {
      try {
        const dispatcher = await dispatcherService.getByUserId(userId, session);
        await dispatcherService.updateById(
          dispatcher._id,
          {
            warehouseId: dispatcherData.warehouseId,
            status: "active",
          },
          session,
        );
      } catch (e) {
        if (!(e instanceof ApiError) || e.statusCode !== 404) {
          throw e;
        }
        await dispatcherService.create(
          {
            userId,
            warehouseId: dispatcherData.warehouseId,
          },
          session,
        );
      }
    }

    await session.commitTransaction();
    return updatedUser;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const updateStatus = async (userId, status, externalSession = null) => {
  const user = await getById(userId, externalSession);

  const cleanStatus = typeof status === "string" ? status.trim() : status;
  const ownsSession = !externalSession;
  const session = externalSession || (await mongoose.startSession());
  if (ownsSession) {
    session.startTransaction();
  }

  try {
    const updatedUser = await userRepository.updateById(
      userId,
      { status: cleanStatus },
      session,
    );
    if (cleanStatus !== "active" && user.role === "dispatcher") {
      const dispatcher = await dispatcherService.getByUserId(userId, session);
      await dispatcherService.updateStatus(dispatcher._id, "inactive", session);
    }
    if (ownsSession) {
      await session.commitTransaction();
    }
    return updatedUser;
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

export default {
  createWithHashedPassword,
  getById,
  getByIdWithStatus,
  getMe,
  getByEmail,
  getByPhone,
  getPasswordHash,
  updatePasswordHash,
  updateLastLoginAt,
  updateMe,
  getAll,
  search,
  searchPaginated,
  updateById,
  updateRole,
  updateStatus,
};
