import { MAINTENANCE_NOTIFICATION_EVENTS } from "../../constants/maintenanceNotification.js";
import { VEHICLE_STATUSES } from "../../constants/vehicleStatuses.js";

import maintenanceScheduleRepository from "./maintenanceSchedule.repository.js";
import maintenanceNotificationService from "./maintenanceNotification.service.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const DUE_SOON_DAYS = 7;
const DUE_KM_THRESHOLD = 500;

const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);

export const buildMaintenancePhases = ({ schedule, vehicle, now }) => {
  const phases = [];

  if (schedule.nextDueDate) {
    const remainingDays = Math.ceil(
      (new Date(schedule.nextDueDate).getTime() - now.getTime()) / DAY_MS,
    );

    if (remainingDays <= 0) {
      phases.push({
        key: "overdue",
        event: MAINTENANCE_NOTIFICATION_EVENTS.MAINTENANCE_OVERDUE,
      });
    } else if (remainingDays <= 1) {
      phases.push({
        key: "due_1d",
        event: MAINTENANCE_NOTIFICATION_EVENTS.MAINTENANCE_DUE_SOON,
      });
    } else if (remainingDays <= DUE_SOON_DAYS) {
      phases.push({
        key: "due_7d",
        event: MAINTENANCE_NOTIFICATION_EVENTS.MAINTENANCE_DUE_SOON,
      });
    }
  }

  if (schedule.nextDueKm != null && vehicle.currentOdometer != null) {
    const remainingKm =
      Number(schedule.nextDueKm) - Number(vehicle.currentOdometer);

    if (remainingKm <= 0) {
      phases.push({
        key: "overdue_km",
        event: MAINTENANCE_NOTIFICATION_EVENTS.MAINTENANCE_OVERDUE_KM,
      });
    } else if (remainingKm <= DUE_KM_THRESHOLD) {
      phases.push({
        key: "due_km_500",
        event: MAINTENANCE_NOTIFICATION_EVENTS.MAINTENANCE_DUE_KM,
      });
    }
  }

  return phases;
};

const processMaintenanceReminders = async ({ now = new Date() } = {}) => {
  const targetDate = addDays(now, DUE_SOON_DAYS);
  const schedules =
    await maintenanceScheduleRepository.findReminderCandidates(targetDate);

  let scannedCount = 0;
  let notificationCount = 0;
  let skippedCount = 0;

  for (const schedule of schedules) {
    const vehicle = schedule.vehicleId;
    if (!vehicle?._id || vehicle.status === VEHICLE_STATUSES.RETIRED) {
      skippedCount += 1;
      continue;
    }

    const phases = buildMaintenancePhases({ schedule, vehicle, now });
    if (phases.length === 0) continue;

    scannedCount += 1;

    for (const phase of phases) {
      notificationCount +=
        await maintenanceNotificationService.notifyMaintenanceScheduleDue({
          schedule,
          vehicle,
          phase,
        });
    }
  }

  return { scannedCount, notificationCount, skippedCount };
};

export default { processMaintenanceReminders };
