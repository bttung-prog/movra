import Invoice from "./invoice.js";

import INVOICE_STATUSES from "../../constants/invoiceStatuses.js";

const INVOICE_POPULATE = [
  {
    path: "customerId",
    select: "userId gender walletBalance totalSpent",
    populate: { path: "userId", select: "fullName phone email" },
  },
  {
    path: "orderId",
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

const findIdsByOrderIds = (orderIds = []) => {
  return Invoice.distinct("_id", { orderId: { $in: orderIds } });
};

const findById = (id, session = null) => {
  const query = Invoice.findById(id).populate(INVOICE_POPULATE);
  if (session) {
    query.session(session);
  }
  return query;
};

const findByCode = (invoiceCode) => {
  return Invoice.findOne({ invoiceCode }).populate(INVOICE_POPULATE);
};

const findByOrderId = (orderId) => {
  return Invoice.findOne({
    orderId,
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

export default {
  create,
  findAll,
  countAll,
  findIdsByOrderIds,
  findById,
  findByCode,
  findByOrderId,
  updateById,
  deleteById,
  getStats,
};
