import mongoose from "mongoose";

import Order from "./order.js";
import OrderTrackingLog from "./order_tracking_log.js";

const ORDER_POPULATE = [
  {
    path: "customerId",
    select: "userId gender walletBalance",
    populate: { path: "userId", select: "fullName phone email" },
  },
  {
    path: "goodCategory",
    select: "goodsCategoryName description",
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
  {
    path: "tripId",
    select:
      "tripCode type status plannedStart plannedEnd actualStart actualEnd",
    populate: [
      {
        path: "driverId",
        select: "driverCode",
        populate: { path: "userId", select: "fullName phone" },
      },
      {
        path: "vehicleId",
        select: "plateNumber capacityWeight capacityVolume",
      },
    ],
  },
];

const TRACKING_LOG_POPULATE = [
  {
    path: "tripId",
    select: "tripCode status",
  },
  {
    path: "changedBy",
    select: "fullName phone email",
  },
];

const create = (orderData, session = null) => {
  return Order.create([orderData], { session }).then((docs) => docs[0]);
};

const findAll = ({
  filter = {},
  skip = 0,
  limit = 10,
  sort = { createdAt: -1 },
} = {}) => {
  return Order.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate(ORDER_POPULATE)
    .lean();
};

const countAll = ({ filter = {} } = {}) => {
  return Order.countDocuments(filter);
};

const findIdsByWarehouseId = (warehouseId, tripIds = []) => {
  return Order.distinct("_id", {
    deletedAt: null,
    $and: [
      {
        $or: [
          { warehouseId },
          {
            tripId: { $in: tripIds },
            $or: [{ warehouseId: null }, { warehouseId: { $exists: false } }],
          },
        ],
      },
      { $or: [{ tripId: null }, { tripId: { $in: tripIds } }] },
    ],
  });
};

const countRouteMismatchesByTripId = (tripId, routeId) => {
  return Order.countDocuments({
    tripId,
    deletedAt: null,
    routeId: { $ne: routeId },
  });
};

const findById = (orderId, session = null) => {
  const query = Order.findById(orderId).populate(ORDER_POPULATE);
  if (session) {
    query.session(session);
  }
  return query.lean();
};

const findByCode = (orderCode) => {
  return Order.findOne({ orderCode }).populate(ORDER_POPULATE).lean();
};

const findByIds = (orderIds, session = null) => {
  const query = Order.find({ _id: { $in: orderIds } }).populate(ORDER_POPULATE);
  if (session) query.session(session);
  return query.lean();
};

const updateById = (orderId, updateData, session = null, conditions = {}) => {
  return Order.findOneAndUpdate({ ...conditions, _id: orderId }, updateData, {
    new: true,
    runValidators: true,
    session,
  })
    .populate(ORDER_POPULATE)
    .lean();
};

const recordFailureAttempt = (orderId, notes, session = null) => {
  const nextAttempts = {
    $add: [{ $ifNull: ["$deliveryAttempts", 0] }, 1],
  };
  const updates = {
    deliveryAttempts: nextAttempts,
    status: {
      $cond: [{ $gte: [nextAttempts, 3] }, "returned", "failed"],
    },
  };

  if (notes) {
    updates.notes = { $literal: notes };
  }

  return Order.findOneAndUpdate(
    {
      _id: orderId,
      status: { $nin: ["delivered", "returned", "cancelled"] },
    },
    [{ $set: updates }],
    { new: true, session },
  ).lean();
};

const updateMany = (filter, updateData, session = null) => {
  return Order.updateMany(filter, updateData, { session });
};

const claimForCodSettlement = (orderIds, conditions, session = null) => {
  return Order.updateMany(
    {
      _id: { $in: orderIds },
      ...conditions,
    },
    { $set: { codSettled: true } },
    { session },
  );
};

const releaseCodSettlement = (orderIds, session = null) => {
  return Order.updateMany(
    { _id: { $in: orderIds } },
    { $set: { codSettled: false } },
    { session },
  );
};

const deleteById = (orderId, session = null) => {
  return Order.findByIdAndUpdate(
    orderId,
    { deletedAt: new Date() },
    { new: true, session },
  );
};

const warehouseScopeStages = (warehouseId) =>
  warehouseId
    ? [
        {
          $lookup: {
            from: "trips",
            localField: "tripId",
            foreignField: "_id",
            as: "dashboardTrip",
          },
        },
        { $unwind: "$dashboardTrip" },
        {
          $lookup: {
            from: "drivers",
            localField: "dashboardTrip.driverId",
            foreignField: "_id",
            as: "dashboardDriver",
          },
        },
        { $unwind: "$dashboardDriver" },
        {
          $match: {
            "dashboardDriver.warehouseId": new mongoose.Types.ObjectId(
              warehouseId,
            ),
          },
        },
      ]
    : [];

const countByStatus = (filter = {}, warehouseId = null) => {
  return Order.aggregate([
    { $match: filter },
    ...warehouseScopeStages(warehouseId),
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalAmount: { $sum: "$totalAmount" },
        shippingFee: { $sum: "$shippingFee" },
        codAmount: { $sum: "$codAmount" },
        totalShippingFee: { $sum: "$shippingFee" },
        totalCodAmount: { $sum: "$codAmount" },
      },
    },
  ]);
};

const getRecentOrderTrends = (startDate, warehouseId = null) => {
  return Order.aggregate([
    {
      $match: {
        deletedAt: null,
        createdAt: { $gte: startDate },
      },
    },
    ...warehouseScopeStages(warehouseId),
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        count: { $sum: 1 },
        deliveredCount: {
          $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]);
};

// ==========================================
// ORDER TRACKING LOGS
// ==========================================

const createTrackingLog = (logData, session = null) => {
  return OrderTrackingLog.create([logData], { session }).then(
    (docs) => docs[0],
  );
};

const findTrackingLogsByOrderId = (
  orderId,
  { skip = 0, limit = 20, sort = { createdAt: -1 } } = {},
) => {
  return OrderTrackingLog.find({ orderId })
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate(TRACKING_LOG_POPULATE)
    .lean();
};

const findPublicTrackingLogsByOrderId = (
  orderId,
  { skip = 0, limit = 20, sort = { createdAt: -1 } } = {},
) => {
  return OrderTrackingLog.find({ orderId })
    .select("status createdAt -_id")
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .lean();
};

const countTrackingLogsByOrderId = (orderId) => {
  return OrderTrackingLog.countDocuments({ orderId });
};

const findByTripId = (
  tripId,
  { skip = 0, limit = 20, sort = { createdAt: -1 } } = {},
) => {
  return Order.find({ tripId, deletedAt: null })
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate(ORDER_POPULATE)
    .lean();
};

const countByTripId = (tripId, session = null) => {
  const query = Order.countDocuments({ tripId, deletedAt: null });
  if (session) query.session(session);
  return query;
};

const getLatestTrackingLogByOrderId = (orderId) => {
  return OrderTrackingLog.findOne({ orderId })
    .sort({ createdAt: -1 })
    .populate(TRACKING_LOG_POPULATE)
    .lean();
};

export default {
  // Order
  create,
  findAll,
  countAll,
  findIdsByWarehouseId,
  countRouteMismatchesByTripId,
  findById,
  findByCode,
  findByIds,
  findByTripId,
  countByTripId,
  updateById,
  recordFailureAttempt,
  updateMany,
  claimForCodSettlement,
  releaseCodSettlement,
  deleteById,
  countByStatus,
  getRecentOrderTrends,

  // Order Tracking Log
  createTrackingLog,
  findTrackingLogsByOrderId,
  findPublicTrackingLogsByOrderId,
  countTrackingLogsByOrderId,
  getLatestTrackingLogByOrderId,
};
