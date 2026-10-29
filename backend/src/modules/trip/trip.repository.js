import mongoose from "mongoose";

import Trip from "./trip.js";
import TripTrackingLog from "./trip_tracking_log.js";
import TripAuditLog from "./trip_audit_log.js";
import TripExpense from "./trip_expenses.js";
import TripAssignment from "./trip_assignment.js";
import Vehicle from "../vehicle/vehicle.js";
import Driver from "../driver/driver.js";

const TRIP_POPULATE = [
  {
    path: "vehicleId",
    select: "plateNumber capacityWeight capacityVolume",
  },
  {
    path: "driverId",
    select: "driverCode idCardNumber warehouseId",
    populate: { path: "userId", select: "fullName phone" },
  },
  {
    path: "routeId",
    select:
      "originWarehouseId destinationWarehouseId distance expectedDuration",
    populate: [
      {
        path: "originWarehouseId",
        select: "warehouseName warehouseAddress status",
      },
      {
        path: "destinationWarehouseId",
        select: "warehouseName warehouseAddress status",
      },
    ],
  },
];

const create = (tripData, session = null) => {
  return Trip.create([tripData], { session }).then((docs) => docs[0]);
};

const findAll = ({
  filter = {},
  skip = 0,
  limit = 10,
  sort = { createdAt: -1 },
} = {}) => {
  return Trip.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate(TRIP_POPULATE)
    .lean();
};

const countAll = ({ filter = {} } = {}) => {
  return Trip.countDocuments(filter);
};

const countActiveByDriverId = (driverId) => {
  return Trip.countDocuments({
    driverId,
    deletedAt: null,
    status: { $in: ["planned", "in_progress"] },
  });
};

const findIdsByWarehouseId = (warehouseId, driverIds = [], vehicleIds = []) => {
  return Trip.distinct("_id", {
    deletedAt: null,
    $or: [
      { warehouseId },
      {
        warehouseId: null,
        driverId: { $in: driverIds },
        vehicleId: { $in: vehicleIds },
      },
    ],
  });
};

const findById = (tripId, session = null) => {
  const query = Trip.findById(tripId).populate(TRIP_POPULATE);
  if (session) query.session(session);
  return query.lean();
};

const findByCode = (tripCode) => {
  return Trip.findOne({ tripCode }).populate(TRIP_POPULATE).lean();
};

const findOverlappingTrip = ({
  vehicleId,
  driverId,
  plannedStart,
  plannedEnd,
  excludeTripId = null,
  session = null,
}) => {
  const filter = {
    deletedAt: null,
    status: { $in: ["planned", "in_progress"] },
    plannedStart: { $lt: new Date(plannedEnd) },
    plannedEnd: { $gt: new Date(plannedStart) },
  };

  if (excludeTripId) {
    filter._id = { $ne: excludeTripId };
  }

  const orConditions = [];
  if (vehicleId) orConditions.push({ vehicleId });
  if (driverId) orConditions.push({ driverId });

  if (orConditions.length > 0) {
    filter.$or = orConditions;
  }

  const query = Trip.findOne(filter);
  if (session) query.session(session);
  return query.lean();
};

const lockScheduleResources = async ({ vehicleId, driverId }, session) => {
  for (const [Model, resourceId] of [
    [Vehicle, vehicleId],
    [Driver, driverId],
  ]) {
    if (!resourceId) continue;

    const result = await Model.updateOne(
      { _id: resourceId },
      { $inc: { tripScheduleVersion: 1 } },
      { session, timestamps: false },
    );

    if (result.matchedCount !== 1) return false;
  }

  return true;
};

const updateById = (tripId, updateData, session = null) => {
  return Trip.findByIdAndUpdate(tripId, updateData, {
    new: true,
    runValidators: true,
    session,
  })
    .populate(TRIP_POPULATE)
    .lean();
};

const setTotalOrder = (tripId, totalOrder, session = null) => {
  return Trip.findByIdAndUpdate(
    tripId,
    { totalOrder },
    { new: true, runValidators: true, session },
  );
};

const deleteById = (tripId, session = null) => {
  return Trip.findByIdAndUpdate(
    tripId,
    { deletedAt: new Date() },
    { new: true, session },
  );
};

const restoreById = (tripId, session = null) => {
  return Trip.findByIdAndUpdate(
    tripId,
    { deletedAt: null },
    { new: true, session },
  );
};

const driverWarehouseStages = (warehouseId) =>
  warehouseId
    ? [
        {
          $lookup: {
            from: "drivers",
            localField: "driverId",
            foreignField: "_id",
            as: "dashboardDriver",
          },
        },
        { $unwind: "$dashboardDriver" },
        { $match: { "dashboardDriver.warehouseId": warehouseId } },
      ]
    : [];

const countByStatus = (filter = { deletedAt: null }, warehouseId = null) => {
  return Trip.aggregate([
    { $match: filter },
    ...driverWarehouseStages(warehouseId),
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);
};

const getTopDriverPerformance = ({ limit = 5, warehouseId = null } = {}) => {
  return Trip.aggregate([
    { $match: { status: "completed", deletedAt: null } },
    ...driverWarehouseStages(warehouseId),
    {
      $group: {
        _id: "$driverId",
        completedTrips: { $sum: 1 },
      },
    },
    { $sort: { completedTrips: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: "drivers",
        localField: "_id",
        foreignField: "_id",
        as: "driver",
      },
    },
    { $unwind: "$driver" },
    {
      $lookup: {
        from: "users",
        localField: "driver.userId",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1,
        driverCode: "$driver.driverCode",
        name: "$user.fullName",
        phone: "$user.phone",
        rating: "$driver.rating",
        completedTrips: 1,
      },
    },
  ]);
};

// ==========================================
// TRIP TRACKING LOGS
// ==========================================

const TRACKING_LOG_POPULATE = [
  {
    path: "reportedBy",
    select: "fullName phone",
  },
];

const createTrackingLog = (logData, session = null) => {
  return TripTrackingLog.create([logData], { session }).then((docs) => docs[0]);
};

const findTrackingLogsByTripId = (
  tripId,
  { skip = 0, limit = 20, sort = { createdAt: -1 } } = {},
) => {
  return TripTrackingLog.find({ tripId })
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate(TRACKING_LOG_POPULATE)
    .lean();
};

const countTrackingLogsByTripId = (tripId) => {
  return TripTrackingLog.countDocuments({ tripId });
};

const getLatestTrackingLogByTripId = (tripId) => {
  return TripTrackingLog.findOne({ tripId })
    .sort({ createdAt: -1 })
    .populate(TRACKING_LOG_POPULATE)
    .lean();
};

const createAuditLog = (logData, session = null) => {
  return TripAuditLog.create([logData], { session }).then((docs) => docs[0]);
};

const findAuditLogsByTripId = (tripId, { skip = 0, limit = 20 } = {}) => {
  return TripAuditLog.find({ tripId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate({ path: "performedBy", select: "fullName phone email" })
    .lean();
};

const countAuditLogsByTripId = (tripId) => {
  return TripAuditLog.countDocuments({ tripId });
};

const findTrackingLogById = (logId) => {
  return TripTrackingLog.findById(logId).populate(TRACKING_LOG_POPULATE).lean();
};

// ==========================================
// TRIP EXPENSES
// ==========================================

const EXPENSE_POPULATE = [
  {
    path: "createdBy",
    select: "fullName phone",
  },
];

const createExpense = (expenseData, session = null) => {
  return TripExpense.create([expenseData], { session }).then((docs) => docs[0]);
};

const findExpensesByTripId = (
  tripId,
  { skip = 0, limit = 20, sort = { createdAt: -1 } } = {},
) => {
  return TripExpense.find({ tripId })
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate(EXPENSE_POPULATE)
    .lean();
};

const countExpensesByTripId = (tripId) => {
  return TripExpense.countDocuments({ tripId });
};

const findExpenseById = (expenseId) => {
  return TripExpense.findById(expenseId).populate(EXPENSE_POPULATE).lean();
};

const calculateTotalExpensesByTripId = async (tripId) => {
  const result = await TripExpense.aggregate([
    {
      $match: {
        tripId: mongoose.Types.ObjectId.createFromHexString(String(tripId)),
      },
    },
    { $group: { _id: "$tripId", totalAmount: { $sum: "$expenseAmount" } } },
  ]);

  return result.length > 0 ? result[0].totalAmount : 0;
};

const updateExpenseById = (expenseId, updateData, session = null) => {
  return TripExpense.findByIdAndUpdate(expenseId, updateData, {
    new: true,
    runValidators: true,
    session,
  })
    .populate(EXPENSE_POPULATE)
    .lean();
};

const deleteExpenseById = (expenseId, session = null) => {
  return TripExpense.findByIdAndDelete(expenseId, { session });
};

// ==========================================
// TRIP ASSIGNMENTS (CHANGE DRIVER / VEHICLE LOGS)
// ==========================================

const ASSIGNMENT_POPULATE = [
  {
    path: "oldVehicleId",
    select: "plateNumber capacityWeight capacityVolume",
  },
  {
    path: "newVehicleId",
    select: "plateNumber capacityWeight capacityVolume",
  },
  {
    path: "oldDriverId",
    select: "driverCode idCardNumber",
    populate: { path: "userId", select: "fullName phone" },
  },
  {
    path: "newDriverId",
    select: "driverCode idCardNumber",
    populate: { path: "userId", select: "fullName phone" },
  },
  {
    path: "changedBy",
    select: "fullName phone",
  },
];

const createAssignment = (assignmentData, session = null) => {
  return TripAssignment.create([assignmentData], { session }).then(
    (docs) => docs[0],
  );
};

const findAssignmentsByTripId = (
  tripId,
  { skip = 0, limit = 20, sort = { createdAt: -1 } } = {},
) => {
  return TripAssignment.find({ tripId })
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate(ASSIGNMENT_POPULATE)
    .lean();
};

const countAssignmentsByTripId = (tripId) => {
  return TripAssignment.countDocuments({ tripId });
};

const findAssignmentById = (assignmentId) => {
  return TripAssignment.findById(assignmentId)
    .populate(ASSIGNMENT_POPULATE)
    .lean();
};

export default {
  // Trip methods
  create,
  findAll,
  countAll,
  countActiveByDriverId,
  findIdsByWarehouseId,
  findById,
  findByCode,
  findOverlappingTrip,
  lockScheduleResources,
  updateById,
  setTotalOrder,
  deleteById,
  restoreById,
  countByStatus,
  getTopDriverPerformance,

  // Trip Tracking Log methods
  createTrackingLog,
  findTrackingLogsByTripId,
  countTrackingLogsByTripId,
  getLatestTrackingLogByTripId,
  createAuditLog,
  findAuditLogsByTripId,
  countAuditLogsByTripId,
  findTrackingLogById,

  // Trip Expense methods
  createExpense,
  findExpensesByTripId,
  countExpensesByTripId,
  findExpenseById,
  calculateTotalExpensesByTripId,
  updateExpenseById,
  deleteExpenseById,

  // Trip Assignment methods
  createAssignment,
  findAssignmentsByTripId,
  countAssignmentsByTripId,
  findAssignmentById,
};
