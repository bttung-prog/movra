import logger from "../../configs/logger.js";

import {
  VEHICLE_NOTIFICATION_EVENTS,
  VEHICLE_NOTIFICATION_TEMPLATES,
} from "../../constants/vehicleNotification.js";

import { getReferenceIdString } from "../../utils/actor.util.js";

import notificationService from "../notification/notification.service.js";

const normalizeId = (value) => getReferenceIdString(value);

const getEvent = (documentType, phase) => {
  if (documentType === "insurance") {
    return phase === "expired"
      ? VEHICLE_NOTIFICATION_EVENTS.VEHICLE_INSURANCE_EXPIRED
      : VEHICLE_NOTIFICATION_EVENTS.VEHICLE_INSURANCE_EXPIRING;
  }

  return phase === "expired"
    ? VEHICLE_NOTIFICATION_EVENTS.VEHICLE_REGISTRATION_EXPIRED
    : VEHICLE_NOTIFICATION_EVENTS.VEHICLE_REGISTRATION_EXPIRING;
};

const getRecipientUserIds = (adminUserIds = []) => {
  return [
    ...new Set(
      (adminUserIds || []).map((userId) => normalizeId(userId)).filter(Boolean),
    ),
  ];
};

const getDedupeKey = ({ vehicle, documentType, phase, expiryDate, userId }) => {
  const vehicleId = normalizeId(vehicle?._id || vehicle);
  if (!vehicleId) return null;

  const expiryTimestamp = expiryDate ? new Date(expiryDate).getTime() : "none";
  return `vehicle:${vehicleId}:${documentType}:${phase}:${expiryTimestamp}:${userId}`;
};

const notifyVehicleDocumentExpiry = async ({
  vehicle,
  documentType,
  expiryDate,
  phase,
  daysRemaining = 0,
  adminUserIds = [],
}) => {
  if (!vehicle || vehicle.status === "retired") return 0;

  const event = getEvent(documentType, phase);
  const template = VEHICLE_NOTIFICATION_TEMPLATES[event];
  if (!template) return 0;

  const userIds = getRecipientUserIds(adminUserIds);
  if (userIds.length === 0) return 0;

  const notifications = userIds.map((userId) => {
    const dedupeKey = getDedupeKey({
      vehicle,
      documentType,
      phase,
      expiryDate,
      userId,
    });

    return {
      userId,
      title: template.title,
      message: template.message({ vehicle, expiryDate, daysRemaining }),
      type: "VEHICLE",
      dedupeKey,
      data: {
        event,
        eventKey: dedupeKey,
        vehicleId: normalizeId(vehicle._id || vehicle),
        plateNumber: vehicle.plateNumber || "",
        vehicleType: vehicle.vehicleTypeId?.name || vehicle.vehicleType || "",
        warehouseId: normalizeId(vehicle.warehouseId),
        documentType,
        expiryDate: expiryDate || null,
        daysRemaining: Number(daysRemaining || 0),
        phase,
        status: vehicle.status || null,
      },
    };
  });

  try {
    const created = await notificationService.createMany(notifications);
    return created?.length || 0;
  } catch (error) {
    logger.error("Failed to create vehicle expiry notifications", {
      vehicleId: normalizeId(vehicle._id || vehicle),
      documentType,
      error: error.message,
    });
    return 0;
  }
};

export default { notifyVehicleDocumentExpiry };
