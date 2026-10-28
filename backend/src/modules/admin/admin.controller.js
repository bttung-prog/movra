import { ADMIN_MESSAGES } from "../../constants/messages.js";

import ApiResponse from "../../utils/ApiResponse.js";

import adminService from "./admin.service.js";

const createUser = async (req, res, next) => {
  try {
    const user = await adminService.createUser(req.body);

    return ApiResponse.created(res, user, ADMIN_MESSAGES.CREATE_USER_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getAllUsers = async (req, res, next) => {
  try {
    const {
      keyword,
      page: reqPage,
      limit: reqLimit,
      ...filterQuery
    } = req.query;

    if (keyword) {
      const users = await adminService.searchUsers(keyword);
      return ApiResponse.success(
        res,
        {
          data: users,
          pagination: {
            page: 1,
            limit: users.length,
            totalUsers: users.length,
            totalPages: 1,
          },
        },
        ADMIN_MESSAGES.SEARCH_USERS_SUCCESS,
      );
    }

    const page = parseInt(reqPage) || 1;
    const limit = parseInt(reqLimit) || 10;

    const filter = { ...filterQuery };

    const result = await adminService.getAllUsers({ filter, page, limit });

    return ApiResponse.success(
      res,
      result,
      ADMIN_MESSAGES.GET_ALL_USERS_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getUserById = async (req, res, next) => {
  try {
    const user = await adminService.getUserById(req.params.userId);

    return ApiResponse.success(res, user, ADMIN_MESSAGES.GET_USER_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const user = await adminService.updateUser(req.params.userId, req.body);

    return ApiResponse.success(res, user, ADMIN_MESSAGES.UPDATE_USER_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const changeRoleUser = async (req, res, next) => {
  try {
    const user = await adminService.changeRoleUser(
      req.params.userId,
      req.body,
      req.user.userId,
    );

    return ApiResponse.success(res, user, ADMIN_MESSAGES.CHANGE_ROLE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const changeStatusUser = async (req, res, next) => {
  try {
    const user = await adminService.changeStatusUser(
      req.params.userId,
      req.body.status,
      req.user.userId,
    );

    return ApiResponse.success(res, user, ADMIN_MESSAGES.CHANGE_STATUS_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const user = await adminService.resetPassword(
      req.params.userId,
      req.body.newPassword,
    );

    return ApiResponse.success(
      res,
      user,
      ADMIN_MESSAGES.RESET_PASSWORD_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

export default {
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  changeRoleUser,
  changeStatusUser,
  resetPassword,
};
