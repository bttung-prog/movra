import logger from "../../configs/logger.js";

import {
  COD_SETTLEMENT_NOTIFICATION_EVENTS,
  COD_SETTLEMENT_NOTIFICATION_TEMPLATES,
} from "../../constants/codSettlementNotification.js";

import { getReferenceIdString } from "../../utils/actor.util.js";

import notificationService from "../notification/notification.service.js";

const normalizeId = (value) => {
  const id = getReferenceIdString(value);
  return id ? String(id) : null;
};

const getSettlementId = (settlement) =>
  settlement?._id || settlement?.id || null;

const getOrderId = (settlement) => {
  const order = settlement?.orderId;
  return order?._id || order || null;
};

const getCustomerUserId = (settlement) =>
  normalizeId(settlement?.customerId?.userId);

const buildSettlementNotification = ({ settlement, event, notes = "" }) => {
  const userId = getCustomerUserId(settlement);
  if (!userId) return null;

  const template = COD_SETTLEMENT_NOTIFICATION_TEMPLATES[event];
  if (!template) return null;

  const settlementId = getSettlementId(settlement);
  if (!settlementId) return null;

  return {
    userId,
    title: template.title,
    message: template.message({ settlement, notes }),
    type: "COD",
    data: {
      settlementId,
      settlementCode: settlement.settlementCode || "",
      orderId: getOrderId(settlement),
      netPayoutAmount: Number(settlement.netPayoutAmount || 0),
      payoutMethod: settlement.payoutMethod || null,
      status: settlement.status || null,
      bankName: settlement.bankDetails?.bankName || null,
      bankTransferReference: settlement.bankTransferReference || null,
      notes,
      event,
      eventKey: `cod-settlement:${settlementId}:${event}`,
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
    logger.error("Failed to create COD settlement notifications", {
      error: error.message,
      notificationCount: validNotifications.length,
    });
    return [];
  }
};

const notifySettlementConfirmed = async ({ settlement, notes = "" }) => {
  return sendNotifications([
    buildSettlementNotification({
      settlement,
      event: COD_SETTLEMENT_NOTIFICATION_EVENTS.CONFIRMED,
      notes,
    }),
  ]);
};

const notifySettlementCompleted = async ({ settlement, notes = "" }) => {
  return sendNotifications([
    buildSettlementNotification({
      settlement,
      event: COD_SETTLEMENT_NOTIFICATION_EVENTS.COMPLETED,
      notes,
    }),
  ]);
};

const notifySettlementCancelled = async ({ settlement, notes = "" }) => {
  return sendNotifications([
    buildSettlementNotification({
      settlement,
      event: COD_SETTLEMENT_NOTIFICATION_EVENTS.CANCELLED,
      notes,
    }),
  ]);
};

export default {
  notifySettlementConfirmed,
  notifySettlementCompleted,
  notifySettlementCancelled,
};
