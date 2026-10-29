import FailureReason from "./failure_reason.js";

const FAILURE_LOG_POPULATE = [
  {
    path: "orderId",
    select:
      "orderCode senderName senderPhone recipientName recipientPhone status totalAmount",
  },
  {
    path: "tripId",
    select: "tripCode status",
  },
  {
    path: "reportedBy",
    select: "fullName phone email",
  },
];

const create = (reasonData, session = null) => {
  return FailureReason.create([reasonData], { session }).then(
    (docs) => docs[0],
  );
};

const findAll = ({
  filter = {},
  skip = 0,
  limit = 20,
  sort = { createdAt: -1 },
} = {}) => {
  return FailureReason.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate(FAILURE_LOG_POPULATE)
    .lean();
};

const countAll = ({ filter = {} } = {}) => {
  return FailureReason.countDocuments(filter);
};

const findById = (failureReasonId) => {
  return FailureReason.findById(failureReasonId)
    .populate(FAILURE_LOG_POPULATE)
    .lean();
};

const findByOrderId = (
  orderId,
  { skip = 0, limit = 10, sort = { createdAt: -1 } } = {},
) => {
  return FailureReason.find({ orderId })
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate(FAILURE_LOG_POPULATE)
    .lean();
};

const findByTripId = (
  tripId,
  { skip = 0, limit = 20, sort = { createdAt: -1 } } = {},
) => {
  return FailureReason.find({ tripId })
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate(FAILURE_LOG_POPULATE)
    .lean();
};

const countByFailureType = (filter = {}) => {
  return FailureReason.aggregate([
    { $match: filter },
    {
      $group: {
        _id: "$failureReasonType",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]);
};

const updateById = (failureReasonId, updateData, session = null) => {
  return FailureReason.findByIdAndUpdate(failureReasonId, updateData, {
    new: true,
    runValidators: true,
    session,
  })
    .populate(FAILURE_LOG_POPULATE)
    .lean();
};

const deleteById = (failureReasonId, session = null) => {
  return FailureReason.findByIdAndDelete(failureReasonId, { session });
};

export default {
  create,
  findAll,
  countAll,
  findById,
  findByOrderId,
  findByTripId,
  countByFailureType,
  updateById,
  deleteById,
};
