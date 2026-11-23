import { ROLES } from "../../constants/roles.js";
import { MAINTENANCE_MESSAGES } from "../../constants/messages.js";

import { ApiError } from "../../utils/ApiError.js";

import vehicleService from "../vehicle/vehicle.service.js";

import maintenanceAccess from "./maintenance.access.js";
import maintenanceScheduleRepository from "./maintenanceSchedule.repository.js";

const create = async (
  { vehicleId, taskName, frequencyMonths, frequencyKm },
  user = null,
) => {
  if (frequencyMonths <= 0 && frequencyKm <= 0) {
    throw new ApiError(
      400,
      MAINTENANCE_MESSAGES.FREQUENCY_MUST_BE_GREATER_THAN_ZERO,
    );
  }

  const vehicle = await vehicleService.getById(vehicleId, user);

  let nextDueDate = null;
  if (frequencyMonths > 0) {
    nextDueDate = new Date();
    nextDueDate.setMonth(nextDueDate.getMonth() + frequencyMonths);
  }

  let nextDueKm = null;
  if (frequencyKm > 0) {
    nextDueKm = (vehicle.currentOdometer || 0) + frequencyKm;
  }

  return maintenanceScheduleRepository.create({
    vehicleId,
    taskName,
    frequencyMonths,
    frequencyKm,
    nextDueDate,
    nextDueKm,
  });
};

const getAll = async ({ filter = {}, page = 1, limit = 10, user = null }) => {
  const skip = (page - 1) * limit;
  const finalFilter = await maintenanceAccess.scopeVehicleFilter(
    { deletedAt: null, ...filter },
    user,
  );

  const [schedules, total] = await Promise.all([
    maintenanceScheduleRepository.find({
      filter: finalFilter,
      skip,
      limit,
    }),
    maintenanceScheduleRepository.count(finalFilter),
  ]);

  return {
    data: schedules,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getById = async (scheduleId, requireNotDeleted = true, user = null) => {
  const schedule = await maintenanceScheduleRepository.findById(scheduleId);

  if (!schedule) {
    throw new ApiError(404, MAINTENANCE_MESSAGES.NOT_FOUND);
  }

  if (requireNotDeleted && schedule.deletedAt !== null) {
    throw new ApiError(400, MAINTENANCE_MESSAGES.ALREADY_DELETED);
  }

  await maintenanceAccess.checkDriverVehicleAccess(user, schedule.vehicleId);
  await vehicleService.getById(schedule.vehicleId, user);

  return schedule;
};

const getByVehicleId = async ({
  vehicleId,
  filter = {},
  page = 1,
  limit = 10,
  user = null,
}) => {
  await maintenanceAccess.checkDriverVehicleAccess(user, vehicleId);
  await vehicleService.getById(vehicleId, user);

  const skip = (page - 1) * limit;
  const finalFilter = { deletedAt: null, ...filter };

  const [schedules, total] = await Promise.all([
    maintenanceScheduleRepository.findByVehicleId({
      vehicleId,
      filter: finalFilter,
      skip,
      limit,
    }),
    maintenanceScheduleRepository.countByVehicleId(vehicleId, finalFilter),
  ]);

  return {
    data: schedules,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getUpcomingMaintenances = async ({ daysAhead = 7, user = null }) => {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + Number(daysAhead));

  let vehicleIds = null;
  if (user?.role === ROLES.DISPATCHER) {
    vehicleIds = await vehicleService.getIdsByWarehouseId(user.warehouseId);
  } else if (user?.role === ROLES.DRIVER) {
    vehicleIds = await maintenanceAccess.getDriverVehicleIds(user);
  }
  return maintenanceScheduleRepository.findUpcoming(targetDate, vehicleIds);
};

const updateById = async (scheduleId, updateData, user = null) => {
  const existingSchedule = await getById(scheduleId, true, user);
  const vehicle = await vehicleService.getById(
    existingSchedule.vehicleId?._id || existingSchedule.vehicleId,
    user,
  );

  const frequencyMonths =
    updateData.frequencyMonths !== undefined
      ? updateData.frequencyMonths
      : existingSchedule.frequencyMonths;
  const frequencyKm =
    updateData.frequencyKm !== undefined
      ? updateData.frequencyKm
      : existingSchedule.frequencyKm;

  if (frequencyMonths <= 0 && frequencyKm <= 0) {
    throw new ApiError(
      400,
      MAINTENANCE_MESSAGES.FREQUENCY_MUST_BE_GREATER_THAN_ZERO,
    );
  }

  const payload = { ...updateData };

  if (updateData.frequencyMonths !== undefined) {
    if (frequencyMonths > 0) {
      const baseDate = existingSchedule.lastServiceDate || new Date();
      const nextDueDate = new Date(baseDate);
      nextDueDate.setMonth(nextDueDate.getMonth() + frequencyMonths);
      payload.nextDueDate = nextDueDate;
    } else {
      payload.nextDueDate = null;
    }
  }

  if (updateData.frequencyKm !== undefined) {
    if (frequencyKm > 0) {
      const baseKm =
        existingSchedule.lastServiceKm ?? (vehicle.currentOdometer || 0);
      payload.nextDueKm = baseKm + frequencyKm;
    } else {
      payload.nextDueKm = null;
    }
  }

  return maintenanceScheduleRepository.updateById(scheduleId, payload);
};

const deleteById = async (scheduleId, user = null) => {
  await getById(scheduleId, true, user);

  return maintenanceScheduleRepository.deleteById(scheduleId);
};

const restoreById = async (scheduleId, user = null) => {
  const schedule = await getById(scheduleId, false, user);

  if (schedule.deletedAt === null) {
    throw new ApiError(400, MAINTENANCE_MESSAGES.NOT_DELETED);
  }

  return maintenanceScheduleRepository.restoreById(scheduleId);
};

const processMaintenanceComplete = async (
  scheduleId,
  currentDate,
  odometerReading,
  session = null,
) => {
  const schedule = await getById(scheduleId, false);

  let nextDueDate = null;
  if (schedule.frequencyMonths) {
    nextDueDate = new Date(currentDate);
    nextDueDate.setMonth(nextDueDate.getMonth() + schedule.frequencyMonths);
  }

  let nextDueKm = null;
  if (schedule.frequencyKm && odometerReading != null) {
    nextDueKm = odometerReading + schedule.frequencyKm;
  }

  return maintenanceScheduleRepository.updateById(
    scheduleId,
    {
      lastServiceDate: currentDate,
      lastServiceKm: odometerReading,
      nextDueDate,
      nextDueKm,
    },
    session,
  );
};

export default {
  create,
  getAll,
  getById,
  getByVehicleId,
  getUpcoming: getUpcomingMaintenances,
  getUpcomingMaintenances,
  updateById,
  deleteById,
  restoreById,
  processMaintenanceComplete,
};
