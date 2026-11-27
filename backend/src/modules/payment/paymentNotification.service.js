import logger from "../../configs/logger.js";

import {
  PAYMENT_NOTIFICATION_EVENTS,
  PAYMENT_NOTIFICATION_TEMPLATES,
} from "../../constants/paymentNotification.js";
import { PAYER_TYPES } from "../../constants/paymentMethods.js";

import {
  getActorUserId,
  getReferenceIdString,
} from "../../utils/actor.util.js";

import accountantRepository from "../accountant/accountant.repository.js";
import notificationService from "../notification/notification.service.js";

const normalizeId = (value) => {
  const id = getReferenceIdString(value);
  return id ? String(id) : null;
};

const getPayerUserId = (payment) => {
  if (payment?.payerType === PAYER_TYPES.DRIVER) {
    return normalizeId(payment.driverId?.userId);
  }

  return normalizeId(payment?.customerId?.userId);
};

const getAccountantUserIds = async (actorUserId = null) => {
  try {
    const userIds = await accountantRepository.findActiveUserIds();
    return [
      ...new Set(
        (userIds || [])
          .map((userId) => normalizeId(userId))
          .filter((userId) => userId && userId !== actorUserId),
      ),
    ];
  } catch (error) {
    logger.error("Failed to resolve accountants for payment notification", {
      error: error.message,
    });
    return [];
  }
};

const getPaymentId = (payment) => payment?._id || payment?.id || null;

const getPaymentRefId = (value) => {
  if (value === null || value === undefined) return null;
  return value?._id || value;
};

const buildPaymentNotification = ({
  payment,
  userId,
  event,
  notes = "",
  refundAmount = null,
}) => {
  const template = PAYMENT_NOTIFICATION_TEMPLATES[event];
  if (!template) return null;

  const paymentId = getPaymentId(payment);
  if (!paymentId) return null;

  const isRemittanceEvent =
    event === PAYMENT_NOTIFICATION_EVENTS.DRIVER_REMITTANCE_CREATED ||
    event === PAYMENT_NOTIFICATION_EVENTS.DRIVER_REMITTANCE_VERIFIED ||
    event === PAYMENT_NOTIFICATION_EVENTS.DRIVER_REMITTANCE_REJECTED;

  return {
    userId,
    title: template.title,
    message: template.message({ payment, notes, refundAmount }),
    type: "PAYMENT",
    data: {
      paymentId,
      paymentCode: payment.paymentCode || "",
      purpose: payment.purpose || null,
      payerType: payment.payerType || null,
      amount: Number(payment.paymentAmount || 0),
      status: payment.paymentStatus || null,
      notes,
      invoiceId: getPaymentRefId(payment.invoiceId),
      orderId: getPaymentRefId(payment.orderId),
      tripId: getPaymentRefId(payment.tripId),
      remittanceId: isRemittanceEvent ? paymentId : null,
      refundAmount:
        refundAmount === null || refundAmount === undefined
          ? null
          : Number(refundAmount),
      event,
      eventKey: `payment:${paymentId}:${event}`,
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
    logger.error("Failed to create payment notifications", {
      error: error.message,
      notificationCount: validNotifications.length,
    });
    return [];
  }
};

const notifyPaymentPending = async ({
  payment,
  actor = null,
  includeAccountants = false,
}) => {
  const actorUserId = normalizeId(getActorUserId(actor));
  const payerUserId = getPayerUserId(payment);
  const notifications = [];

  if (payerUserId) {
    notifications.push(
      buildPaymentNotification({
        payment,
        userId: payerUserId,
        event: PAYMENT_NOTIFICATION_EVENTS.PAYMENT_PENDING,
        notes: payment?.notes || "",
      }),
    );
  }

  if (includeAccountants) {
    const accountantUserIds = await getAccountantUserIds(actorUserId);
    for (const userId of accountantUserIds) {
      notifications.push(
        buildPaymentNotification({
          payment,
          userId,
          event: PAYMENT_NOTIFICATION_EVENTS.PAYMENT_PENDING,
          notes: payment?.notes || "",
        }),
      );
    }
  }

  return sendNotifications(notifications);
};

const notifyPaymentCompleted = async ({ payment }) => {
  const payerUserId = getPayerUserId(payment);
  if (!payerUserId) return [];

  return sendNotifications([
    buildPaymentNotification({
      payment,
      userId: payerUserId,
      event: PAYMENT_NOTIFICATION_EVENTS.PAYMENT_COMPLETED,
    }),
  ]);
};

const notifyPaymentVerified = async ({ payment, notes = "" }) => {
  const payerUserId = getPayerUserId(payment);
  if (!payerUserId) return [];

  const event =
    payment?.payerType === PAYER_TYPES.DRIVER
      ? PAYMENT_NOTIFICATION_EVENTS.DRIVER_REMITTANCE_VERIFIED
      : PAYMENT_NOTIFICATION_EVENTS.PAYMENT_VERIFIED;

  return sendNotifications([
    buildPaymentNotification({
      payment,
      userId: payerUserId,
      event,
      notes,
    }),
  ]);
};

const notifyPaymentRejected = async ({ payment, notes = "" }) => {
  const payerUserId = getPayerUserId(payment);
  if (!payerUserId) return [];

  const event =
    payment?.payerType === PAYER_TYPES.DRIVER
      ? PAYMENT_NOTIFICATION_EVENTS.DRIVER_REMITTANCE_REJECTED
      : PAYMENT_NOTIFICATION_EVENTS.PAYMENT_REJECTED;

  return sendNotifications([
    buildPaymentNotification({
      payment,
      userId: payerUserId,
      event,
      notes,
    }),
  ]);
};

const notifyRefundCompleted = async ({ payment, refundAmount, notes = "" }) => {
  const payerUserId = getPayerUserId(payment);
  if (!payerUserId) return [];

  return sendNotifications([
    buildPaymentNotification({
      payment,
      userId: payerUserId,
      event: PAYMENT_NOTIFICATION_EVENTS.REFUND_COMPLETED,
      notes,
      refundAmount,
    }),
  ]);
};

const notifyDriverRemittanceCreated = async ({ payment, actor = null }) => {
  const actorUserId = normalizeId(getActorUserId(actor));
  const accountantUserIds = await getAccountantUserIds(actorUserId);
  const notifications = accountantUserIds.map((userId) =>
    buildPaymentNotification({
      payment,
      userId,
      event: PAYMENT_NOTIFICATION_EVENTS.DRIVER_REMITTANCE_CREATED,
    }),
  );

  return sendNotifications(notifications);
};

export default {
  notifyPaymentPending,
  notifyPaymentCompleted,
  notifyPaymentVerified,
  notifyPaymentRejected,
  notifyRefundCompleted,
  notifyDriverRemittanceCreated,
};
