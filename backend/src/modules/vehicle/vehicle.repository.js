import mongoose from "mongoose";

import Vehicle from "./vehicle.js";
import VehicleType from "./vehicle_type.js";
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

const createType = (data) => {
  return VehicleType.create(data);
};

const findActiveTypes = ({ skip, limit }) => {
  return VehicleType.find({ deletedAt: null })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

const countActiveTypes = () => {
  return VehicleType.countDocuments({ deletedAt: null });
};

const findDeletedTypes = ({ skip, limit }) => {
  return VehicleType.find({ deletedAt: { $ne: null } })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

const countDeletedTypes = () => {
  return VehicleType.countDocuments({ deletedAt: { $ne: null } });
};

const findTypeById = (vehicleTypeId) => {
  return VehicleType.findById(vehicleTypeId).lean();
};

const findTypeByName = (vehicleTypeName) => {
  return VehicleType.findOne({ name: vehicleTypeName }).lean();
};

const updateType = (vehicleTypeId, updateData) => {
  return VehicleType.findByIdAndUpdate(vehicleTypeId, updateData, {
    new: true,
    runValidators: true,
  });
};

const deleteType = (vehicleTypeId) => {
  return VehicleType.findByIdAndUpdate(
    vehicleTypeId,
    { deletedAt: new Date() },
    { new: true },
  );
};

const restoreType = (vehicleTypeId) => {
  return VehicleType.findByIdAndUpdate(
    vehicleTypeId,
    { deletedAt: null },
    { new: true },
  );
};

const create = (data) => {
  return Vehicle.create(data);
};

const findAll = ({ filter = {}, skip, limit }) => {
  return Vehicle.find(filter)
    .populate("vehicleTypeId", "name")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

const countAll = (filter = {}) => {
  return Vehicle.countDocuments(filter);
};

const findIds = (filter = {}) => {
  return Vehicle.distinct("_id", filter);
};

const findById = (vehicleId) => {
  return Vehicle.findById(vehicleId).lean();
};

const findByPlateNumber = (plateNumber) => {
  return Vehicle.findOne({ plateNumber }).lean();
};

const findExpiredRegistration = ({ date, skip, limit }) => {
  return Vehicle.find({ registrationExpiryDate: { $lt: date } })
    .sort({ registrationExpiryDate: 1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

const countExpiredRegistration = ({ date }) => {
  return Vehicle.countDocuments({ registrationExpiryDate: { $lt: date } });
};

const findExpiredInsurance = ({ date, skip, limit }) => {
  return Vehicle.find({ insuranceExpiryDate: { $lt: date } })
    .sort({ insuranceExpiryDate: 1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

const countExpiredInsurance = ({ date }) => {
  return Vehicle.countDocuments({ insuranceExpiryDate: { $lt: date } });
};

const updateById = (vehicleId, updateData, session = null) => {
  return Vehicle.findByIdAndUpdate(vehicleId, updateData, {
    new: true,
    runValidators: true,
    session,
  });
};

const setWarehouseIdIfUnassigned = (vehicleId, warehouseId, session = null) => {
  return Vehicle.findOneAndUpdate(
    { _id: vehicleId, warehouseId: null },
    { $set: { warehouseId } },
    { new: true, runValidators: true, session },
  ).lean();
};

const countByStatus = (filter = {}, warehouseId = null) => {
  return Vehicle.aggregate([
    { $match: filter },
    ...(warehouseId
      ? [
          {
            $lookup: {
              from: "drivers",
              localField: "_id",
              foreignField: "currentVehicleId",
              as: "dashboardDriver",
            },
          },
          { $unwind: "$dashboardDriver" },
          { $match: { "dashboardDriver.warehouseId": warehouseId } },
        ]
      : []),
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);
};

// ==========================================
// VEHICLE USAGE LOGS
// ==========================================

const createUsageLog = (logData, session = null) => {
  return VehicleUsageLog.create([logData], { session }).then((docs) => docs[0]);
};

const findUsageLogs = ({
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

const countUsageLogs = (filter = {}) => {
  return VehicleUsageLog.countDocuments(filter);
};

const countOpenUsageLogsByVehicleId = (vehicleId, session = null) => {
  const query = VehicleUsageLog.countDocuments({
    vehicleId,
    deletedAt: null,
    endOdo: null,
  });
  if (session) query.session(session);
  return query;
};

const findUsageLogById = (logId) => {
  return VehicleUsageLog.findById(logId).populate(USAGE_LOG_POPULATE).lean();
};

const findUsageLogsByVehicleId = (
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

const countUsageLogsByVehicleId = (vehicleId, filter = {}) => {
  return VehicleUsageLog.countDocuments({ vehicleId, ...filter });
};

const findUsageLogsByDriverId = (
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

const countUsageLogsByDriverId = (driverId, filter = {}) => {
  return VehicleUsageLog.countDocuments({ driverId, ...filter });
};

const findUsageLogsByTripId = (tripId, filter = {}) => {
  return VehicleUsageLog.find({ tripId, ...filter })
    .populate(USAGE_LOG_POPULATE)
    .lean();
};

const aggregateVehicleUsageStats = async (vehicleId, matchFilter = {}) => {
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

const updateUsageLogById = (logId, updateData, session = null) => {
  return VehicleUsageLog.findByIdAndUpdate(logId, updateData, {
    new: true,
    runValidators: true,
    session,
  })
    .populate(USAGE_LOG_POPULATE)
    .lean();
};

const deleteUsageLogById = (logId, session = null) => {
  return VehicleUsageLog.findByIdAndUpdate(
    logId,
    { deletedAt: new Date() },
    { new: true, session },
  );
};

const restoreUsageLogById = (logId, session = null) => {
  return VehicleUsageLog.findByIdAndUpdate(
    logId,
    { deletedAt: null },
    { new: true, session },
  );
};

export default {
  // Vehicle Type
  createType,
  findActiveTypes,
  countActiveTypes,
  findDeletedTypes,
  countDeletedTypes,
  findTypeById,
  findTypeByName,
  updateType,
  deleteType,
  restoreType,

  // Vehicle Core
  create,
  findAll,
  countAll,
  findIds,
  findById,
  findByPlateNumber,
  findExpiredRegistration,
  countExpiredRegistration,
  findExpiredInsurance,
  countExpiredInsurance,
  updateById,
  setWarehouseIdIfUnassigned,
  countByStatus,

  // Vehicle Usage Logs
  createUsageLog,
  findUsageLogs,
  countUsageLogs,
  countOpenUsageLogsByVehicleId,
  findUsageLogById,
  findUsageLogsByVehicleId,
  countUsageLogsByVehicleId,
  findUsageLogsByDriverId,
  countUsageLogsByDriverId,
  findUsageLogsByTripId,
  aggregateVehicleUsageStats,
  updateUsageLogById,
  deleteUsageLogById,
  restoreUsageLogById,
};
