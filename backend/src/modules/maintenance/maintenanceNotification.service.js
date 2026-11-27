import logger from "../../configs/logger.js";

import {
  MAINTENANCE_NOTIFICATION_EVENTS,
  MAINTENANCE_NOTIFICATION_TEMPLATES,
} from "../../constants/maintenanceNotification.js";
import { VEHICLE_STATUSES } from "../../constants/vehicleStatuses.js";

import {
  getActorUserIdString,
  getReferenceIdString,
} from "../../utils/actor.util.js";

import dispatcherRepository from "../dispatcher/dispatcher.repository.js";
import accountantRepository from "../accountant/accountant.repository.js";
import notificationService from "../notification/notification.service.js";

const getVehicleId = (vehicle) => getReferenceIdString(vehicle?._id || vehicle);

const getVehicleWarehouseId = (vehicle) =>
  getReferenceIdString(vehicle?.warehouseId);

const getDispatcherUserIds = async (vehicle) => {
  const warehouseId = getVehicleWarehouseId(vehicle);
  if (!warehouseId) return [];

  const dispatchers =
    await dispatcherRepository.findActiveByWarehouseId(warehouseId);

  return [
    ...new Set(
      (dispatchers || [])
        .map((dispatcher) => getReferenceIdString(dispatcher?.userId))
        .filter(Boolean),
    ),
  ];
};

const getAccountantUserIds = async () => {
  const userIds = await accountantRepository.findActiveUserIds();
  return [...new Set((userIds || []).map((id) => String(id)).filter(Boolean))];
};

const buildScheduleCycleKey = (schedule, phase) => {
  if (phase.key.includes("km")) {
    return `km-${Number(schedule.nextDueKm)}`;
  }

  const dueDate = schedule.nextDueDate
    ? new Date(schedule.nextDueDate).getTime()
    : "none";
  return `date-${dueDate}`;
};

const buildNotification = ({
  userId,
  event,
  vehicle,
  schedule = null,
  log = null,
  phase = null,
  dedupeKey = null,
  title,
  message,
  extraData = {},
}) => {
  const template = MAINTENANCE_NOTIFICATION_TEMPLATES[event];
  if (!template) return null;

  return {
    userId,
    title: title || template.title,
    message: message || template.message({ vehicle, schedule, log, phase }),
    type: "MAINTENANCE",
    dedupeKey,
    data: {
      event,
      eventKey: dedupeKey,
      phase,
      vehicleId: getVehicleId(vehicle),
      plateNumber: vehicle?.plateNumber || "",
      scheduleId: getReferenceIdString(schedule?._id || schedule),
      maintenanceLogId: getReferenceIdString(log?._id || log),
      taskName: schedule?.taskName || "",
      dueDate: schedule?.nextDueDate || null,
      dueKm: schedule?.nextDueKm ?? null,
      currentOdometer: vehicle?.currentOdometer ?? null,
      cost: log?.cost ?? null,
      status: log?.status || schedule?.status || null,
      warehouseId: getVehicleWarehouseId(vehicle),
      ...extraData,
    },
  };
};

const sendNotifications = async (notifications = []) => {
  if (notifications.length === 0) return 0;

  try {
    const created = await notificationService.createMany(notifications);
    return created?.length || 0;
  } catch (error) {
    logger.error(`[MAINTENANCE_NOTIFICATION] ${error.message}`, {
      stack: error.stack,
    });
    return 0;
  }
};

const notifyMaintenanceStarted = async ({
  vehicle,
  activeTrips = [],
  actor = null,
}) => {
  if (!vehicle || vehicle.status === VEHICLE_STATUSES.RETIRED) return 0;

  const actorUserId = getActorUserIdString(actor);
  const dispatcherUserIds = await getDispatcherUserIds(vehicle);
  const plannedTrips = (activeTrips || []).filter(
    (trip) => trip.status === "planned",
  );
  const tripCodes = plannedTrips.map((trip) => trip.tripCode).join(", ");

  const title =
    plannedTrips.length > 0
      ? "Cảnh báo: Phương tiện vào bảo dưỡng có chuyến đã lên lịch"
      : "Phương tiện vào bảo dưỡng";
  const message =
    plannedTrips.length > 0
      ? `Phương tiện ${vehicle.plateNumber} đã được đưa vào bảo dưỡng. Phương tiện này đang được gán cho các chuyến xe đã lên kế hoạch (${tripCodes}). Vui lòng điều phối phương tiện thay thế.`
      : `Phương tiện ${vehicle.plateNumber} đã được đưa vào bảo dưỡng.`;

  const notifications = dispatcherUserIds
    .filter((userId) => userId !== actorUserId)
    .map((userId) =>
      buildNotification({
        userId,
        event: MAINTENANCE_NOTIFICATION_EVENTS.MAINTENANCE_STARTED,
        vehicle,
        title,
        message,
        extraData: { tripId: plannedTrips[0]?._id || null },
      }),
    )
    .filter(Boolean);

  return sendNotifications(notifications);
};

const notifyMaintenanceCompleted = async ({
  vehicle,
  log = null,
  actor = null,
}) => {
  if (!vehicle || vehicle.status === VEHICLE_STATUSES.RETIRED) return 0;

  const actorUserId = getActorUserIdString(actor);
  const recipientIds = [
    ...new Set([
      ...(await getDispatcherUserIds(vehicle)),
      ...(await getAccountantUserIds()),
    ]),
  ].filter((userId) => userId !== actorUserId);
  const logId = getReferenceIdString(log?._id || log);

  const notifications = recipientIds
    .map((userId) =>
      buildNotification({
        userId,
        event: MAINTENANCE_NOTIFICATION_EVENTS.MAINTENANCE_COMPLETED,
        vehicle,
        log,
        dedupeKey: logId
          ? `maintenance:log:${logId}:completed:${userId}`
          : null,
      }),
    )
    .filter(Boolean);

  return sendNotifications(notifications);
};

const notifyMaintenanceExited = async ({
  vehicle,
  log = null,
  actor = null,
}) => {
  if (!vehicle || vehicle.status === VEHICLE_STATUSES.RETIRED) return 0;

  const actorUserId = getActorUserIdString(actor);
  const dispatcherUserIds = await getDispatcherUserIds(vehicle);
  const logId = getReferenceIdString(log?._id || log);

  const notifications = dispatcherUserIds
    .filter((userId) => userId !== actorUserId)
    .map((userId) =>
      buildNotification({
        userId,
        event: MAINTENANCE_NOTIFICATION_EVENTS.MAINTENANCE_EXITED,
        vehicle,
        log,
        dedupeKey: logId ? `maintenance:log:${logId}:exited:${userId}` : null,
      }),
    )
    .filter(Boolean);

  return sendNotifications(notifications);
};

const notifyMaintenanceScheduleDue = async ({
  schedule,
  vehicle,
  phase,
  actor = null,
}) => {
  if (!schedule || !vehicle || !phase?.event) return 0;

  const actorUserId = getActorUserIdString(actor);
  const dispatcherUserIds = await getDispatcherUserIds(vehicle);
  const scheduleId = getReferenceIdString(schedule._id || schedule);
  if (!scheduleId) return 0;

  const notifications = dispatcherUserIds
    .filter((userId) => userId !== actorUserId)
    .map((userId) => {
      const cycleKey = buildScheduleCycleKey(schedule, phase);
      const dedupeKey = `maintenance:${scheduleId}:${phase.key}:${cycleKey}:${userId}`;

      return buildNotification({
        userId,
        event: phase.event,
        vehicle,
        schedule,
        phase: phase.key,
        dedupeKey,
      });
    })
    .filter(Boolean);

  return sendNotifications(notifications);
};

export default {
  notifyMaintenanceStarted,
  notifyMaintenanceCompleted,
  notifyMaintenanceExited,
  notifyMaintenanceScheduleDue,
};
