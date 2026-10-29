import PAYMENT_PURPOSES from "../../constants/paymentPurposes.js";

import Payment from "./payment.js";

const PAYMENT_POPULATE = [
  {
    path: "invoiceId",
    select:
      "invoiceCode totalAmount paidAmount remainingAmount status customerId dueDate",
    populate: {
      path: "customerId",
      select: "userId walletBalance",
      populate: { path: "userId", select: "fullName phone email" },
    },
  },
  {
    path: "orderId",
    select:
      "orderCode recipientName recipientPhone shippingFee codAmount totalAmount paymentStatus status",
  },
  {
    path: "codOrders.orderId",
    select:
      "orderCode recipientName recipientPhone shippingFee codAmount totalAmount paymentStatus status",
  },
  {
    path: "tripId",
    select: "tripCode status driverId vehicleId",
    populate: [
      {
        path: "driverId",
        select: "driverCode",
        populate: { path: "userId", select: "fullName phone" },
      },
    ],
  },
  {
    path: "customerId",
    select: "userId walletBalance totalSpent",
    populate: { path: "userId", select: "fullName phone email" },
  },
  {
    path: "driverId",
    select: "driverCode userId",
    populate: { path: "userId", select: "fullName phone" },
  },
  {
    path: "handledBy",
    select: "fullName phone email role",
  },
  {
    path: "refundDetails.refundedBy",
    select: "fullName phone email role",
  },
];

const create = (paymentData, session = null) => {
  return Payment.create([paymentData], { session }).then((docs) => docs[0]);
};

const findAll = ({
  filter = {},
  skip = 0,
  limit = 10,
  sort = { createdAt: -1 },
} = {}) => {
  return Payment.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate(PAYMENT_POPULATE)
    .lean();
};

const countAll = ({ filter = {} } = {}) => {
  return Payment.countDocuments(filter);
};

const findById = (id, session = null) => {
  const query = Payment.findById(id).populate(PAYMENT_POPULATE);
  if (session) {
    query.session(session);
  }
  return query;
};

const findByCode = (paymentCode) => {
  return Payment.findOne({ paymentCode }).populate(PAYMENT_POPULATE);
};

const updateById = (id, updateData, session = null, conditions = {}) => {
  return Payment.findOneAndUpdate({ _id: id, ...conditions }, updateData, {
    new: true,
    runValidators: true,
    session,
  }).populate(PAYMENT_POPULATE);
};

const findTopUpByReference = (paymentMethod, transactionReference) => {
  return Payment.exists({
    paymentMethod,
    transactionReference,
    $or: [
      { purpose: PAYMENT_PURPOSES.WALLET_TOP_UP },
      {
        purpose: { $exists: false },
        payerType: "customer",
        invoiceId: null,
        orderId: null,
      },
    ],
  });
};

const deleteById = (id, session = null) => {
  return Payment.findByIdAndDelete(id, { session });
};

const getStats = async (filter = {}) => {
  const byMethod = await Payment.aggregate([
    { $match: filter },
    {
      $group: {
        _id: "$paymentMethod",
        count: { $sum: 1 },
        totalAmount: { $sum: "$paymentAmount" },
      },
    },
  ]);

  const byStatus = await Payment.aggregate([
    { $match: filter },
    {
      $group: {
        _id: "$paymentStatus",
        count: { $sum: 1 },
        totalAmount: { $sum: "$paymentAmount" },
      },
    },
  ]);

  return {
    byMethod,
    byStatus,
  };
};

export default {
  create,
  findAll,
  countAll,
  findById,
  findByCode,
  updateById,
  findTopUpByReference,
  deleteById,
  getStats,
};
