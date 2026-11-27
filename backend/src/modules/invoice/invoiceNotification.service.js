import logger from "../../configs/logger.js";

import {
  INVOICE_NOTIFICATION_EVENTS,
  INVOICE_NOTIFICATION_TEMPLATES,
} from "../../constants/invoiceNotification.js";

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

const getInvoiceId = (invoice) => invoice?._id || invoice?.id || null;

const getInvoiceOrderIds = (invoice) =>
  (invoice?.orderIds || []).map((order) => order?._id || order).filter(Boolean);

const getCustomerUserId = (invoice) => normalizeId(invoice?.customerId?.userId);

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
    logger.error("Failed to resolve accountants for invoice notification", {
      error: error.message,
    });
    return [];
  }
};

const buildInvoiceNotification = ({
  invoice,
  userId,
  event,
  notes = "",
  paymentId = null,
}) => {
  const template = INVOICE_NOTIFICATION_TEMPLATES[event];
  if (!template) return null;

  const invoiceId = getInvoiceId(invoice);
  if (!invoiceId) return null;

  return {
    userId,
    title: template.title,
    message: template.message({ invoice, notes }),
    type: "INVOICE",
    data: {
      invoiceId,
      invoiceCode: invoice.invoiceCode || "",
      orderIds: getInvoiceOrderIds(invoice),
      status: invoice.status || null,
      totalAmount: Number(invoice.totalAmount || 0),
      paidAmount: Number(invoice.paidAmount || 0),
      remainingAmount: Number(invoice.remainingAmount || 0),
      dueDate: invoice.dueDate || null,
      notes,
      paymentId,
      event,
      eventKey: `invoice:${invoiceId}:${event}:${paymentId || invoice.paidAmount || ""}`,
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
    logger.error("Failed to create invoice notifications", {
      error: error.message,
      notificationCount: validNotifications.length,
    });
    return [];
  }
};

const notifyInvoiceIssued = async ({ invoice }) => {
  const customerUserId = getCustomerUserId(invoice);
  if (!customerUserId) return [];

  return sendNotifications([
    buildInvoiceNotification({
      invoice,
      userId: customerUserId,
      event: INVOICE_NOTIFICATION_EVENTS.INVOICE_ISSUED,
    }),
  ]);
};

const notifyInvoicePartiallyPaid = async ({
  invoice,
  actor = null,
  paymentId = null,
}) => {
  const customerUserId = getCustomerUserId(invoice);
  const actorUserId = normalizeId(getActorUserId(actor));
  const notifications = [];

  if (customerUserId) {
    notifications.push(
      buildInvoiceNotification({
        invoice,
        userId: customerUserId,
        event: INVOICE_NOTIFICATION_EVENTS.INVOICE_PARTIALLY_PAID,
        paymentId,
      }),
    );
  }

  const accountantUserIds = await getAccountantUserIds(actorUserId);
  for (const userId of accountantUserIds) {
    notifications.push(
      buildInvoiceNotification({
        invoice,
        userId,
        event: INVOICE_NOTIFICATION_EVENTS.INVOICE_PARTIALLY_PAID,
        paymentId,
      }),
    );
  }

  return sendNotifications(notifications);
};

const notifyInvoicePaid = async ({
  invoice,
  actor = null,
  paymentId = null,
}) => {
  const customerUserId = getCustomerUserId(invoice);
  const actorUserId = normalizeId(getActorUserId(actor));
  const notifications = [];

  if (customerUserId) {
    notifications.push(
      buildInvoiceNotification({
        invoice,
        userId: customerUserId,
        event: INVOICE_NOTIFICATION_EVENTS.INVOICE_PAID,
        paymentId,
      }),
    );
  }

  const accountantUserIds = await getAccountantUserIds(actorUserId);
  for (const userId of accountantUserIds) {
    notifications.push(
      buildInvoiceNotification({
        invoice,
        userId,
        event: INVOICE_NOTIFICATION_EVENTS.INVOICE_PAID,
        paymentId,
      }),
    );
  }

  return sendNotifications(notifications);
};

const notifyInvoiceCancelled = async ({ invoice, notes = "" }) => {
  const customerUserId = getCustomerUserId(invoice);
  if (!customerUserId) return [];

  return sendNotifications([
    buildInvoiceNotification({
      invoice,
      userId: customerUserId,
      event: INVOICE_NOTIFICATION_EVENTS.INVOICE_CANCELLED,
      notes,
    }),
  ]);
};

export default {
  notifyInvoiceIssued,
  notifyInvoicePartiallyPaid,
  notifyInvoicePaid,
  notifyInvoiceCancelled,
};
