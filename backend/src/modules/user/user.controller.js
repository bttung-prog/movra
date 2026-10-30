import { USER_MESSAGES } from "../../constants/messages.js";

import ApiResponse from "../../utils/ApiResponse.js";

import userService from "./user.service.js";

const getMe = async (req, res, next) => {
  try {
    const user = await userService.getMe(req.user.userId);

    return ApiResponse.success(res, user, USER_MESSAGES.GET_PROFILE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const updateMe = async (req, res, next) => {
  try {
    const user = await userService.updateMe(req.user.userId, req.body);

    return ApiResponse.success(res, user, USER_MESSAGES.UPDATE_PROFILE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

export default {
  getMe,
  updateMe,
};
