import mongoose from "mongoose";

import { ROLES } from "../../constants/roles.js";
import {
  MAINTENANCE_STATUSES,
  MAINTENANCE_STATUS_TRANSITIONS,
} from "../../constants/maintenanceStatuses.js";
import { VEHICLE_STATUSES } from "../../constants/vehicleStatuses.js";
import { TRIP_STATUSES } from "../../constants/tripStatuses.js";
import { MAINTENANCE_MESSAGES } from "../../constants/messages.js";

import { ApiError } from "../../utils/ApiError.js";
import { getReferenceIdString } from "../../utils/actor.util.js";

import vehicleService from "../vehicle/vehicle.service.js";
import tripService from "../trip/trip.service.js";
import logger from "../../configs/logger.js";

import maintenanceNotificationService from "./maintenanceNotification.service.js";

import maintenanceAccess from "./maintenance.access.js";
import maintenanceScheduleService from "./maintenanceSchedule.service.js";
import maintenanceLogRepository from "./maintenanceLog.repository.js";

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

  return { vehicle, activeTrips };
};

const handleMaintenanceCompletion = async ({
  targetVehicleId,
  scheduleId,
  completeDate,
  odometerReading,
  session,
}) => {
  if (scheduleId) {
    await maintenanceScheduleService.processMaintenanceComplete(
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

const validateStatusTransition = (currentStatus, nextStatus) => {
  if (!MAINTENANCE_STATUS_TRANSITIONS[currentStatus]?.includes(nextStatus)) {
    throw new ApiError(400, MAINTENANCE_MESSAGES.INVALID_LOG_STATUS_TRANSITION);
  }
};

const syncVehicleStatusFromLatestLog = async (targetVehicleId, session) => {
  const latestLog = await maintenanceLogRepository.findLatestByVehicle(
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
  }
};

const handleMaintenanceCancellation = async (targetVehicleId, session) => {
  await syncVehicleStatusFromLatestLog(targetVehicleId, session);
};

const create = async (
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
  await maintenanceAccess.checkDriverVehicleAccess(user, vehicleId);

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

  const schedule = await maintenanceScheduleService.getById(
    scheduleId,
    true,
    user,
  );

  const scheduleVehicleId =
    schedule.vehicleId?._id?.toString() || schedule.vehicleId?.toString();
  if (scheduleVehicleId !== vehicleId.toString()) {
    throw new ApiError(
      400,
      MAINTENANCE_MESSAGES.SCHEDULE_NOT_BELONG_TO_VEHICLE,
    );
  }

  return maintenanceLogRepository.create({
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

const getAll = async ({ filter = {}, page = 1, limit = 10, user = null }) => {
  const skip = (page - 1) * limit;
  const queryFilter = await maintenanceAccess.scopeVehicleFilter(filter, user);

  const [logs, total] = await Promise.all([
    maintenanceLogRepository.findAll({ filter: queryFilter, skip, limit }),
    maintenanceLogRepository.countAll(queryFilter),
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

const getById = async (logId, user = null) => {
  const log = await maintenanceLogRepository.findById(logId);

  if (!log) {
    throw new ApiError(404, MAINTENANCE_MESSAGES.LOG_NOT_FOUND);
  }

  const vehicleId = log.vehicleId?._id || log.vehicleId;
  await maintenanceAccess.checkDriverVehicleAccess(user, vehicleId);
  await vehicleService.getById(vehicleId, user);

  return log;
};

const getTotalCost = async ({ startDate, endDate, user = null }) => {
  let vehicleIds = null;
  if (user?.role === ROLES.DISPATCHER) {
    vehicleIds = await vehicleService.getIdsByWarehouseId(user.warehouseId);
  } else if (user?.role === ROLES.DRIVER) {
    vehicleIds = await maintenanceAccess.getDriverVehicleIds(user);
  }
  const result = await maintenanceLogRepository.totalCost(
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
  await vehicleService.getById(vehicleId, user);

  const result = await maintenanceLogRepository.totalCostByVehicle(
    new mongoose.Types.ObjectId(String(vehicleId)),
    new Date(startDate),
    new Date(endDate),
  );

  return { vehicleId, totalCost: result[0]?.totalCost || 0 };
};

const notifyCommittedMaintenanceEvent = async ({
  status,
  targetVehicleId,
  newLog,
  inProgressContext,
  user,
}) => {
  try {
    if (status === MAINTENANCE_STATUSES.IN_PROGRESS) {
      const context = inProgressContext || {
        vehicle: await vehicleService.getById(targetVehicleId),
        activeTrips: [],
      };
      await maintenanceNotificationService.notifyMaintenanceStarted({
        vehicle: context.vehicle,
        activeTrips: context.activeTrips,
        actor: user,
      });
      return;
    }

    if (
      status !== MAINTENANCE_STATUSES.COMPLETED &&
      status !== MAINTENANCE_STATUSES.CANCELLED
    ) {
      return;
    }

    const vehicle = await vehicleService.getById(targetVehicleId);
    if (status === MAINTENANCE_STATUSES.COMPLETED) {
      await maintenanceNotificationService.notifyMaintenanceCompleted({
        vehicle,
        log: newLog,
        actor: user,
      });
    } else {
      await maintenanceNotificationService.notifyMaintenanceExited({
        vehicle,
        log: newLog,
        actor: user,
      });
    }
  } catch (error) {
    logger.error(`[MAINTENANCE_NOTIFICATION] ${error.message}`, {
      stack: error.stack,
    });
  }
};

const createEvent = async (logId, eventData, user = null) => {
  const { status, cost, odometerReading } = eventData;
  const log = await getById(logId, user);
  const targetVehicleId = log.vehicleId?._id || log.vehicleId;

  validateStatusTransition(log.status, status);

  const session = await mongoose.startSession();
  session.startTransaction();

  let inProgressContext = null;

  try {
    const latestLog = await maintenanceLogRepository.findLatestByVehicle(
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
      inProgressContext = await handleMaintenanceInProgress(
        targetVehicleId,
        session,
      );
    }

    const newLog = await maintenanceLogRepository.create(payload, session);

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
    await notifyCommittedMaintenanceEvent({
      status,
      targetVehicleId,
      newLog,
      inProgressContext,
      user,
    });
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
  create,
  getAll,
  getById,
  getTotalCost,
  getTotalCostByVehicle,
  createEvent,
};
