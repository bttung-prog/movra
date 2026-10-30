import ROLES from "../../constants/roles.js";
import USER_STATUSES from "../../constants/userStatuses.js";
import { ADMIN_MESSAGES } from "../../constants/messages.js";

import ApiError from "../../utils/ApiError.js";
import { hashPassword } from "../../utils/password.js";

import authService from "../auth/auth.service.js";
import userService from "../user/user.service.js";

const createUser = async (data) => {
  return authService.createUser(data);
};

const getAllUsers = async ({ filter = {}, page, limit }) => {
  return userService.getAll({ filter, page, limit });
};

const getUserById = async (userId) => {
  return userService.getById(userId);
};

const searchUsers = async (keyword) => {
  return userService.search(keyword);
};

// updateData: {email, phone, fullName, role, status}
const updateUser = async (userId, updateData) => {
  if (updateData.role) {
    const validRoles = Object.values(ROLES);
    if (!validRoles.includes(updateData.role)) {
      throw new ApiError(400, ADMIN_MESSAGES.INVALID_ROLE);
    }
  }

  if (updateData.status) {
    const validStatuses = Object.values(USER_STATUSES);
    if (!validStatuses.includes(updateData.status)) {
      throw new ApiError(400, ADMIN_MESSAGES.INVALID_STATUS);
    }
  }

  return userService.updateById(userId, updateData);
};

const changeRoleUser = async (targetUserId, roleData = {}, currentAdminId) => {
  const { role, ...payload } = roleData;

  // Check if the current admin is trying to demote themselves
  if (
    currentAdminId &&
    targetUserId.toString() === currentAdminId.toString() &&
    role !== ROLES.ADMIN
  ) {
    throw new ApiError(400, ADMIN_MESSAGES.CANNOT_DEMOTE_SELF);
  }

  const validRoles = Object.values(ROLES);
  if (!validRoles.includes(role)) {
    throw new ApiError(400, ADMIN_MESSAGES.INVALID_ROLE);
  }

  return userService.updateRole(targetUserId, role, payload);
};

const changeStatusUser = async (targetUserId, status, currentAdminId) => {
  // Check if the current admin is trying to deactivate themselves
  if (
    currentAdminId &&
    targetUserId.toString() === currentAdminId.toString() &&
    status !== USER_STATUSES.ACTIVE
  ) {
    throw new ApiError(400, ADMIN_MESSAGES.CANNOT_DEACTIVATE_SELF);
  }

  const validStatuses = Object.values(USER_STATUSES);
  if (!validStatuses.includes(status)) {
    throw new ApiError(400, ADMIN_MESSAGES.INVALID_STATUS);
  }

  return userService.updateStatus(targetUserId, status);
};

const resetPassword = async (userId, newPassword) => {
  await userService.getById(userId);

  const passwordHash = await hashPassword(newPassword);
  const updatedUser = await userService.updatePasswordHash(
    userId,
    passwordHash,
  );

  await authService.revokeRefreshTokenByUserId(userId);
  return updatedUser;
};

export default {
  createUser,
  getAllUsers,
  getUserById,
  searchUsers,
  updateUser,
  changeRoleUser,
  changeStatusUser,
  resetPassword,
};
