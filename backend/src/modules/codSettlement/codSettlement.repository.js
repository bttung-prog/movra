import CodSettlement from "./codSettlement.js";

const SETTLEMENT_POPULATE = [
  {
    path: "customerId",
    select: "userId walletBalance totalSpent",
    populate: { path: "userId", select: "fullName phone email" },
  },
  {
    path: "orderId",
    select:
      "orderCode recipientName recipientPhone codAmount codCollected codCollectedAmount codRemittedAmount shippingFee paymentStatus status deliveredAt",
  },
  {
    path: "handledBy",
    select: "fullName phone email role",
  },
];

const create = (data, session = null) => {
  return CodSettlement.create([data], { session }).then((docs) => docs[0]);
};

const findAll = ({
  filter = {},
  skip = 0,
  limit = 10,
  sort = { createdAt: -1 },
} = {}) => {
  return CodSettlement.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate(SETTLEMENT_POPULATE)
    .lean();
};

const countAll = ({ filter = {} } = {}) => {
  return CodSettlement.countDocuments(filter);
};

const findById = (id, session = null) => {
  const query = CodSettlement.findById(id).populate(SETTLEMENT_POPULATE);
  if (session) {
    query.session(session);
  }
  return query;
};

const findByCode = (settlementCode) => {
  return CodSettlement.findOne({ settlementCode }).populate(
    SETTLEMENT_POPULATE,
  );
};

const findByOrderId = (orderId) => {
  return CodSettlement.findOne({
    orderId,
    status: { $in: ["draft", "confirmed", "completed"] },
  }).lean();
};

const updateById = (id, updateData, session = null, conditions = {}) => {
  return CodSettlement.findOneAndUpdate(
    { ...conditions, _id: id },
    updateData,
    { new: true, runValidators: true, session },
  ).populate(SETTLEMENT_POPULATE);
};

export default {
  create,
  findAll,
  countAll,
  findById,
  findByCode,
  findByOrderId,
  updateById,
};
