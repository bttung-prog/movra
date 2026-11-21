import TripAssignment from "./trip_assignment.js";

const ASSIGNMENT_POPULATE = [
  {
    path: "oldVehicleId",
    select: "plateNumber capacityWeight capacityVolume",
  },
  {
    path: "newVehicleId",
    select: "plateNumber capacityWeight capacityVolume",
  },
  {
    path: "oldDriverId",
    select: "driverCode idCardNumber",
    populate: { path: "userId", select: "fullName phone" },
  },
  {
    path: "newDriverId",
    select: "driverCode idCardNumber",
    populate: { path: "userId", select: "fullName phone" },
  },
  {
    path: "changedBy",
    select: "fullName phone",
  },
];

const create = (assignmentData, session = null) => {
  return TripAssignment.create([assignmentData], { session }).then(
    (docs) => docs[0],
  );
};

const findByTripId = (
  tripId,
  { skip = 0, limit = 20, sort = { createdAt: -1 } } = {},
) => {
  return TripAssignment.find({ tripId })
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate(ASSIGNMENT_POPULATE)
    .lean();
};

const countByTripId = (tripId) => {
  return TripAssignment.countDocuments({ tripId });
};

const findById = (assignmentId) => {
  return TripAssignment.findById(assignmentId)
    .populate(ASSIGNMENT_POPULATE)
    .lean();
};

export default {
  create,
  findByTripId,
  countByTripId,
  findById,
};
