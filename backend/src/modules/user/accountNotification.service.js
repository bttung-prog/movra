import logger from "../../configs/logger.js";

import {
  ACCOUNT_NOTIFICATION_EVENTS,
  ACCOUNT_NOTIFICATION_TEMPLATES,
} from "../../constants/accountNotification.js";

import { getReferenceIdString } from "../../utils/actor.util.js";

import notificationService from "../notification/notification.service.js";

const notifyRoleChanged = async ({ user, userId, previousRole, role }) => {
  const targetUserId = getReferenceIdString(userId || user?._id || user);
  if (!targetUserId || !role || previousRole === role) return 0;

  const event = ACCOUNT_NOTIFICATION_EVENTS.ACCOUNT_ROLE_CHANGED;
  const template = ACCOUNT_NOTIFICATION_TEMPLATES[event];
  const eventKey = `account:${targetUserId}:role_changed:${previousRole || "none"}:${role}`;

  try {
    const created = await notificationService.createMany([
      {
        userId: targetUserId,
        title: template.title,
        message: template.message({ previousRole, role }),
        type: "ACCOUNT",
        data: {
          event,
          eventKey,
          previousRole: previousRole || null,
          role,
        },
      },
    ]);
    return created?.length || 0;
  } catch (error) {
    logger.error("Failed to create account role notification", {
      userId: targetUserId,
      error: error.message,
    });
    return 0;
  }
};

export default { notifyRoleChanged };
