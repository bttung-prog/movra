import TripAuditLog from "./trip_audit_log.js";

const create = (logData, session = null) => {
  return TripAuditLog.create([logData], { session }).then((docs) => docs[0]);
};

const findByTripId = (tripId, { skip = 0, limit = 20 } = {}) => {
  return TripAuditLog.find({ tripId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate({ path: "performedBy", select: "fullName phone email" })
    .lean();
};

const countByTripId = (tripId) => {
  return TripAuditLog.countDocuments({ tripId });
};

export default {
  create,
  findByTripId,
  countByTripId,
};
