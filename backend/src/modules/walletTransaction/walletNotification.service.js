import logger from "../../configs/logger.js";

import {
  WALLET_NOTIFICATION_EVENTS,
  WALLET_NOTIFICATION_TEMPLATES,
} from "../../constants/walletNotification.js";

import {
  getActorUserIdString,
  getReferenceIdString,
} from "../../utils/actor.util.js";

import accountantRepository from "../accountant/accountant.repository.js";
import notificationService from "../notification/notification.service.js";

const normalizeId = (value) => getReferenceIdString(value);

const getPaymentId = (payment) => normalizeId(payment?._id || payment);

const getWalletTransactionId = (walletTransaction) =>
  normalizeId(walletTransaction?._id || walletTransaction);

const getCustomerUserId = ({ customer, payment }) =>
  normalizeId(customer?.userId) || normalizeId(payment?.customerId?.userId);

const getDedupeSuffix = (event) => {
  const suffixes = {
    [WALLET_NOTIFICATION_EVENTS.WALLET_TOPUP_PENDING]: "topup_pending",
    [WALLET_NOTIFICATION_EVENTS.WALLET_TOPUP_COMPLETED]: "topup_completed",
    [WALLET_NOTIFICATION_EVENTS.WALLET_TOPUP_REJECTED]: "topup_rejected",
  };

  return suffixes[event] || event.toLowerCase();
};

const buildDedupeKey = ({ event, payment, walletTransaction }) => {
  if (
    event === WALLET_NOTIFICATION_EVENTS.WALLET_ADJUSTED ||
    event === WALLET_NOTIFICATION_EVENTS.WALLET_TOPUP_REFUNDED
  ) {
    const walletTransactionId = getWalletTransactionId(walletTransaction);
    if (!walletTransactionId) return null;

    const suffix =
      event === WALLET_NOTIFICATION_EVENTS.WALLET_ADJUSTED
        ? "adjustment"
        : "topup_refunded";
    return `wallet:transaction:${walletTransactionId}:${suffix}`;
  }

  const paymentId = getPaymentId(payment);
  if (!paymentId) return null;
  return `wallet:payment:${paymentId}:${getDedupeSuffix(event)}`;
};

const buildNotification = ({
  userId,
  event,
  payment = null,
  walletTransaction = null,
  amount = null,
  direction = null,
  balanceBefore = null,
  balanceAfter = null,
  notes = "",
}) => {
  if (!userId) return null;

  const template = WALLET_NOTIFICATION_TEMPLATES[event];
  if (!template) return null;

  const dedupeKey = buildDedupeKey({ event, payment, walletTransaction });
  const walletTransactionId = getWalletTransactionId(walletTransaction);

  return {
    userId,
    title: template.title,
    message: template.message({
      payment,
      walletTransaction,
      amount: Number(amount ?? payment?.paymentAmount ?? 0),
      direction,
      balanceBefore,
      balanceAfter,
      notes,
    }),
    type: "PAYMENT",
    dedupeKey,
    data: {
      event,
      eventKey: dedupeKey,
      paymentId: getPaymentId(payment),
      paymentCode: payment?.paymentCode || "",
      walletTransactionId,
      transactionCode:
        walletTransaction?.transactionCode || payment?.paymentCode || "",
      purpose: payment?.purpose || null,
      amount: Number(amount ?? payment?.paymentAmount ?? 0),
      direction: direction || walletTransaction?.direction || null,
      balanceBefore:
        balanceBefore === null || balanceBefore === undefined
          ? null
          : Number(balanceBefore),
      balanceAfter:
        balanceAfter === null || balanceAfter === undefined
          ? null
          : Number(balanceAfter),
      status: payment?.paymentStatus || walletTransaction?.status || null,
      notes,
    },
  };
};

const sendNotifications = async (notifications = []) => {
  const validNotifications = notifications.filter(Boolean);
  if (validNotifications.length === 0) return 0;

  try {
    const created = await notificationService.createMany(validNotifications);
    return created?.length || 0;
  } catch (error) {
    logger.error("Failed to create wallet notifications", {
      error: error.message,
      notificationCount: validNotifications.length,
    });
    return 0;
  }
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
    logger.error("Failed to resolve accountants for wallet notification", {
      error: error.message,
    });
    return [];
  }
};

const notifyTopUpPending = async ({
  payment,
  customer = null,
  actor = null,
}) => {
  const actorUserId = getActorUserIdString(actor);
  const recipientIds = new Set();
  const customerUserId = getCustomerUserId({ customer, payment });

  if (customerUserId) {
    recipientIds.add(customerUserId);
  }

  for (const userId of await getAccountantUserIds(actorUserId)) {
    recipientIds.add(userId);
  }

  return sendNotifications(
    [...recipientIds].map((userId) =>
      buildNotification({
        userId,
        event: WALLET_NOTIFICATION_EVENTS.WALLET_TOPUP_PENDING,
        payment,
      }),
    ),
  );
};

const notifyTopUpCompleted = async ({
  payment,
  customer = null,
  walletTransaction = null,
  balanceBefore = null,
  balanceAfter = null,
}) => {
  const userId = getCustomerUserId({ customer, payment });
  return sendNotifications([
    buildNotification({
      userId,
      event: WALLET_NOTIFICATION_EVENTS.WALLET_TOPUP_COMPLETED,
      payment,
      walletTransaction,
      balanceBefore,
      balanceAfter,
    }),
  ]);
};

const notifyTopUpRejected = async ({
  payment,
  customer = null,
  notes = "",
}) => {
  const userId = getCustomerUserId({ customer, payment });
  return sendNotifications([
    buildNotification({
      userId,
      event: WALLET_NOTIFICATION_EVENTS.WALLET_TOPUP_REJECTED,
      payment,
      notes,
    }),
  ]);
};

const notifyWalletAdjusted = async ({
  customer,
  walletTransaction,
  direction,
  amount,
  balanceBefore = null,
  balanceAfter = null,
}) => {
  const userId = getCustomerUserId({ customer });
  return sendNotifications([
    buildNotification({
      userId,
      event: WALLET_NOTIFICATION_EVENTS.WALLET_ADJUSTED,
      walletTransaction,
      direction,
      amount,
      balanceBefore,
      balanceAfter,
    }),
  ]);
};

const notifyTopUpRefunded = async ({
  payment,
  customer = null,
  walletTransaction = null,
  amount,
  balanceBefore = null,
  balanceAfter = null,
  notes = "",
}) => {
  const userId = getCustomerUserId({ customer, payment });
  return sendNotifications([
    buildNotification({
      userId,
      event: WALLET_NOTIFICATION_EVENTS.WALLET_TOPUP_REFUNDED,
      payment,
      walletTransaction,
      amount,
      direction: "debit",
      balanceBefore,
      balanceAfter,
      notes,
    }),
  ]);
};

export default {
  notifyTopUpPending,
  notifyTopUpCompleted,
  notifyTopUpRejected,
  notifyWalletAdjusted,
  notifyTopUpRefunded,
};
