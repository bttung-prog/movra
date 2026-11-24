import mongoose from "mongoose";

import Trip from "./trip.js";
import Vehicle from "../vehicle/vehicle.js";
import Driver from "../driver/driver.js";

const TRIP_POPULATE = [
  {
    path: "vehicleId",
    select: "plateNumber capacityWeight capacityVolume warehouseId",
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

const countActiveByVehicleId = (vehicleId, session = null) => {
  const query = Trip.countDocuments({
    vehicleId,
    deletedAt: null,
    status: { $in: ["planned", "in_progress"] },
  });
  if (session) query.session(session);
  return query;
};

const findActiveByVehicleId = (vehicleId, session = null) => {
  const query = Trip.find({
    vehicleId,
    deletedAt: null,
    status: { $in: ["planned", "in_progress"] },
  }).select("tripCode status plannedStart plannedEnd warehouseId");
  if (session) query.session(session);
  return query.lean();
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

const findByIds = (tripIds = [], session = null) => {
  if (!Array.isArray(tripIds) || tripIds.length === 0) {
    return Promise.resolve([]);
  }

  const query = Trip.find({ _id: { $in: tripIds } })
    .select("tripCode totalOrder status type warehouseId driverId vehicleId")
    .populate({
      path: "vehicleId",
      select: "plateNumber capacityWeight capacityVolume warehouseId",
    })
    .populate({ path: "driverId", select: "warehouseId userId" });
  if (session) query.session(session);
  return query.lean();
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
  ).lean();
};

const setTotalOrders = (operations = [], session = null) => {
  if (!Array.isArray(operations) || operations.length === 0) {
    return Promise.resolve({ matchedCount: 0, modifiedCount: 0 });
  }

  return Trip.bulkWrite(operations, { session });
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
      $sort: {
        completedTrips: -1,
        "driver.rating": -1,
      },
    },
    { $limit: limit },
    {
      $project: {
        _id: 1,
        driverCode: "$driver.driverCode",
        name: "$user.fullName",
        phone: "$user.phone",
        rating: "$driver.rating",
        totalReviews: "$driver.totalReviews",
        completedTrips: 1,
      },
    },
  ]);
};

export default {
  create,
  findAll,
  countAll,
  countActiveByDriverId,
  countActiveByVehicleId,
  findActiveByVehicleId,
  findIdsByWarehouseId,
  findById,
  findByCode,
  findByIds,
  findOverlappingTrip,
  lockScheduleResources,
  updateById,
  setTotalOrder,
  setTotalOrders,
  deleteById,
  restoreById,
  countByStatus,
  getTopDriverPerformance,
};
