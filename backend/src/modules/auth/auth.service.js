import USER_STATUSES from "../../constants/userStatuses.js";
import ROLES from "../../constants/roles.js";
import { AUTH_MESSAGES } from "../../constants/messages.js";

import ApiError from "../../utils/ApiError.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../../utils/jwt.js";
import { comparePassword } from "../../utils/password.js";

import userService from "../user/user.service.js";
import customerService from "../customer/customer.service.js";
import driverService from "../driver/driver.service.js";
import staffService from "../staff/staff.service.js";
import dispatcherService from "../dispatcher/dispatcher.service.js";

import authRepository from "./auth.repository.js";

const getRoleSpecificInfo = async (user) => {
  const roleInfo = {};

  switch (user.role) {
    case ROLES.CUSTOMER: {
      const customer = await customerService.getByUserId(user._id);
      roleInfo.customerId = customer._id;
      break;
    }
    case ROLES.DRIVER: {
      let driver;
      try {
        driver = await driverService.getByUserId(user._id);
        roleInfo.driverId = driver._id;
        roleInfo.warehouseId = driver.warehouseId?._id;
      } catch (error) {
        if (error instanceof ApiError && error.statusCode === 404) {
          throw new ApiError(403, AUTH_MESSAGES.DRIVER_PROFILE_MISSING);
        }
        throw error;
      }

      if (!roleInfo.warehouseId) {
        throw new ApiError(403, AUTH_MESSAGES.DRIVER_NO_WAREHOUSE);
      }

      if (driver.status !== "active") {
        throw new ApiError(403, AUTH_MESSAGES.ACCOUNT_INACTIVE_OR_LOCKED);
      }
      break;
    }
    case ROLES.WAREHOUSE_STAFF: {
      let staff;
      try {
        staff = await staffService.getByUserId(user._id);
        if (staff.status !== "active") {
          throw new ApiError(403, AUTH_MESSAGES.ACCOUNT_INACTIVE_OR_LOCKED);
        }

        roleInfo.staffId = staff._id;
        roleInfo.warehouseId = staff.warehouseId?._id;
      } catch (error) {
        if (error instanceof ApiError && error.statusCode === 404) {
          throw new ApiError(403, AUTH_MESSAGES.STAFF_PROFILE_MISSING);
        }
        throw error;
      }

      if (!roleInfo.warehouseId) {
        throw new ApiError(403, AUTH_MESSAGES.STAFF_NO_WAREHOUSE);
      }

      if (
        staff.warehouseId.status !== "active" ||
        (staff.warehouseId.deletedAt !== null &&
          staff.warehouseId.deletedAt !== undefined)
      ) {
        throw new ApiError(403, AUTH_MESSAGES.ACCOUNT_INACTIVE_OR_LOCKED);
      }
      break;
    }
    case ROLES.DISPATCHER: {
      let dispatcher;
      try {
        dispatcher = await dispatcherService.getByUserId(user._id);
        roleInfo.dispatcherId = dispatcher._id;
        roleInfo.warehouseId = dispatcher.warehouseId?._id;
      } catch (error) {
        if (error instanceof ApiError && error.statusCode === 404) {
          throw new ApiError(403, AUTH_MESSAGES.DISPATCHER_PROFILE_MISSING);
        }
        throw error;
      }

      if (dispatcher.status !== "active") {
        throw new ApiError(403, AUTH_MESSAGES.ACCOUNT_INACTIVE_OR_LOCKED);
      }

      if (!roleInfo.warehouseId) {
        throw new ApiError(403, AUTH_MESSAGES.DISPATCHER_NO_WAREHOUSE);
      }
      break;
    }
    default:
      break;
  }

  return roleInfo;
};

const register = async ({ email, password, fullName, phone }) => {
  const role = ROLES.CUSTOMER;

  const newUser = await userService.create({
    email,
    password,
    fullName,
    phone,
    role,
  });

  return {
    _id: newUser._id,
    email: newUser.email,
    fullName: newUser.fullName,
    phone: newUser.phone,
    role,
    status: newUser.status,
  };
};

const login = async ({ email, password }) => {
  const user = await userService.getByEmail(email);

  if (!user) {
    throw new ApiError(401, AUTH_MESSAGES.INVALID_CREDENTIALS);
  }

  if (user.status !== USER_STATUSES.ACTIVE) {
    throw new ApiError(403, AUTH_MESSAGES.ACCOUNT_INACTIVE_OR_LOCKED);
  }

  const isPasswordValid = await comparePassword(password, user.password);

  if (!isPasswordValid) {
    throw new ApiError(401, AUTH_MESSAGES.INVALID_CREDENTIALS);
  }

  const roleSpecificInfo = await getRoleSpecificInfo(user);

  const payload = {
    userId: user._id,
    role: user.role,
    ...roleSpecificInfo,
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  await authRepository.createRefreshToken(user._id, refreshToken);

  await userService.updateLastLoginAt(user._id);

  return {
    user: {
      _id: user._id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
      ...roleSpecificInfo,
    },
    tokens: {
      accessToken,
      refreshToken,
    },
  };
};

const refreshAccessToken = async (refreshToken) => {
  let payload;

  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (error) {
    if (error?.name === "TokenExpiredError") {
      await authRepository.deleteRefreshToken(refreshToken);
    }

    throw new ApiError(401, AUTH_MESSAGES.INVALID_OR_EXPIRED_REFRESH_TOKEN);
  }

  const existingRefreshToken =
    await authRepository.findRefreshToken(refreshToken);

  if (!existingRefreshToken) {
    throw new ApiError(401, AUTH_MESSAGES.INVALID_OR_EXPIRED_REFRESH_TOKEN);
  }

  if (existingRefreshToken.userId.toString() !== payload.userId.toString()) {
    throw new ApiError(401, AUTH_MESSAGES.INVALID_OR_EXPIRED_REFRESH_TOKEN);
  }

  const user = await userService.getByIdWithStatus(payload.userId);

  if (!user) {
    throw new ApiError(401, AUTH_MESSAGES.USER_NOT_FOUND);
  }

  if (user.status !== USER_STATUSES.ACTIVE) {
    throw new ApiError(403, AUTH_MESSAGES.ACCOUNT_INACTIVE_OR_LOCKED);
  }

  const roleSpecificInfo = await getRoleSpecificInfo(user);

  const newPayload = {
    userId: user._id,
    role: user.role,
    ...roleSpecificInfo,
  };

  const newAccessToken = generateAccessToken(newPayload);

  return {
    accessToken: newAccessToken,
  };
};

const logout = async (refreshToken) => {
  await authRepository.deleteRefreshToken(refreshToken);
};

const revokeRefreshTokenByUserId = (userId) => {
  return authRepository.deleteRefreshTokenByUserId(userId);
};

export default {
  register,
  login,
  refreshAccessToken,
  logout,
  revokeRefreshTokenByUserId,
};
