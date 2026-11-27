import logger from "../../configs/logger.js";

import { ORDER_STATUSES } from "../../constants/orderStatuses.js";
import {
  CUSTOMER_FACING_ORDER_STATUSES,
  DISPATCHER_ORDER_STATUSES,
  ORDER_NOTIFICATION_EVENTS,
  ORDER_STATUS_NOTIFICATION_TEMPLATES,
} from "../../constants/orderNotification.js";
import { TRIP_TYPES } from "../../constants/tripTypes.js";

import {
  getActorUserId,
  getReferenceIdString,
} from "../../utils/actor.util.js";

import customerRepository from "../customer/customer.repository.js";
import dispatcherRepository from "../dispatcher/dispatcher.repository.js";
import notificationService from "../notification/notification.service.js";

const normalizeId = (value) => {
  const id = getReferenceIdString(value);
  return id ? String(id) : null;
};

const getOrderId = (order) => order?._id || order?.id || null;

const getOrderCode = (order) => order?.orderCode || "";

const getOrderCustomerId = (order) => {
  const customerRef = order?.customerId;
  return customerRef?._id || customerRef || null;
};

const getTripId = (order) => {
  const tripRef = order?.tripId;
  return tripRef?._id || tripRef || null;
};

const getResponsibleWarehouseId = (order) => {
  if (!order) return null;

  const tripRef = order.tripId;
  const tripWarehouseId =
    tripRef?.warehouseId?._id || tripRef?.warehouseId || null;
  const tripDriverWarehouseId =
    tripRef?.driverId?.warehouseId?._id ||
    tripRef?.driverId?.warehouseId ||
    null;

  return (
    order.warehouseId?._id ||
    order.warehouseId ||
    tripWarehouseId ||
    tripDriverWarehouseId ||
    null
  );
};

const buildEventKey = ({ orderId, event, newStatus, eventKey }) => {
  const suffix = eventKey ? `:${eventKey}` : "";

  if (event === ORDER_NOTIFICATION_EVENTS.PICKUP_FAILED) {
    return `order:${orderId}:pickup_failed${suffix}`;
  }

  if (newStatus === ORDER_STATUSES.FAILED) {
    return `order:${orderId}:failure${suffix}`;
  }

  return `order:${orderId}:status:${event || newStatus}${suffix}`;
};

const shouldNotifyStatus = ({ oldStatus, newStatus, event }) => {
  if (newStatus === ORDER_STATUSES.DELIVERED && !event) {
    return false;
  }

  if (event === ORDER_NOTIFICATION_EVENTS.PICKUP_FAILED) {
    return true;
  }

  if (!CUSTOMER_FACING_ORDER_STATUSES.has(newStatus)) {
    return false;
  }

  if (newStatus === ORDER_STATUSES.FAILED) {
    return true;
  }

  return oldStatus !== newStatus;
};

const getCustomerUserIdMap = async (orders = []) => {
  const userIdMap = new Map();
  const customerIdsToLoad = new Set();

  for (const order of orders) {
    const customerRef = order?.customerId;
    if (!customerRef) continue;

    const populatedUserId = normalizeId(customerRef.userId);
    if (populatedUserId) {
      userIdMap.set(String(customerRef._id || customerRef), populatedUserId);
      continue;
    }

    const customerId = customerRef?._id || customerRef;
    if (customerId) {
      customerIdsToLoad.add(String(customerId));
    }
  }

  if (customerIdsToLoad.size === 0) {
    return userIdMap;
  }

  try {
    const customers = await customerRepository.findByIds([
      ...customerIdsToLoad,
    ]);

    for (const customer of customers) {
      const userId = normalizeId(customer.userId);
      if (userId) {
        userIdMap.set(String(customer._id), userId);
      }
    }
  } catch (error) {
    logger.error("Failed to resolve customers for order notifications", {
      error: error.message,
    });
  }

  return userIdMap;
};

const getDispatcherUserIdsByWarehouse = async (
  warehouseIds = [],
  actorUserId = null,
) => {
  const uniqueWarehouseIds = [
    ...new Set(warehouseIds.map((id) => String(id)).filter(Boolean)),
  ];
  const result = new Map();

  await Promise.all(
    uniqueWarehouseIds.map(async (warehouseId) => {
      try {
        const dispatchers =
          await dispatcherRepository.findActiveByWarehouseId(warehouseId);

        const userIds = [
          ...new Set(
            (dispatchers || [])
              .map((dispatcher) => normalizeId(dispatcher.userId))
              .filter((userId) => userId && userId !== actorUserId),
          ),
        ];

        result.set(warehouseId, userIds);
      } catch (error) {
        logger.error("Failed to resolve dispatchers for order notification", {
          warehouseId,
          error: error.message,
        });
        result.set(warehouseId, []);
      }
    }),
  );

  return result;
};

const buildStatusNotification = ({
  order,
  userId,
  oldStatus,
  newStatus,
  event,
  notes,
  eventKey,
  attempt,
}) => {
  const template = ORDER_STATUS_NOTIFICATION_TEMPLATES[event || newStatus];
  if (!template) return null;

  const orderId = getOrderId(order);
  if (!orderId) return null;

  return {
    userId,
    title: template.title,
    message: template.message(order, { notes }),
    type: "ORDER_UPDATE",
    data: {
      orderId,
      orderCode: getOrderCode(order),
      status: newStatus,
      previousStatus: oldStatus,
      tripId: getTripId(order),
      event: event || null,
      eventKey,
      ...(Number.isFinite(attempt) ? { attempt } : {}),
    },
  };
};

const buildStatusNotifications = async ({
  changes = [],
  actor = null,
  notes = "",
  summaryTrip = null,
} = {}) => {
  const validChanges = (changes || []).filter((change) => change?.order);
  if (validChanges.length === 0) return [];

  const actorUserId = normalizeId(getActorUserId(actor));
  const customerUserIdMap = await getCustomerUserIdMap(
    validChanges.map((change) => change.order),
  );

  const notifications = [];
  const dispatcherWarehouseIds = [];

  for (const change of validChanges) {
    const {
      order,
      oldStatus,
      newStatus,
      event = null,
      notes: changeNotes = notes,
      eventKey = null,
      attempt = null,
    } = change;

    if (!shouldNotifyStatus({ oldStatus, newStatus, event })) {
      continue;
    }

    const customerId = getOrderCustomerId(order);
    const customerUserId = customerId
      ? customerUserIdMap.get(String(customerId))
      : null;

    if (customerUserId) {
      const notification = buildStatusNotification({
        order,
        userId: customerUserId,
        oldStatus,
        newStatus,
        event,
        notes: changeNotes,
        eventKey:
          eventKey ||
          buildEventKey({
            orderId: getOrderId(order),
            event,
            newStatus,
            eventKey: null,
          }),
        attempt,
      });

      if (notification) {
        notifications.push(notification);
      }
    }

    if (
      !summaryTrip &&
      (DISPATCHER_ORDER_STATUSES.has(newStatus) ||
        event === ORDER_NOTIFICATION_EVENTS.PICKUP_FAILED)
    ) {
      const warehouseId = getResponsibleWarehouseId(order);
      if (warehouseId) {
        dispatcherWarehouseIds.push(warehouseId);
      }
    }
  }

  if (!summaryTrip && dispatcherWarehouseIds.length > 0) {
    const dispatcherUserIdsByWarehouse = await getDispatcherUserIdsByWarehouse(
      dispatcherWarehouseIds,
      actorUserId,
    );

    for (const change of validChanges) {
      const {
        order,
        oldStatus,
        newStatus,
        event = null,
        notes: changeNotes = notes,
        eventKey = null,
        attempt = null,
      } = change;

      if (
        !shouldNotifyStatus({ oldStatus, newStatus, event }) ||
        (!DISPATCHER_ORDER_STATUSES.has(newStatus) &&
          event !== ORDER_NOTIFICATION_EVENTS.PICKUP_FAILED)
      ) {
        continue;
      }

      const warehouseId = getResponsibleWarehouseId(order);
      if (!warehouseId) continue;

      const dispatcherUserIds =
        dispatcherUserIdsByWarehouse.get(String(warehouseId)) || [];

      for (const dispatcherUserId of dispatcherUserIds) {
        const notification = buildStatusNotification({
          order,
          userId: dispatcherUserId,
          oldStatus,
          newStatus,
          event,
          notes: changeNotes,
          eventKey:
            eventKey ||
            buildEventKey({
              orderId: getOrderId(order),
              event,
              newStatus,
              eventKey: null,
            }),
          attempt,
        });

        if (notification) {
          notifications.push(notification);
        }
      }
    }
  }

  if (summaryTrip && summaryTrip.type !== TRIP_TYPES.PICKUP) {
    const summaryNotifications = await buildTripFailureSummaryNotifications({
      changes: validChanges,
      trip: summaryTrip,
      actorUserId,
    });
    notifications.push(...summaryNotifications);
  }

  return notifications;
};

const buildTripFailureSummaryNotifications = async ({
  changes = [],
  trip,
  actorUserId,
}) => {
  const problematicChanges = changes.filter(
    (change) =>
      change.oldStatus === ORDER_STATUSES.FAILED ||
      change.oldStatus === ORDER_STATUSES.RETURNED ||
      change.newStatus === ORDER_STATUSES.FAILED ||
      change.newStatus === ORDER_STATUSES.RETURNED,
  );

  if (problematicChanges.length === 0) return [];

  const changesByWarehouse = new Map();

  for (const change of problematicChanges) {
    const warehouseId = getResponsibleWarehouseId(change.order);
    if (!warehouseId) continue;

    const key = String(warehouseId);
    if (!changesByWarehouse.has(key)) {
      changesByWarehouse.set(key, {
        warehouseId,
        failedCount: 0,
        returnedCount: 0,
        orderCodes: [],
      });
    }

    const group = changesByWarehouse.get(key);
    if (
      change.oldStatus === ORDER_STATUSES.RETURNED ||
      change.newStatus === ORDER_STATUSES.RETURNED
    ) {
      group.returnedCount += 1;
    } else {
      group.failedCount += 1;
    }

    if (change.order?.orderCode) {
      group.orderCodes.push(change.order.orderCode);
    }
  }

  if (changesByWarehouse.size === 0) return [];

  const dispatcherUserIdsByWarehouse = await getDispatcherUserIdsByWarehouse(
    [...changesByWarehouse.values()].map((group) => group.warehouseId),
    actorUserId,
  );

  const notifications = [];
  const tripId = trip?._id || trip?.id || null;
  const tripCode = trip?.tripCode || "";

  for (const [warehouseKey, group] of changesByWarehouse.entries()) {
    const dispatcherUserIds =
      dispatcherUserIdsByWarehouse.get(warehouseKey) || [];
    if (dispatcherUserIds.length === 0) continue;

    const orderCodes = [...new Set(group.orderCodes)];
    const title = "Tổng hợp đơn lỗi chuyến xe";
    const message =
      `Chuyến ${tripCode || tripId} hoàn tất: ` +
      `${group.failedCount} đơn giao thất bại, ` +
      `${group.returnedCount} đơn chuyển hoàn.` +
      (orderCodes.length > 0 ? ` Đơn lỗi: ${orderCodes.join(", ")}` : "");

    for (const dispatcherUserId of dispatcherUserIds) {
      notifications.push({
        userId: dispatcherUserId,
        title,
        message,
        type: "ORDER_UPDATE",
        data: {
          tripId,
          tripCode,
          event: ORDER_NOTIFICATION_EVENTS.TRIP_ORDER_FAILURES,
          eventKey: `trip:${tripId}:failures:${warehouseKey}`,
          failedCount: group.failedCount,
          returnedCount: group.returnedCount,
          orderCodes,
        },
      });
    }
  }

  return notifications;
};

const sendNotifications = async (notifications = []) => {
  if (notifications.length === 0) return [];

  try {
    await notificationService.createMany(notifications);
    return notifications;
  } catch (error) {
    logger.error("Failed to create order notifications", {
      error: error.message,
      notificationCount: notifications.length,
    });
    return [];
  }
};

const notifyOrderStatusChanged = async (
  order,
  oldStatus,
  newStatus,
  actor = null,
  options = {},
) => {
  if (!order) return [];

  const notifications = await buildStatusNotifications({
    changes: [
      {
        order,
        oldStatus,
        newStatus,
        event: options.event || null,
        notes: options.notes || "",
        eventKey: options.eventKey || null,
        attempt: options.attempt ?? null,
      },
    ],
    actor,
    notes: options.notes || "",
    summaryTrip: options.summaryTrip || null,
  });

  return sendNotifications(notifications);
};

const notifyOrderStatusChangedBatch = async ({
  changes = [],
  actor = null,
  notes = "",
  summaryTrip = null,
} = {}) => {
  const notifications = await buildStatusNotifications({
    changes,
    actor,
    notes,
    summaryTrip,
  });

  return sendNotifications(notifications);
};

const notifyWarehouseHandoff = async ({
  order,
  fromWarehouseId,
  toWarehouseId,
  receiptId = null,
  actor = null,
}) => {
  if (!order || !fromWarehouseId || !toWarehouseId) return [];

  const fromId = normalizeId(fromWarehouseId);
  const toId = normalizeId(toWarehouseId);

  if (!fromId || !toId || fromId === toId) {
    return [];
  }

  try {
    const dispatchers =
      await dispatcherRepository.findActiveByWarehouseId(fromId);
    const actorUserId = normalizeId(getActorUserId(actor));
    const dispatcherUserIds = [
      ...new Set(
        (dispatchers || [])
          .map((dispatcher) => normalizeId(dispatcher.userId))
          .filter((userId) => userId && userId !== actorUserId),
      ),
    ];

    if (dispatcherUserIds.length === 0) return [];

    const orderId = getOrderId(order);
    const orderCode = getOrderCode(order);
    const notifications = dispatcherUserIds.map((userId) => ({
      userId,
      title: "Đơn hàng đã được bàn giao",
      message:
        `Đơn hàng #${orderCode} đã được kho đích nhập thành công. ` +
        "Kho cũ không còn trách nhiệm với đơn hàng này.",
      type: "ORDER_UPDATE",
      data: {
        orderId,
        orderCode,
        receiptId,
        fromWarehouseId: fromId,
        toWarehouseId: toId,
        event: ORDER_NOTIFICATION_EVENTS.WAREHOUSE_HANDOFF,
        eventKey: `order:${orderId}:warehouse_handoff:${receiptId || toId}`,
      },
    }));

    return sendNotifications(notifications);
  } catch (error) {
    logger.error("Failed to create warehouse handoff notifications", {
      orderId: getOrderId(order),
      error: error.message,
    });
    return [];
  }
};

export default {
  notifyOrderStatusChanged,
  notifyOrderStatusChangedBatch,
  notifyWarehouseHandoff,
};
