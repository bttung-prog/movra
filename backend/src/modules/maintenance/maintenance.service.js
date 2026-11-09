import mongoose from "mongoose";

import { ROLES } from "../../constants/roles.js";
import { MAINTENANCE_STATUSES } from "../../constants/maintenanceStatuses.js";
import { VEHICLE_STATUSES } from "../../constants/vehicleStatuses.js";
import { TRIP_STATUSES } from "../../constants/tripStatuses.js";
import {
  MAINTENANCE_MESSAGES,
  COMMON_MESSAGES,
  DRIVER_MESSAGES,
} from "../../constants/messages.js";

import ApiError from "../../utils/ApiError.js";

import vehicleService from "../vehicle/vehicle.service.js";
import driverService from "../driver/driver.service.js";
import tripService from "../trip/trip.service.js";
import dispatcherService from "../dispatcher/dispatcher.service.js";
import notificationService from "../notification/notification.service.js";

import maintenanceRepository from "./maintenance.repository.js";

const getDriverVehicleIds = async (user) => {
  const userId = user?.userId || user?._id;
  const driver = userId ? await driverService.getByUserId(userId) : null;
  if (!driver) {
    throw new ApiError(403, DRIVER_MESSAGES.NOT_FOUND);
  }

  const vehicleId = driver.currentVehicleId?._id || driver.currentVehicleId;
  return vehicleId ? [vehicleId] : [];
};

const checkDriverVehicleAccess = async (user, vehicleId) => {
  if (user?.role !== ROLES.DRIVER) return;

  const vehicleIds = await getDriverVehicleIds(user);
  if (vehicleIds[0]?.toString() !== vehicleId.toString()) {
    throw new ApiError(403, MAINTENANCE_MESSAGES.UPDATE_LOG_OWN_VEHICLE_ONLY);
  }
};

const scopeVehicleFilter = async (filter, user) => {
  if (user?.role === ROLES.DISPATCHER) {
    const vehicleIds = await vehicleService.getIdsByWarehouseId(
      user.warehouseId,
    );
    return { $and: [filter, { vehicleId: { $in: vehicleIds } }] };
  }

  if (user?.role === ROLES.DRIVER) {
    const vehicleIds = await getDriverVehicleIds(user);
    return { $and: [filter, { vehicleId: { $in: vehicleIds } }] };
  }

  return filter;
};

const createSchedule = async (
  { vehicleId, taskName, frequencyMonths, frequencyKm },
  user = null,
) => {
  if (
    !vehicleId ||
    !taskName ||
    frequencyMonths === undefined ||
    frequencyMonths === null ||
    frequencyKm === undefined ||
    frequencyKm === null
  ) {
    throw new ApiError(400, COMMON_MESSAGES.ALL_FIELDS_REQUIRED);
  }

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

  return maintenanceRepository.createSchedule({
    vehicleId,
    taskName,
    frequencyMonths,
    frequencyKm,
    nextDueDate,
    nextDueKm,
  });
};

const getAllSchedules = async ({
  filter = {},
  page = 1,
  limit = 10,
  user = null,
}) => {
  const skip = (page - 1) * limit;
  const finalFilter = await scopeVehicleFilter(
    { deletedAt: null, ...filter },
    user,
  );

  const [schedules, total] = await Promise.all([
    maintenanceRepository.findAllSchedules({
      filter: finalFilter,
      skip,
      limit,
    }),
    maintenanceRepository.countAllSchedules(finalFilter),
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

const getScheduleById = async (
  scheduleId,
  requireNotDeleted = true,
  user = null,
) => {
  const schedule = await maintenanceRepository.findScheduleById(scheduleId);

  if (!schedule) {
    throw new ApiError(404, MAINTENANCE_MESSAGES.NOT_FOUND);
  }

  if (requireNotDeleted && schedule.deletedAt !== null) {
    throw new ApiError(400, MAINTENANCE_MESSAGES.ALREADY_DELETED);
  }

  await checkDriverVehicleAccess(user, schedule.vehicleId);
  await vehicleService.getById(schedule.vehicleId, user);

  return schedule;
};

const getSchedulesByVehicleId = async ({
  vehicleId,
  filter = {},
  page = 1,
  limit = 10,
  user = null,
}) => {
  await checkDriverVehicleAccess(user, vehicleId);
  await vehicleService.getById(vehicleId, user);

  const skip = (page - 1) * limit;
  const finalFilter = { deletedAt: null, ...filter };

  const [schedules, total] = await Promise.all([
    maintenanceRepository.findSchedulesByVehicleId({
      vehicleId,
      filter: finalFilter,
      skip,
      limit,
    }),
    maintenanceRepository.countSchedulesByVehicleId(vehicleId, finalFilter),
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
    vehicleIds = await getDriverVehicleIds(user);
  }
  return maintenanceRepository.getUpcomingMaintenances(targetDate, vehicleIds);
};

const updateSchedule = async (scheduleId, updateData, user = null) => {
  const existingSchedule = await getScheduleById(scheduleId, true, user);
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

  return maintenanceRepository.updateSchedule(scheduleId, payload);
};

const deleteSchedule = async (scheduleId, user = null) => {
  await getScheduleById(scheduleId, true, user);

  return maintenanceRepository.deleteSchedule(scheduleId);
};

const restoreSchedule = async (scheduleId, user = null) => {
  const schedule = await getScheduleById(scheduleId, false, user);

  if (schedule.deletedAt === null) {
    throw new ApiError(400, MAINTENANCE_MESSAGES.NOT_DELETED);
  }

  return maintenanceRepository.restoreSchedule(scheduleId);
};

const processMaintenanceComplete = async (
  scheduleId,
  currentDate,
  odometerReading,
  session = null,
) => {
  const schedule = await getScheduleById(scheduleId, false);

  let nextDueDate = null;
  if (schedule.frequencyMonths) {
    nextDueDate = new Date(currentDate);
    nextDueDate.setMonth(nextDueDate.getMonth() + schedule.frequencyMonths);
  }

  let nextDueKm = null;
  if (schedule.frequencyKm && odometerReading != null) {
    nextDueKm = odometerReading + schedule.frequencyKm;
  }

  return maintenanceRepository.updateSchedule(
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

const notifyDispatchersVehicleMaintenance = async ({
  vehicle,
  activeTrips = [],
  action = "ENTER_MAINTENANCE",
  session = null,
}) => {
  const warehouseId = vehicle.warehouseId?._id || vehicle.warehouseId;
  if (!warehouseId) return;

  const dispatchers =
    await dispatcherService.getActiveByWarehouseId(warehouseId);
  if (!dispatchers || dispatchers.length === 0) return;

  const plannedTrips = (activeTrips || []).filter(
    (t) => t.status === TRIP_STATUSES.PLANNED,
  );
  const tripCodes = plannedTrips.map((t) => t.tripCode).join(", ");

  let title = "Thông báo bảo dưỡng phương tiện";
  let message = `Phương tiện ${vehicle.plateNumber} đã được đưa vào bảo dưỡng.`;

  if (action === "ENTER_MAINTENANCE") {
    if (plannedTrips.length > 0) {
      title = "Cảnh báo: Phương tiện vào bảo dưỡng có chuyến đã lên lịch";
      message = `Phương tiện ${vehicle.plateNumber} đã được đưa vào bảo dưỡng. Phương tiện này đang được gán cho các chuyến xe đã lên kế hoạch (${tripCodes}). Vui lòng điều phối phương tiện thay thế.`;
    }
  } else if (action === "EXIT_MAINTENANCE") {
    title = "Phương tiện hoàn tất bảo dưỡng";
    message = `Phương tiện ${vehicle.plateNumber} đã hoàn tất bảo dưỡng và sẵn sàng hoạt động.`;
  }

  await Promise.all(
    dispatchers.map((disp) => {
      const userId = disp.userId?._id || disp.userId;
      if (!userId) return Promise.resolve();
      return notificationService.create({
        userId,
        title,
        message,
        type: "SYSTEM",
        data: {
          vehicleId: vehicle._id,
          tripId: plannedTrips[0]?._id || null,
        },
        session,
      });
    }),
  );
};

const handleMaintenanceInProgress = async (targetVehicleId, session) => {
  const vehicle = await vehicleService.getById(targetVehicleId);
  if (vehicle.status === VEHICLE_STATUSES.RETIRED) {
    throw new ApiError(400, MAINTENANCE_MESSAGES.VEHICLE_RETIRED);
  }

  const activeTrips = await tripService.findActiveByVehicleId(
    targetVehicleId,
    session,
  );
  const hasRunningTrip =
    vehicle.status === VEHICLE_STATUSES.IN_USE ||
    activeTrips.some((t) => t.status === TRIP_STATUSES.IN_PROGRESS);

  if (hasRunningTrip) {
    throw new ApiError(400, MAINTENANCE_MESSAGES.VEHICLE_IN_USE);
  }

  await vehicleService.changeStatus(
    targetVehicleId,
    VEHICLE_STATUSES.MAINTENANCE,
    session,
  );

  await notifyDispatchersVehicleMaintenance({
    vehicle,
    activeTrips,
    action: "ENTER_MAINTENANCE",
    session,
  });
};

const handleMaintenanceCompletion = async ({
  targetVehicleId,
  scheduleId,
  completeDate,
  odometerReading,
  session,
}) => {
  if (scheduleId) {
    await processMaintenanceComplete(
      scheduleId,
      completeDate,
      odometerReading,
      session,
    );
  }

  const vehicle = await vehicleService.getById(targetVehicleId);
  if (odometerReading && odometerReading > (vehicle.currentOdometer || 0)) {
    await vehicleService.updateOdometer(
      targetVehicleId,
      odometerReading,
      session,
    );
  }

  await syncVehicleStatusFromLatestLog(targetVehicleId, session);
};

const validateLogStatusTransition = (currentStatus, nextStatus) => {
  const allowedTransitions = {
    [MAINTENANCE_STATUSES.SCHEDULED]: [
      MAINTENANCE_STATUSES.IN_PROGRESS,
      MAINTENANCE_STATUSES.COMPLETED,
      MAINTENANCE_STATUSES.CANCELLED,
    ],
    [MAINTENANCE_STATUSES.IN_PROGRESS]: [
      MAINTENANCE_STATUSES.COMPLETED,
      MAINTENANCE_STATUSES.CANCELLED,
    ],
    [MAINTENANCE_STATUSES.COMPLETED]: [],
    [MAINTENANCE_STATUSES.CANCELLED]: [],
  };

  if (!allowedTransitions[currentStatus]?.includes(nextStatus)) {
    throw new ApiError(400, MAINTENANCE_MESSAGES.INVALID_LOG_STATUS_TRANSITION);
  }
};

const syncVehicleStatusFromLatestLog = async (targetVehicleId, session) => {
  const latestLog = await maintenanceRepository.findLatestLogByVehicle(
    targetVehicleId,
    session,
  );
  if (!latestLog) {
    throw new ApiError(404, MAINTENANCE_MESSAGES.LOG_NOT_FOUND);
  }

  const vehicle = await vehicleService.getById(targetVehicleId);
  if (vehicle.status === VEHICLE_STATUSES.RETIRED) return;

  const targetStatus =
    latestLog.status === MAINTENANCE_STATUSES.IN_PROGRESS
      ? VEHICLE_STATUSES.MAINTENANCE
      : VEHICLE_STATUSES.AVAILABLE;
  if (vehicle.status !== targetStatus) {
    await vehicleService.changeStatus(targetVehicleId, targetStatus, session);
    if (targetStatus === VEHICLE_STATUSES.AVAILABLE) {
      await notifyDispatchersVehicleMaintenance({
        vehicle,
        action: "EXIT_MAINTENANCE",
        session,
      });
    }
  }
};

const handleMaintenanceCancellation = async (targetVehicleId, session) => {
  await syncVehicleStatusFromLatestLog(targetVehicleId, session);
};

const createLog = async (
  {
    vehicleId,
    scheduleId,
    type,
    description,
    cost,
    odometerReading,
    startDate,
    endDate,
  },
  user = null,
) => {
  await checkDriverVehicleAccess(user, vehicleId);

  if (
    !vehicleId ||
    !scheduleId ||
    !type ||
    !description ||
    cost == null ||
    odometerReading == null
  ) {
    throw new ApiError(400, COMMON_MESSAGES.ALL_FIELDS_REQUIRED);
  }

  const vehicle = await vehicleService.getById(vehicleId, user);
  if (vehicle.status === VEHICLE_STATUSES.RETIRED) {
    throw new ApiError(400, MAINTENANCE_MESSAGES.VEHICLE_RETIRED);
  }

  const activeTrips = await tripService.findActiveByVehicleId(vehicleId);
  const hasRunningTrip =
    vehicle.status === VEHICLE_STATUSES.IN_USE ||
    activeTrips.some((t) => t.status === TRIP_STATUSES.IN_PROGRESS);

  if (hasRunningTrip) {
    throw new ApiError(400, MAINTENANCE_MESSAGES.VEHICLE_IN_USE);
  }

  const schedule = await getScheduleById(scheduleId, true, user);

  const scheduleVehicleId =
    schedule.vehicleId?._id?.toString() || schedule.vehicleId?.toString();
  if (scheduleVehicleId !== vehicleId.toString()) {
    throw new ApiError(
      400,
      MAINTENANCE_MESSAGES.SCHEDULE_NOT_BELONG_TO_VEHICLE,
    );
  }

  return maintenanceRepository.createLog({
    vehicleId,
    scheduleId,
    type,
    description,
    cost,
    odometerReading,
    startDate: startDate || new Date(),
    endDate,
    status: MAINTENANCE_STATUSES.SCHEDULED,
  });
};

const getLogs = async ({ filter = {}, page = 1, limit = 10, user = null }) => {
  const skip = (page - 1) * limit;
  const queryFilter = await scopeVehicleFilter(filter, user);

  const [logs, total] = await Promise.all([
    maintenanceRepository.findLogs({ filter: queryFilter, skip, limit }),
    maintenanceRepository.countAllLogs(queryFilter),
  ]);

  return {
    data: logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getLogById = async (logId, user = null) => {
  if (!logId) {
    throw new ApiError(400, MAINTENANCE_MESSAGES.LOG_ID_REQUIRED);
  }

  const log = await maintenanceRepository.findLogById(logId);

  if (!log) {
    throw new ApiError(404, MAINTENANCE_MESSAGES.LOG_NOT_FOUND);
  }

  const vehicleId = log.vehicleId?._id || log.vehicleId;
  await checkDriverVehicleAccess(user, vehicleId);
  await vehicleService.getById(vehicleId, user);

  return log;
};

const getTotalCost = async ({ startDate, endDate, user = null }) => {
  if (!startDate || !endDate) {
    throw new ApiError(400, MAINTENANCE_MESSAGES.DATE_RANGE_REQUIRED);
  }

  let vehicleIds = null;
  if (user?.role === ROLES.DISPATCHER) {
    vehicleIds = await vehicleService.getIdsByWarehouseId(user.warehouseId);
  } else if (user?.role === ROLES.DRIVER) {
    vehicleIds = await getDriverVehicleIds(user);
  }
  const result = await maintenanceRepository.totalCost(
    new Date(startDate),
    new Date(endDate),
    vehicleIds,
  );

  return { totalCost: result[0]?.totalCost || 0 };
};

const getTotalCostByVehicle = async ({
  vehicleId,
  startDate,
  endDate,
  user = null,
}) => {
  if (!vehicleId || !startDate || !endDate) {
    throw new ApiError(
      400,
      MAINTENANCE_MESSAGES.VEHICLE_AND_DATE_RANGE_REQUIRED,
    );
  }

  if (!mongoose.Types.ObjectId.isValid(vehicleId)) {
    throw new ApiError(400, MAINTENANCE_MESSAGES.INVALID_VEHICLE_ID);
  }

  await vehicleService.getById(vehicleId, user);

  const result = await maintenanceRepository.totalCostByVehicle(
    new mongoose.Types.ObjectId(String(vehicleId)),
    new Date(startDate),
    new Date(endDate),
  );

  return { vehicleId, totalCost: result[0]?.totalCost || 0 };
};

const createLogEvent = async (logId, eventData, user = null) => {
  const { status, cost, odometerReading } = eventData;
  const log = await getLogById(logId, user);
  const targetVehicleId = log.vehicleId?._id || log.vehicleId;

  validateLogStatusTransition(log.status, status);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const latestLog = await maintenanceRepository.findLatestLogByVehicle(
      targetVehicleId,
      session,
    );
    if (!latestLog || latestLog._id.toString() !== log._id.toString()) {
      throw new ApiError(409, MAINTENANCE_MESSAGES.LOG_STATUS_CHANGED);
    }

    const payload = {
      vehicleId: targetVehicleId,
      scheduleId: log.scheduleId,
      previousLogId: log._id,
      type: log.type,
      description: log.description,
      cost: cost ?? log.cost,
      startDate: log.startDate,
      endDate:
        status === MAINTENANCE_STATUSES.COMPLETED ? new Date() : log.endDate,
      odometerReading: odometerReading ?? log.odometerReading,
      status,
    };

    if (
      status === MAINTENANCE_STATUSES.IN_PROGRESS &&
      log.status !== MAINTENANCE_STATUSES.IN_PROGRESS
    ) {
      await handleMaintenanceInProgress(targetVehicleId, session);
    }

    const newLog = await maintenanceRepository.createLog(payload, session);

    if (status === MAINTENANCE_STATUSES.COMPLETED) {
      await handleMaintenanceCompletion({
        targetVehicleId,
        scheduleId: log.scheduleId,
        completeDate: newLog.endDate,
        odometerReading: newLog.odometerReading,
        session,
      });
    }

    if (status === MAINTENANCE_STATUSES.CANCELLED) {
      await handleMaintenanceCancellation(targetVehicleId, session);
    }

    await session.commitTransaction();
    return newLog;
  } catch (error) {
    await session.abortTransaction();
    if (error.code === 11000) {
      throw new ApiError(409, MAINTENANCE_MESSAGES.LOG_STATUS_CHANGED);
    }
    throw error;
  } finally {
    session.endSession();
  }
};

export default {
  // Maintenance Schedule
  createSchedule,
  getAllSchedules,
  getScheduleById,
  getSchedulesByVehicleId,
  getUpcomingMaintenances,
  updateSchedule,
  deleteSchedule,
  restoreSchedule,

  // Maintenance Log
  processMaintenanceComplete,
  createLog,
  getLogs,
  getLogById,
  getTotalCost,
  getTotalCostByVehicle,
  createLogEvent,
};
