import WalletTransaction from "./walletTransaction.js";

const WALLET_POPULATE = [
  {
    path: "customerId",
    select: "userId walletBalance totalSpent",
    populate: { path: "userId", select: "fullName phone email" },
  },
  {
    path: "paymentId",
    select: "paymentCode paymentAmount paymentMethod paymentStatus",
  },
  {
    path: "orderId",
    select: "orderCode totalAmount paymentStatus",
  },
  {
    path: "settlementId",
    select: "settlementCode status netPayoutAmount settledAt",
  },
  {
    path: "handledBy",
    select: "fullName phone email role",
  },
];

const create = (data, session = null) => {
  return WalletTransaction.create([data], { session }).then((docs) => docs[0]);
};

const findAll = ({
  filter = {},
  skip = 0,
  limit = 10,
  sort = { createdAt: -1 },
} = {}) => {
  return WalletTransaction.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate(WALLET_POPULATE)
    .lean();
};

const countAll = ({ filter = {} } = {}) => {
  return WalletTransaction.countDocuments(filter);
};

const findById = (id, session = null) => {
  const query = WalletTransaction.findById(id).populate(WALLET_POPULATE);
  if (session) {
    query.session(session);
  }
  return query;
};

const findByCode = (transactionCode) => {
  return WalletTransaction.findOne({ transactionCode }).populate(
    WALLET_POPULATE,
  );
};

export default {
  create,
  findAll,
  countAll,
  findById,
  findByCode,
};
