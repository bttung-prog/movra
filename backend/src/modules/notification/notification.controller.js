import { NOTIFICATION_MESSAGES } from "../../constants/messages.js";

import ApiResponse from "../../utils/ApiResponse.js";

import notificationService from "./notification.service.js";

const getMyNotifications = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { isRead, page, limit } = req.query;

    const result = await notificationService.getMyNotifications({
      userId,
      isRead,
      page,
      limit,
    });

    return ApiResponse.success(
      res,
      result,
      NOTIFICATION_MESSAGES.GET_MY_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const markAsRead = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const notificationId = req.params.id;

    const result = await notificationService.markAsRead({
      notificationId,
      userId,
    });

    return ApiResponse.success(
      res,
      result,
      NOTIFICATION_MESSAGES.MARK_AS_READ_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    await notificationService.markAllAsRead({ userId });

    return ApiResponse.success(
      res,
      null,
      NOTIFICATION_MESSAGES.MARK_ALL_AS_READ_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

export default {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
};
