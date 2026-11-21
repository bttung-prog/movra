import TripTrackingLog from "./trip_tracking_log.js";

const TRACKING_LOG_POPULATE = [
  {
    path: "reportedBy",
    select: "fullName phone",
  },
];

const create = (logData, session = null) => {
  return TripTrackingLog.create([logData], { session }).then((docs) => docs[0]);
};

const findByTripId = (
  tripId,
  { skip = 0, limit = 20, sort = { createdAt: -1 } } = {},
) => {
  return TripTrackingLog.find({ tripId })
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate(TRACKING_LOG_POPULATE)
    .lean();
};

const countByTripId = (tripId) => {
  return TripTrackingLog.countDocuments({ tripId });
};

const getLatestByTripId = (tripId, session = null) => {
  const query = TripTrackingLog.findOne({ tripId })
    .sort({ createdAt: -1 })
    .populate(TRACKING_LOG_POPULATE);

  if (session) {
    query.session(session);
  }

  return query.lean();
};

const findById = (logId) => {
  return TripTrackingLog.findById(logId).populate(TRACKING_LOG_POPULATE).lean();
};

export default {
  create,
  findByTripId,
  countByTripId,
  getLatestByTripId,
  findById,
};
