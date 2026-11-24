import mongoose from "mongoose";

import Invoice from "./invoice.js";

import { INVOICE_STATUSES } from "../../constants/invoiceStatuses.js";

const INVOICE_POPULATE = [
  {
    path: "customerId",
    select:
      "userId companyName taxCode companyAddress creditLimit defaultPaymentTerms walletBalance totalSpent",
    populate: { path: "userId", select: "fullName phone email" },
  },
  {
    path: "orderIds",
    select:
      "orderCode recipientName recipientPhone shippingFee codAmount totalAmount status paymentStatus",
  },
  {
    path: "issuedBy",
    select: "fullName phone email role",
  },
];

const create = (invoiceData, session = null) => {
  return Invoice.create([invoiceData], { session }).then((docs) => docs[0]);
};

const findAll = ({
  filter = {},
  skip = 0,
  limit = 10,
  sort = { createdAt: -1 },
} = {}) => {
  return Invoice.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate(INVOICE_POPULATE)
    .lean();
};

const countAll = ({ filter = {} } = {}) => {
  return Invoice.countDocuments(filter);
};

const findActiveOrderLinksByCustomer = (customerId) => {
  return Invoice.find({
    customerId,
    status: { $ne: INVOICE_STATUSES.CANCELLED },
    "orderIds.0": { $exists: true },
  })
    .select("orderIds")
    .lean();
};

const findActiveByOrderIds = (orderIds = []) => {
  return Invoice.findOne({
    orderIds: { $in: orderIds },
    status: { $ne: INVOICE_STATUSES.CANCELLED },
  })
    .select("invoiceCode orderIds status")
    .lean();
};

const sumOutstandingByCustomer = async (customerId) => {
  const [result] = await Invoice.aggregate([
    {
      $match: {
        customerId: mongoose.Types.ObjectId.createFromHexString(
          String(customerId),
        ),
        status: {
          $in: [
            INVOICE_STATUSES.ISSUED,
            INVOICE_STATUSES.PARTIALLY_PAID,
            INVOICE_STATUSES.OVERDUE,
          ],
        },
      },
    },
    {
      $group: {
        _id: null,
        total: {
          $sum: {
            $cond: [{ $gt: ["$remainingAmount", 0] }, "$remainingAmount", 0],
          },
        },
      },
    },
  ]);

  return Number(result?.total || 0);
};

const findById = (id, session = null) => {
  const query = Invoice.findById(id).populate(INVOICE_POPULATE);
  if (session) {
    query.session(session);
  }
  return query;
};

const findByIds = (ids = [], session = null) => {
  if (!Array.isArray(ids) || ids.length === 0) {
    return Promise.resolve([]);
  }

  const query = Invoice.find({ _id: { $in: ids } }).populate(INVOICE_POPULATE);
  if (session) query.session(session);
  return query.lean();
};

const findByCode = (invoiceCode) => {
  return Invoice.findOne({ invoiceCode }).populate(INVOICE_POPULATE);
};

const findByOrderId = (orderId) => {
  return Invoice.findOne({
    orderIds: orderId,
    status: { $ne: INVOICE_STATUSES.CANCELLED },
  }).populate(INVOICE_POPULATE);
};

const updateById = (id, updateData, session = null, conditions = {}) => {
  return Invoice.findOneAndUpdate({ _id: id, ...conditions }, updateData, {
    new: true,
    runValidators: true,
    session,
  }).populate(INVOICE_POPULATE);
};

const updateMany = (filter = {}, updateData = {}, session = null) => {
  return Invoice.updateMany(filter, updateData, { session });
};

const deleteById = (id, session = null) => {
  return Invoice.findByIdAndDelete(id, { session });
};

const getStats = async (filter = {}) => {
  const result = await Invoice.aggregate([
    { $match: filter },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalAmount: { $sum: "$totalAmount" },
        paidAmount: { $sum: "$paidAmount" },
        remainingAmount: { $sum: "$remainingAmount" },
      },
    },
  ]);

  return result;
};

const findOverdueCandidates = (cutoffDate = new Date()) => {
  return Invoice.find({
    status: {
      $in: [INVOICE_STATUSES.ISSUED, INVOICE_STATUSES.PARTIALLY_PAID],
    },
    dueDate: { $lt: cutoffDate },
  }).populate(INVOICE_POPULATE);
};

const markOverdueInvoices = (cutoffDate = new Date()) => {
  return Invoice.updateMany(
    {
      status: {
        $in: [INVOICE_STATUSES.ISSUED, INVOICE_STATUSES.PARTIALLY_PAID],
      },
      dueDate: { $lt: cutoffDate },
    },
    { $set: { status: INVOICE_STATUSES.OVERDUE } },
  );
};

export default {
  create,
  findAll,
  countAll,
  findActiveOrderLinksByCustomer,
  findActiveByOrderIds,
  sumOutstandingByCustomer,
  findById,
  findByIds,
  findByCode,
  findByOrderId,
  updateById,
  updateMany,
  deleteById,
  getStats,
  findOverdueCandidates,
  markOverdueInvoices,
};
