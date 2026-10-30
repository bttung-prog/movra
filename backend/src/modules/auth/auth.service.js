import USER_STATUSES from "../../constants/userStatuses.js";
import ROLES from "../../constants/roles.js";
import { AUTH_MESSAGES, USER_MESSAGES } from "../../constants/messages.js";

import ApiError from "../../utils/ApiError.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../../utils/jwt.js";
import { comparePassword, hashPassword } from "../../utils/password.js";
import { generateOtp } from "../../utils/generateCode.js";
import {
  sendPasswordResetOtpEmail,
  sendRegisterOtpEmail,
} from "../../utils/email.js";

import userService from "../user/user.service.js";
import customerService from "../customer/customer.service.js";
import driverService from "../driver/driver.service.js";
import staffService from "../staff/staff.service.js";
import dispatcherService from "../dispatcher/dispatcher.service.js";

import authRepository from "./auth.repository.js";

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

const createUser = async ({ password, ...userData }) => {
  const passwordHash = await hashPassword(password);
  return userService.createWithHashedPassword({ ...userData, passwordHash });
};

const changePassword = async (userId, oldPassword, newPassword) => {
  const user = await userService.getPasswordHash(userId);

  if (!user) {
    throw new ApiError(404, USER_MESSAGES.NOT_FOUND);
  }

  const isMatchPassword = await comparePassword(oldPassword, user.password);
  if (!isMatchPassword) {
    throw new ApiError(401, USER_MESSAGES.OLD_PASSWORD_INCORRECT);
  }

  const passwordHash = await hashPassword(newPassword);
  const updatedUser = await userService.updatePasswordHash(
    userId,
    passwordHash,
  );

  await authRepository.deleteRefreshTokenByUserId(userId);
  return updatedUser;
};

const updateLastLoginAt = (userId) => {
  return userService.updateLastLoginAt(userId);
};

const normalizeEmail = (email) => email.toLowerCase().trim();

const verifyOtp = async ({
  email,
  otp,
  findOtp,
  incrementAttempts,
  consumeOtp,
}) => {
  const savedOtp = await findOtp(email);

  if (
    !savedOtp ||
    savedOtp.expiresAt <= new Date() ||
    savedOtp.attempts >= MAX_OTP_ATTEMPTS
  ) {
    throw new ApiError(400, AUTH_MESSAGES.INVALID_OR_EXPIRED_OTP);
  }

  if (savedOtp.otp !== otp) {
    await incrementAttempts(email);
    throw new ApiError(400, AUTH_MESSAGES.INVALID_OR_EXPIRED_OTP);
  }

  const consumedOtp = await consumeOtp(email, otp);
  if (!consumedOtp) {
    throw new ApiError(400, AUTH_MESSAGES.INVALID_OR_EXPIRED_OTP);
  }

  return consumedOtp;
};

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
  const cleanEmail = normalizeEmail(email);

  if (await userService.getByEmail(cleanEmail)) {
    throw new ApiError(409, USER_MESSAGES.EMAIL_EXISTS);
  }

  if (await userService.getByPhone(phone.trim())) {
    throw new ApiError(409, USER_MESSAGES.PHONE_EXISTS);
  }

  const otp = generateOtp();
  await authRepository.createRegisterOtp({
    email: cleanEmail,
    otp,
    expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
    attempts: 0,
    pendingRegistration: {
      passwordHash: await hashPassword(password),
      fullName: fullName.trim(),
      phone: phone.trim(),
    },
  });

  try {
    await sendRegisterOtpEmail(cleanEmail, otp);
  } catch (error) {
    await authRepository.deleteRegisterOtpByEmail(cleanEmail);
    throw error;
  }

  return {
    email: cleanEmail,
  };
};

const verifyRegisterOtp = async ({ email, otp }) => {
  const cleanEmail = normalizeEmail(email);
  const verifiedOtp = await verifyOtp({
    email: cleanEmail,
    otp,
    findOtp: authRepository.findRegisterOtpByEmail,
    incrementAttempts: authRepository.incrementRegisterOtpAttempts,
    consumeOtp: authRepository.consumeRegisterOtp,
  });

  const newUser = await userService.createWithHashedPassword({
    email: cleanEmail,
    ...verifiedOtp.pendingRegistration,
    role: ROLES.CUSTOMER,
  });

  return {
    _id: newUser._id,
    email: newUser.email,
    fullName: newUser.fullName,
    phone: newUser.phone,
    role: ROLES.CUSTOMER,
    status: newUser.status,
  };
};

const requestPasswordResetOtp = async ({ email }) => {
  const cleanEmail = normalizeEmail(email);
  const user = await userService.getByEmail(cleanEmail);

  if (user) {
    const otp = generateOtp();
    await authRepository.createPasswordResetOtp({
      email: cleanEmail,
      otp,
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
      attempts: 0,
    });

    try {
      await sendPasswordResetOtpEmail(cleanEmail, otp);
    } catch (error) {
      await authRepository.deletePasswordResetOtpByEmail(cleanEmail);
      throw error;
    }
  }
};

const resetPasswordWithOtp = async ({ email, otp, newPassword }) => {
  const cleanEmail = normalizeEmail(email);
  const user = await userService.getByEmail(cleanEmail);

  if (!user) {
    throw new ApiError(400, AUTH_MESSAGES.INVALID_OR_EXPIRED_OTP);
  }

  await verifyOtp({
    email: cleanEmail,
    otp,
    findOtp: authRepository.findPasswordResetOtpByEmail,
    incrementAttempts: authRepository.incrementPasswordResetOtpAttempts,
    consumeOtp: authRepository.consumePasswordResetOtp,
  });

  const passwordHash = await hashPassword(newPassword);
  await userService.updatePasswordHash(user._id, passwordHash);
  await authRepository.deleteRefreshTokenByUserId(user._id);
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

  await updateLastLoginAt(user._id);

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
  createUser,
  changePassword,
  updateLastLoginAt,
  register,
  verifyRegisterOtp,
  requestPasswordResetOtp,
  resetPasswordWithOtp,
  login,
  refreshAccessToken,
  logout,
  revokeRefreshTokenByUserId,
};
