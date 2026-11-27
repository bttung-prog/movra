import logger from "../../configs/logger.js";

import {
  FEEDBACK_NOTIFICATION_EVENTS,
  FEEDBACK_NOTIFICATION_TEMPLATES,
} from "../../constants/feedbackNotification.js";
import { ROLES } from "../../constants/roles.js";

import {
  getActorUserId,
  getReferenceIdString,
} from "../../utils/actor.util.js";

import dispatcherService from "../dispatcher/dispatcher.service.js";
import notificationService from "../notification/notification.service.js";
import userRepository from "../user/user.repository.js";

const LOW_RATING_THRESHOLD = 2;

const normalizeId = (value) => {
  const id = getReferenceIdString(value);
  return id ? String(id) : null;
};

const getFeedbackId = (feedback) => feedback?._id || feedback?.id || null;

const getOrderId = (feedback) => {
  const order = feedback?.orderId;
  return order?._id || order || null;
};

const getOrderCode = (feedback) => feedback?.orderId?.orderCode || "";

const getDriverUserId = (feedback) => normalizeId(feedback?.driverId?.userId);

const getCustomerUserId = (feedback) =>
  normalizeId(feedback?.customerId?.userId);

const getWarehouseId = (feedback) => {
  const warehouse = feedback?.warehouseId;
  return warehouse?._id || warehouse || null;
};

const getDispatcherUserIds = async (warehouseId, actorUserId) => {
  if (!warehouseId) return [];

  try {
    const dispatchers =
      await dispatcherService.getActiveByWarehouseId(warehouseId);
    return [
      ...new Set(
        (dispatchers || [])
          .map((dispatcher) => normalizeId(dispatcher.userId))
          .filter((userId) => userId && userId !== actorUserId),
      ),
    ];
  } catch (error) {
    logger.error("Failed to resolve dispatchers for feedback notification", {
      warehouseId,
      error: error.message,
    });
    return [];
  }
};

const getAdminUserIds = async (actorUserId) => {
  try {
    const userIds = await userRepository.findActiveUserIdsByRole(ROLES.ADMIN);
    return [
      ...new Set(
        (userIds || [])
          .map((userId) => normalizeId(userId))
          .filter((userId) => userId && userId !== actorUserId),
      ),
    ];
  } catch (error) {
    logger.error("Failed to resolve admins for feedback notification", {
      error: error.message,
    });
    return [];
  }
};

const buildNotification = ({ feedback, userId, event }) => {
  const template = FEEDBACK_NOTIFICATION_TEMPLATES[event];
  if (!template) return null;

  const feedbackId = getFeedbackId(feedback);
  if (!feedbackId) return null;

  return {
    userId,
    title: template.title,
    message: template.message({ feedback }),
    type: "FEEDBACK",
    data: {
      feedbackId,
      orderId: getOrderId(feedback),
      orderCode: getOrderCode(feedback),
      tripId: feedback.tripId?._id || feedback.tripId || null,
      driverId: feedback.driverId?._id || feedback.driverId || null,
      warehouseId: getWarehouseId(feedback),
      rating: Number(feedback.rating || 0),
      tags: feedback.tags || [],
      event,
      eventKey: `feedback:${feedbackId}:${event}`,
    },
  };
};

const sendNotifications = async (notifications = []) => {
  const validNotifications = notifications.filter(Boolean);
  if (validNotifications.length === 0) return [];

  try {
    await notificationService.createMany(validNotifications);
    return validNotifications;
  } catch (error) {
    logger.error("Failed to create feedback notifications", {
      error: error.message,
      notificationCount: validNotifications.length,
    });
    return [];
  }
};

const notifyFeedbackCreated = async ({ feedback, actor = null }) => {
  const actorUserId = normalizeId(getActorUserId(actor));
  const notifications = [];
  const driverUserId = getDriverUserId(feedback);

  if (driverUserId) {
    notifications.push(
      buildNotification({
        feedback,
        userId: driverUserId,
        event: FEEDBACK_NOTIFICATION_EVENTS.FEEDBACK_CREATED,
      }),
    );
  }

  const dispatcherUserIds = await getDispatcherUserIds(
    getWarehouseId(feedback),
    actorUserId,
  );
  for (const userId of dispatcherUserIds) {
    notifications.push(
      buildNotification({
        feedback,
        userId,
        event: FEEDBACK_NOTIFICATION_EVENTS.FEEDBACK_CREATED,
      }),
    );
  }

  if (Number(feedback.rating) <= LOW_RATING_THRESHOLD) {
    const adminUserIds = await getAdminUserIds(actorUserId);
    for (const userId of adminUserIds) {
      notifications.push(
        buildNotification({
          feedback,
          userId,
          event: FEEDBACK_NOTIFICATION_EVENTS.FEEDBACK_LOW_RATING,
        }),
      );
    }
  }

  return sendNotifications(notifications);
};

const notifyFeedbackReplied = async ({ feedback, actor = null }) => {
  const customerUserId = getCustomerUserId(feedback);
  if (!customerUserId) return [];

  return sendNotifications([
    buildNotification({
      feedback,
      userId: customerUserId,
      event: FEEDBACK_NOTIFICATION_EVENTS.FEEDBACK_REPLIED,
    }),
  ]);
};

export default {
  notifyFeedbackCreated,
  notifyFeedbackReplied,
};
