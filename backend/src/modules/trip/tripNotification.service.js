import logger from "../../configs/logger.js";

import {
  TRIP_NOTIFICATION_EVENTS,
  TRIP_NOTIFICATION_TEMPLATES,
} from "../../constants/tripNotification.js";

import {
  getActorUserId,
  getReferenceIdString,
} from "../../utils/actor.util.js";

import notificationService from "../notification/notification.service.js";

const normalizeId = (value) => {
  const id = getReferenceIdString(value);
  return id ? String(id) : null;
};

const getDriverId = (driver) => {
  const id = driver?._id || driver;
  return id ? String(id) : null;
};

const getDriverUserId = (driver) => {
  if (!driver?.userId) return null;
  return normalizeId(driver.userId);
};

const getTripId = (trip) => trip?._id || trip?.id || null;

const getVehicleId = (trip) => {
  const vehicle = trip?.vehicleId;
  return vehicle?._id || vehicle || null;
};

const buildEventKey = ({ tripId, event, driverUserId, action }) => {
  if (event === TRIP_NOTIFICATION_EVENTS.TRIP_ORDERS_UPDATED) {
    return `trip:${tripId}:orders:${action}`;
  }

  return `trip:${tripId}:${event}:${driverUserId}`;
};

const buildTripNotification = ({
  trip,
  driver,
  actorUserId,
  event,
  action,
  orderCount = 0,
  isNewDriver = false,
  vehicleChanged = false,
}) => {
  const userId = getDriverUserId(driver);
  if (!userId || userId === actorUserId) return null;

  const template = TRIP_NOTIFICATION_TEMPLATES[event];
  if (!template) return null;

  const tripId = getTripId(trip);
  if (!tripId) return null;

  return {
    userId,
    title: template.title,
    message: template.message({
      trip,
      action,
      orderCount,
      isNewDriver,
      vehicleChanged,
    }),
    type: "TRIP_UPDATE",
    data: {
      tripId,
      tripCode: trip?.tripCode || "",
      vehicleId: getVehicleId(trip),
      driverId: getDriverId(driver),
      plannedStart: trip?.plannedStart || null,
      orderCount: Number.isFinite(orderCount) ? orderCount : 0,
      action,
      event,
      eventKey: buildEventKey({
        tripId,
        event,
        driverUserId: userId,
        action,
      }),
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
    logger.error("Failed to create trip notifications", {
      error: error.message,
      notificationCount: validNotifications.length,
    });
    return [];
  }
};

const notifyTripAssigned = async ({
  trip,
  driver,
  actor = null,
  orderCount = 0,
}) => {
  const actorUserId = normalizeId(getActorUserId(actor));
  const notification = buildTripNotification({
    trip,
    driver,
    actorUserId,
    event: TRIP_NOTIFICATION_EVENTS.TRIP_ASSIGNED,
    action: "assigned",
    orderCount,
  });

  return sendNotifications([notification]);
};

const notifyTripReassigned = async ({
  trip,
  oldDriver,
  newDriver,
  actor = null,
  orderCount = 0,
  vehicleChanged = false,
}) => {
  const actorUserId = normalizeId(getActorUserId(actor));
  const oldDriverId = getDriverId(oldDriver);
  const newDriverId = getDriverId(newDriver);
  const driverChanged = oldDriverId !== newDriverId;

  const notifications = [];

  if (driverChanged) {
    notifications.push(
      buildTripNotification({
        trip,
        driver: oldDriver,
        actorUserId,
        event: TRIP_NOTIFICATION_EVENTS.TRIP_REASSIGNED,
        action: "removed",
        orderCount,
      }),
    );
  }

  notifications.push(
    buildTripNotification({
      trip,
      driver: newDriver,
      actorUserId,
      event: TRIP_NOTIFICATION_EVENTS.TRIP_REASSIGNED,
      action: driverChanged ? "assigned" : "vehicle_changed",
      orderCount,
      isNewDriver: driverChanged,
      vehicleChanged,
    }),
  );

  return sendNotifications(notifications);
};

const notifyTripOrdersUpdated = async ({
  trip,
  driver,
  actor = null,
  orderCount = 0,
  action,
}) => {
  const actorUserId = normalizeId(getActorUserId(actor));
  const notification = buildTripNotification({
    trip,
    driver,
    actorUserId,
    event: TRIP_NOTIFICATION_EVENTS.TRIP_ORDERS_UPDATED,
    action,
    orderCount,
  });

  return sendNotifications([notification]);
};

export default {
  notifyTripAssigned,
  notifyTripReassigned,
  notifyTripOrdersUpdated,
};
