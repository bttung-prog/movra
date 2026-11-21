import OrderTrackingLog from "./order_tracking_log.js";

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

const create = (logData, session = null) => {
  return OrderTrackingLog.create([logData], { session }).then(
    (docs) => docs[0],
  );
};

const findByOrderId = (
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

const findPublicByOrderId = (
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

const countByOrderId = (orderId) => {
  return OrderTrackingLog.countDocuments({ orderId });
};

const getLatestByOrderId = (orderId) => {
  return OrderTrackingLog.findOne({ orderId })
    .sort({ createdAt: -1 })
    .populate(TRACKING_LOG_POPULATE)
    .lean();
};

export default {
  create,
  findByOrderId,
  findPublicByOrderId,
  countByOrderId,
  getLatestByOrderId,
};
