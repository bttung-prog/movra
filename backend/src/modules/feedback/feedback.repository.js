import Feedback from "./feedback.js";

const FEEDBACK_POPULATE = [
  {
    path: "customerId",
    select: "userId",
    populate: { path: "userId", select: "fullName avatar" },
  },
  {
    path: "driverId",
    select: "driverCode userId rating totalReviews",
    populate: { path: "userId", select: "fullName avatar" },
  },
  {
    path: "orderId",
    select: "orderCode status deliveredAt",
  },
  {
    path: "tripId",
    select: "tripCode status",
  },
];

const create = (data, session = null) => {
  return Feedback.create([data], { session }).then((docs) => docs[0]);
};

const findAll = ({
  filter = {},
  skip = 0,
  limit = 10,
  sort = { createdAt: -1 },
} = {}) => {
  return Feedback.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate(FEEDBACK_POPULATE)
    .lean();
};

const countAll = ({ filter = {} } = {}) => {
  return Feedback.countDocuments(filter);
};

const findById = (id, session = null, filter = {}) => {
  const query = Feedback.findOne({ _id: id, ...filter }).populate(
    FEEDBACK_POPULATE,
  );
  if (session) {
    query.session(session);
  }
  return query;
};

const findByOrderId = (orderId, filter = {}, session = null) => {
  const query = Feedback.findOne({ orderId, ...filter }).populate(
    FEEDBACK_POPULATE,
  );
  if (session) {
    query.session(session);
  }
  return query;
};

const updateById = (id, updateData, session = null) => {
  return Feedback.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
    session,
  }).populate(FEEDBACK_POPULATE);
};

const getDriverStats = async (driverId, session = null) => {
  const aggregation = Feedback.aggregate([
    { $match: { driverId, status: "visible" } },
    {
      $group: {
        _id: "$driverId",
        averageRating: { $avg: "$rating" },
        totalReviews: { $sum: 1 },
      },
    },
  ]);
  if (session) {
    aggregation.session(session);
  }
  const stats = await aggregation;

  if (stats.length > 0) {
    return {
      averageRating: Number(stats[0].averageRating.toFixed(1)),
      totalReviews: stats[0].totalReviews,
    };
  }

  return { averageRating: 5, totalReviews: 0 };
};

export default {
  create,
  findAll,
  countAll,
  findById,
  findByOrderId,
  updateById,
  getDriverStats,
};
