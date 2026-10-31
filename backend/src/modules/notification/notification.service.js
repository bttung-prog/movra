import { NOTIFICATION_MESSAGES } from "../../constants/messages.js";

import ApiError from "../../utils/ApiError.js";

import notificationRepository from "./notification.repository.js";

const create = async ({
  userId,
  title,
  message,
  type = "ORDER_UPDATE",
  data = {},
  session = null,
}) => {
  if (!userId || !title || !message) {
    return null;
  }

  return notificationRepository.create(
    {
      userId,
      title,
      message,
      type,
      data,
    },
    session,
  );
};

const getMyNotifications = async ({
  userId,
  isRead,
  page = 1,
  limit = 10,
} = {}) => {
  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const limitNumber = Math.max(1, parseInt(limit, 10) || 10);
  const skip = (pageNumber - 1) * limitNumber;

  const filter = { userId };
  if (isRead !== undefined && isRead !== null && isRead !== "") {
    filter.isRead = isRead === "true" || isRead === true;
  }

  const [notifications, total, unreadCount] = await Promise.all([
    notificationRepository.findAll({
      filter,
      skip,
      limit: limitNumber,
      sort: { createdAt: -1 },
    }),
    notificationRepository.countAll({ filter }),
    notificationRepository.countAll({ filter: { userId, isRead: false } }),
  ]);

  return {
    data: notifications,
    unreadCount,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages: Math.ceil(total / limitNumber),
    },
  };
};

const markAsRead = async ({ notificationId, userId }) => {
  const notification = await notificationRepository.findById(notificationId);
  if (!notification) {
    throw new ApiError(404, NOTIFICATION_MESSAGES.NOT_FOUND);
  }

  if (notification.userId.toString() !== userId.toString()) {
    throw new ApiError(403, NOTIFICATION_MESSAGES.ACCESS_DENIED);
  }

  return notificationRepository.markAsRead(notificationId);
};

const markAllAsRead = async ({ userId }) => {
  return notificationRepository.markAllAsRead(userId);
};

export default {
  create,
  getMyNotifications,
  markAsRead,
  markAllAsRead,
};
