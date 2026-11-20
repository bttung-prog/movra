import { MAINTENANCE_STATUSES } from "../../constants/maintenanceStatuses.js";

import MaintenanceLog from "./maintenance_log.js";

const create = (logData, session = null) => {
  return MaintenanceLog.create([logData], { session }).then((docs) => docs[0]);
};

const findAll = ({ filter = {}, skip, limit }) => {
  return MaintenanceLog.find(filter)
    .populate("vehicleId")
    .sort({ createdAt: -1, _id: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

const countAll = (filter = {}) => {
  return MaintenanceLog.countDocuments(filter);
};

const findById = (logId) => {
  return MaintenanceLog.findById(logId).lean();
};

const findLatestByVehicle = (vehicleId, session = null) => {
  return MaintenanceLog.findOne({ vehicleId })
    .sort({ createdAt: -1, _id: -1 })
    .session(session)
    .lean();
};

const totalCost = (startDate, endDate, vehicleIds = null) => {
  return MaintenanceLog.aggregate([
    {
      $match: {
        status: MAINTENANCE_STATUSES.COMPLETED,
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
        status: MAINTENANCE_STATUSES.COMPLETED,
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
  create,
  findAll,
  countAll,
  findById,
  findLatestByVehicle,
  totalCost,
  totalCostByVehicle,
};
