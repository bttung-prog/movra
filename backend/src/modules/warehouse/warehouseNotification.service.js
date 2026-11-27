import logger from "../../configs/logger.js";

import {
  WAREHOUSE_NOTIFICATION_EVENTS,
  WAREHOUSE_NOTIFICATION_TEMPLATES,
} from "../../constants/warehouseNotification.js";

import {
  getActorUserIdString,
  getReferenceIdString,
} from "../../utils/actor.util.js";

import dispatcherRepository from "../dispatcher/dispatcher.repository.js";
import notificationService from "../notification/notification.service.js";

const normalizeId = (value) => getReferenceIdString(value);

const getRecordId = (record) => normalizeId(record?._id || record);

const getOrderRef = (order, record) => {
  const ref = order || record?.orderId;
  return ref?._id || ref || null;
};

const getOrderCode = (order, record) =>
  order?.orderCode || record?.orderId?.orderCode || "";

const getWarehouseId = (warehouse, record) =>
  normalizeId(warehouse?._id) || normalizeId(record?.warehouseId);

const getRecipientUserIds = async ({ warehouse, actor = null }) => {
  const warehouseId = normalizeId(warehouse?._id || warehouse);
  const actorUserId = getActorUserIdString(actor);
  const recipientIds = new Set();

  if (!warehouseId) return [];

  try {
    const dispatchers =
      await dispatcherRepository.findActiveByWarehouseId(warehouseId);

    for (const dispatcher of dispatchers || []) {
      const userId = normalizeId(dispatcher?.userId);
      if (userId) recipientIds.add(userId);
    }
  } catch (error) {
    logger.error("Failed to resolve warehouse dispatchers", {
      warehouseId,
      error: error.message,
    });
  }

  const managerUserId = normalizeId(warehouse?.managerId);
  if (managerUserId) {
    recipientIds.add(managerUserId);
  }

  return [...recipientIds].filter((userId) => userId !== actorUserId);
};

const buildNotification = ({
  userId,
  event,
  issue = null,
  receipt = null,
  order = null,
  warehouse = null,
  previousCondition = null,
  condition = null,
  notes = "",
}) => {
  const template = WAREHOUSE_NOTIFICATION_TEMPLATES[event];
  if (!template) return null;

  const record = issue || receipt;
  const recordId = getRecordId(record);
  if (!recordId) return null;

  const isIssue = Boolean(issue);
  const eventKey = isIssue
    ? `warehouse-issue:${recordId}:${event.toLowerCase()}`
    : event ===
        WAREHOUSE_NOTIFICATION_EVENTS.WAREHOUSE_RECEIPT_CONDITION_UPDATED
      ? `warehouse-receipt:${recordId}:condition:${previousCondition || ""}:${condition || ""}`
      : `warehouse-receipt:${recordId}:${event.toLowerCase()}`;

  return {
    userId,
    title: template.title,
    message: template.message({
      issue,
      receipt,
      order,
      warehouse,
      previousCondition,
      condition,
      notes,
    }),
    type: "WAREHOUSE",
    data: {
      event,
      eventKey,
      issueId: issue?._id || null,
      issueCode: issue?.issueCode || "",
      receiptId: receipt?._id || null,
      receiptCode: receipt?.receiptCode || "",
      orderId: getOrderRef(order, record),
      orderCode: getOrderCode(order, record),
      tripId: record?.tripId?._id || record?.tripId || null,
      warehouseId: getWarehouseId(warehouse, record),
      goodsCategoryId:
        record?.goodsCategoryId?._id || record?.goodsCategoryId || null,
      quantity: record?.quantity ?? null,
      previousCondition,
      condition: condition || record?.condition || null,
      status: record?.status || null,
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
    logger.error("Failed to create warehouse notifications", {
      error: error.message,
      notificationCount: validNotifications.length,
    });
    return 0;
  }
};

const notifyWarehouse = async ({
  event,
  issue = null,
  receipt = null,
  order = null,
  warehouse = null,
  previousCondition = null,
  condition = null,
  notes = "",
  actor = null,
}) => {
  const userIds = await getRecipientUserIds({ warehouse, actor });
  return sendNotifications(
    userIds.map((userId) =>
      buildNotification({
        userId,
        event,
        issue,
        receipt,
        order,
        warehouse,
        previousCondition,
        condition,
        notes,
      }),
    ),
  );
};

const notifyIssueCreated = ({
  issue,
  order = null,
  warehouse = null,
  actor = null,
}) =>
  notifyWarehouse({
    event: WAREHOUSE_NOTIFICATION_EVENTS.WAREHOUSE_ISSUE_CREATED,
    issue,
    order,
    warehouse,
    actor,
  });

const notifyIssueCancelled = ({
  issue,
  order = null,
  warehouse = null,
  actor = null,
}) =>
  notifyWarehouse({
    event: WAREHOUSE_NOTIFICATION_EVENTS.WAREHOUSE_ISSUE_CANCELLED,
    issue,
    order,
    warehouse,
    notes: issue?.note || "",
    actor,
  });

const notifyReceiptCreated = ({
  receipt,
  order = null,
  warehouse = null,
  actor = null,
}) =>
  notifyWarehouse({
    event: WAREHOUSE_NOTIFICATION_EVENTS.WAREHOUSE_RECEIPT_CREATED,
    receipt,
    order,
    warehouse,
    actor,
  });

const notifyReceiptCancelled = ({
  receipt,
  order = null,
  warehouse = null,
  actor = null,
}) =>
  notifyWarehouse({
    event: WAREHOUSE_NOTIFICATION_EVENTS.WAREHOUSE_RECEIPT_CANCELLED,
    receipt,
    order,
    warehouse,
    notes: receipt?.note || "",
    actor,
  });

const notifyReceiptConditionUpdated = ({
  receipt,
  order = null,
  warehouse = null,
  previousCondition,
  condition,
  notes = "",
  actor = null,
}) =>
  notifyWarehouse({
    event: WAREHOUSE_NOTIFICATION_EVENTS.WAREHOUSE_RECEIPT_CONDITION_UPDATED,
    receipt,
    order,
    warehouse,
    previousCondition,
    condition,
    notes,
    actor,
  });

export default {
  notifyIssueCreated,
  notifyIssueCancelled,
  notifyReceiptCreated,
  notifyReceiptCancelled,
  notifyReceiptConditionUpdated,
};
