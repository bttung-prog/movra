import logger from "../../configs/logger.js";

import { ROLES } from "../../constants/roles.js";
import { VEHICLE_STATUSES } from "../../constants/vehicleStatuses.js";

import userRepository from "../user/user.repository.js";
import vehicleRepository from "./vehicle.repository.js";
import vehicleNotificationService from "./vehicleNotification.service.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const REMINDER_DAYS = 30;

const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);

export const buildVehicleExpiryPhases = ({ vehicle, now }) => {
  const phases = [];
  const documents = [
    {
      documentType: "registration",
      expiryDate: vehicle.registrationExpiryDate,
    },
    { documentType: "insurance", expiryDate: vehicle.insuranceExpiryDate },
  ];

  for (const document of documents) {
    if (!document.expiryDate) continue;

    const rawDaysRemaining = Math.ceil(
      (new Date(document.expiryDate).getTime() - now.getTime()) / DAY_MS,
    );

    let phase = null;
    if (rawDaysRemaining <= 0) phase = "expired";
    else if (rawDaysRemaining <= 1) phase = "1d";
    else if (rawDaysRemaining <= 7) phase = "7d";
    else if (rawDaysRemaining <= REMINDER_DAYS) phase = "30d";

    if (!phase) continue;

    phases.push({
      documentType: document.documentType,
      expiryDate: new Date(document.expiryDate),
      phase,
      daysRemaining: Math.max(0, rawDaysRemaining),
    });
  }

  return phases;
};

const getAdminUserIds = async () => {
  try {
    return await userRepository.findActiveUserIdsByRole(ROLES.ADMIN);
  } catch (error) {
    logger.error("Failed to resolve admins for vehicle expiry notifications", {
      error: error.message,
    });
    return [];
  }
};

const processVehicleExpiryReminders = async ({ now = new Date() } = {}) => {
  const targetDate = addDays(now, REMINDER_DAYS);
  const vehicles = await vehicleRepository.findExpiryCandidates(targetDate);
  const adminUserIds = await getAdminUserIds();

  let scannedCount = 0;
  let notificationCount = 0;
  let skippedCount = 0;

  for (const vehicle of vehicles) {
    if (!vehicle?._id || vehicle.status === VEHICLE_STATUSES.RETIRED) {
      skippedCount += 1;
      continue;
    }

    const phases = buildVehicleExpiryPhases({ vehicle, now });
    if (phases.length === 0) continue;

    scannedCount += 1;

    for (const phase of phases) {
      notificationCount +=
        await vehicleNotificationService.notifyVehicleDocumentExpiry({
          vehicle,
          adminUserIds,
          ...phase,
        });
    }
  }

  return { scannedCount, notificationCount, skippedCount };
};

export default { processVehicleExpiryReminders };
