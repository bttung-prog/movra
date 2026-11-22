import mongoose from "mongoose";

import { ORDER_STATUSES } from "../../constants/orderStatuses.js";
import { TRIP_TYPES } from "../../constants/tripTypes.js";
import Order from "./order.js";

const ORDER_POPULATE = [
  {
    path: "customerId",
    select:
      "userId companyName taxCode creditLimit defaultPaymentTerms walletBalance",
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

const findIdsByWarehouseId = (warehouseId) => {
  return Order.distinct("_id", {
    deletedAt: null,
    warehouseId,
  });
};

const countAccessibleOrdersByWarehouse = (orderIds = [], warehouseId) => {
  if (!orderIds.length || !warehouseId) return 0;
  return Order.countDocuments({
    _id: { $in: orderIds },
    deletedAt: null,
    $or: [{ warehouseId }, { destinationWarehouseId: warehouseId }],
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

const findOrdersForRemittance = (orderIds = [], session = null) => {
  const query = Order.find({
    _id: { $in: orderIds },
    deletedAt: null,
  })
    .select(
      "_id orderCode status codSettled codAmount codCollectedAmount codRemittedAmount tripId warehouseId destinationWarehouseId",
    )
    .populate({
      path: "tripId",
      select: "_id driverId",
    });

  if (session) {
    query.session(session);
  }

  return query.lean();
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

const findLoadsByTripId = (tripId, session = null) => {
  if (!tripId) return Promise.resolve([]);
  const query = Order.find(
    { tripId, deletedAt: null },
    "_id weight volume quantity",
  ).lean();
  if (session) query.session(session);
  return query;
};

const findRawByFilter = (filter, session = null) => {
  const query = Order.find(filter).lean();
  if (session) query.session(session);
  return query;
};

const findBillableByCustomer = ({
  customerId,
  fromDate,
  toDate,
  excludeOrderIds = [],
}) => {
  const filter = {
    customerId,
    deletedAt: null,
    status: { $ne: ORDER_STATUSES.CANCELLED },
    shippingFeePaid: { $ne: true },
    createdAt: { $gte: new Date(fromDate), $lte: new Date(toDate) },
  };

  if (excludeOrderIds.length > 0) {
    filter._id = { $nin: excludeOrderIds };
  }

  return Order.find(filter).sort({ createdAt: 1, _id: 1 }).lean();
};

const countUnfinishedOrdersByTrip = (tripId, tripType, session = null) => {
  const filter = {
    tripId,
    deletedAt: null,
  };

  if (tripType === TRIP_TYPES.PICKUP) {
    filter.status = {
      $in: [
        ORDER_STATUSES.CREATED,
        ORDER_STATUSES.DRIVER_ASSIGNED,
        ORDER_STATUSES.PICKUP_SCHEDULED,
      ],
    };
  } else {
    filter.status = {
      $nin: [
        ORDER_STATUSES.DELIVERED,
        ORDER_STATUSES.FAILED,
        ORDER_STATUSES.RETURNED,
        ORDER_STATUSES.CANCELLED,
      ],
    };
  }

  const query = Order.countDocuments(filter);
  if (session) query.session(session);
  return query;
};

const sumUnbilledShippingFeeByCustomer = async (
  customerId,
  excludedOrderIds = [],
) => {
  const filter = {
    customerId: mongoose.Types.ObjectId.createFromHexString(String(customerId)),
    deletedAt: null,
    status: { $ne: ORDER_STATUSES.CANCELLED },
    shippingFeePaid: { $ne: true },
  };

  if (excludedOrderIds.length > 0) {
    filter._id = { $nin: excludedOrderIds };
  }

  const remainingShippingFee = {
    $subtract: ["$shippingFee", { $ifNull: ["$shippingFeePaidAmount", 0] }],
  };

  const [result] = await Order.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        total: {
          $sum: {
            $cond: [
              { $gt: [remainingShippingFee, 0] },
              remainingShippingFee,
              0,
            ],
          },
        },
      },
    },
  ]);

  return Number(result?.total || 0);
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

const bulkWrite = (operations = [], session = null) => {
  return Order.bulkWrite(operations, { session });
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
            "dashboardDriver.warehouseId":
              mongoose.Types.ObjectId.createFromHexString(String(warehouseId)),
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

export default {
  create,
  findAll,
  countAll,
  findIdsByWarehouseId,
  countAccessibleOrdersByWarehouse,
  countRouteMismatchesByTripId,
  findById,
  findByCode,
  findByIds,
  findOrdersForRemittance,
  findByTripId,
  countByTripId,
  findLoadsByTripId,
  findRawByFilter,
  findBillableByCustomer,
  countUnfinishedOrdersByTrip,
  sumUnbilledShippingFeeByCustomer,
  updateById,
  recordFailureAttempt,
  updateMany,
  claimForCodSettlement,
  releaseCodSettlement,
  deleteById,
  bulkWrite,
  countByStatus,
  getRecentOrderTrends,
};
