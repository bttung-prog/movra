import mongoose from "mongoose";

import VehicleUsageLog from "./vehicle_usage_log.js";

const USAGE_LOG_POPULATE = [
  {
    path: "vehicleId",
    select: "plateNumber capacityWeight capacityVolume currentOdometer status",
  },
  {
    path: "driverId",
    select: "driverCode licenseType",
    populate: { path: "userId", select: "fullName phone" },
  },
  {
    path: "tripId",
    select:
      "tripCode status plannedStart plannedEnd actualStart actualEnd totalDistance",
  },
];

const create = (logData, session = null) => {
  return VehicleUsageLog.create([logData], { session }).then((docs) => docs[0]);
};

const find = ({
  filter = {},
  skip = 0,
  limit = 10,
  sort = { createdAt: -1 },
} = {}) => {
  return VehicleUsageLog.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate(USAGE_LOG_POPULATE)
    .lean();
};

const count = (filter = {}) => {
  return VehicleUsageLog.countDocuments(filter);
};

const countOpenByVehicleId = (vehicleId, session = null) => {
  const query = VehicleUsageLog.countDocuments({
    vehicleId,
    deletedAt: null,
    endOdo: null,
  });
  if (session) query.session(session);
  return query;
};

const findById = (logId) => {
  return VehicleUsageLog.findById(logId).populate(USAGE_LOG_POPULATE).lean();
};

const findByVehicleId = (
  vehicleId,
  { filter = {}, skip = 0, limit = 20, sort = { createdAt: -1 } } = {},
) => {
  return VehicleUsageLog.find({ vehicleId, ...filter })
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate(USAGE_LOG_POPULATE)
    .lean();
};

const countByVehicleId = (vehicleId, filter = {}) => {
  return VehicleUsageLog.countDocuments({ vehicleId, ...filter });
};

const findByDriverId = (
  driverId,
  { filter = {}, skip = 0, limit = 20, sort = { createdAt: -1 } } = {},
) => {
  return VehicleUsageLog.find({ driverId, ...filter })
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate(USAGE_LOG_POPULATE)
    .lean();
};

const countByDriverId = (driverId, filter = {}) => {
  return VehicleUsageLog.countDocuments({ driverId, ...filter });
};

const findByTripId = (tripId, filter = {}) => {
  return VehicleUsageLog.find({ tripId, ...filter })
    .populate(USAGE_LOG_POPULATE)
    .lean();
};

const aggregateStats = async (vehicleId, matchFilter = {}) => {
  const match = {
    vehicleId: new mongoose.Types.ObjectId(String(vehicleId)),
    ...matchFilter,
  };

  const result = await VehicleUsageLog.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$vehicleId",
        totalLogs: { $sum: 1 },
        totalFuelConsumed: { $sum: "$fuelConsumed" },
        totalDistance: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ["$endOdo", null] },
                  { $gte: ["$endOdo", "$startOdo"] },
                ],
              },
              { $subtract: ["$endOdo", "$startOdo"] },
              0,
            ],
          },
        },
        minStartOdo: { $min: "$startOdo" },
        maxEndOdo: { $max: "$endOdo" },
      },
    },
  ]);

  return (
    result[0] || {
      _id: vehicleId,
      totalLogs: 0,
      totalFuelConsumed: 0,
      totalDistance: 0,
      minStartOdo: 0,
      maxEndOdo: 0,
    }
  );
};

const updateById = (logId, updateData, session = null) => {
  return VehicleUsageLog.findByIdAndUpdate(logId, updateData, {
    new: true,
    runValidators: true,
    session,
  })
    .populate(USAGE_LOG_POPULATE)
    .lean();
};

const deleteById = (logId, session = null) => {
  return VehicleUsageLog.findByIdAndUpdate(
    logId,
    { deletedAt: new Date() },
    { new: true, session },
  );
};

const restoreById = (logId, session = null) => {
  return VehicleUsageLog.findByIdAndUpdate(
    logId,
    { deletedAt: null },
    { new: true, session },
  );
};

export default {
  create,
  find,
  count,
  countOpenByVehicleId,
  findById,
  findByVehicleId,
  countByVehicleId,
  findByDriverId,
  countByDriverId,
  findByTripId,
  aggregateStats,
  updateById,
  deleteById,
  restoreById,
};
