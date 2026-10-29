import MaintenanceSchedule from "./maintenance_schedule.js";
import MaintenanceLog from "./maintenance_log.js";

const createSchedule = (scheduleData) => {
  return MaintenanceSchedule.create(scheduleData);
};

const findAllSchedules = ({ filter = {}, skip, limit }) => {
  return MaintenanceSchedule.find(filter)
    .populate("vehicleId")
    .skip(skip)
    .limit(limit)
    .lean();
};

const countAllSchedules = (filter = {}) => {
  return MaintenanceSchedule.countDocuments(filter);
};

const findScheduleById = (scheduleId) => {
  return MaintenanceSchedule.findById(scheduleId).lean();
};

const findSchedulesByVehicleId = ({ vehicleId, filter = {}, skip, limit }) => {
  return MaintenanceSchedule.find({ vehicleId, ...filter })
    .populate("vehicleId")
    .skip(skip)
    .limit(limit)
    .sort({ nextDueDate: 1 })
    .lean();
};

const countSchedulesByVehicleId = (vehicleId, filter = {}) => {
  return MaintenanceSchedule.countDocuments({ vehicleId, ...filter });
};

const getUpcomingMaintenances = (targetDate, vehicleIds = null) => {
  return MaintenanceSchedule.find({
    isActive: true,
    deletedAt: null,
    nextDueDate: { $lte: targetDate },
    ...(vehicleIds ? { vehicleId: { $in: vehicleIds } } : {}),
  })
    .populate("vehicleId", "plateNumber brand model")
    .sort({ nextDueDate: 1 })
    .lean();
};

const updateSchedule = (scheduleId, updateData, session = null) => {
  return MaintenanceSchedule.findByIdAndUpdate(scheduleId, updateData, {
    new: true,
    runValidators: true,
    session,
  });
};

const deleteSchedule = (scheduleId, session = null) => {
  return MaintenanceSchedule.findByIdAndUpdate(
    scheduleId,
    { deletedAt: new Date(), isActive: false },
    { new: true, session },
  );
};

const restoreSchedule = (scheduleId, session = null) => {
  return MaintenanceSchedule.findByIdAndUpdate(
    scheduleId,
    { deletedAt: null, isActive: true },
    { new: true, session },
  );
};

const createLog = (logData, session = null) => {
  return MaintenanceLog.create([logData], { session }).then((docs) => docs[0]);
};

const findLogs = ({ filter = {}, skip, limit }) => {
  return MaintenanceLog.find(filter)
    .populate("vehicleId")
    .sort({ createdAt: -1, _id: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

const countAllLogs = (filter = {}) => {
  return MaintenanceLog.countDocuments(filter);
};

const findLogById = (logId) => {
  return MaintenanceLog.findById(logId).lean();
};

const findLatestLogByVehicle = (vehicleId, session = null) => {
  return MaintenanceLog.findOne({ vehicleId })
    .sort({ createdAt: -1, _id: -1 })
    .session(session)
    .lean();
};

const totalCost = (startDate, endDate, vehicleIds = null) => {
  return MaintenanceLog.aggregate([
    {
      $match: {
        status: "completed",
        ...(vehicleIds ? { vehicleId: { $in: vehicleIds } } : {}),
        startDate: {
          $gte: startDate,
          $lte: endDate,
        },
      },
    },
    {
      $group: {
        _id: null,
        totalCost: { $sum: "$cost" },
      },
    },
  ]);
};

const totalCostByVehicle = (vehicleId, startDate, endDate) => {
  return MaintenanceLog.aggregate([
    {
      $match: {
        status: "completed",
        vehicleId: {
          $eq: vehicleId,
        },
        startDate: {
          $gte: startDate,
          $lte: endDate,
        },
      },
    },
    {
      $group: {
        _id: null,
        totalCost: { $sum: "$cost" },
      },
    },
  ]);
};

export default {
  createSchedule,
  findAllSchedules,
  countAllSchedules,
  findScheduleById,
  findSchedulesByVehicleId,
  countSchedulesByVehicleId,
  getUpcomingMaintenances,
  updateSchedule,
  deleteSchedule,
  restoreSchedule,

  createLog,
  findLogs,
  countAllLogs,
  findLogById,
  findLatestLogByVehicle,
  totalCost,
  totalCostByVehicle,
};
