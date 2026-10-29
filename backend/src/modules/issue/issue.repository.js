import WarehouseIssue from "./issue.js";

const ISSUE_POPULATE = [
  { path: "orderId", select: "orderCode" },
  { path: "goodsCategoryId", select: "goodsCategoryName" },
  { path: "warehouseId", select: "warehouseName" },
  { path: "tripId", select: "tripCode" },
  { path: "issuedBy", select: "fullName" },
];

const create = (issueData, session = null) => {
  return WarehouseIssue.create([issueData], { session }).then(
    (docs) => docs[0],
  );
};

const findAll = ({
  filter = {},
  skip = 0,
  limit = 10,
  sort = { createdAt: -1 },
}) => {
  return WarehouseIssue.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate(ISSUE_POPULATE)
    .lean();
};

const countAll = ({ filter = {} }) => {
  return WarehouseIssue.countDocuments(filter);
};

const findById = (issueId, session = null) => {
  return WarehouseIssue.findById(issueId)
    .populate(ISSUE_POPULATE)
    .session(session)
    .lean();
};

const findByIssueCode = (issueCode) => {
  return WarehouseIssue.findOne({ issueCode }).populate(ISSUE_POPULATE).lean();
};

const findByOrderId = (orderId, warehouseId = null) => {
  const filter = { orderId };
  if (warehouseId) {
    filter.warehouseId = warehouseId;
  }

  return WarehouseIssue.findOne(filter)
    .sort({ createdAt: -1 })
    .populate(ISSUE_POPULATE)
    .lean();
};

const findByTripId = (
  tripId,
  { skip = 0, limit = 10, sort = { createdAt: -1 }, filter = {} } = {},
) => {
  return WarehouseIssue.find({ tripId, ...filter })
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate(ISSUE_POPULATE)
    .lean();
};

const countByTripId = (tripId, filter = {}) => {
  return WarehouseIssue.countDocuments({ tripId, ...filter });
};

const updateById = (issueId, updateData, session = null, conditions = {}) => {
  return WarehouseIssue.findOneAndUpdate(
    { _id: issueId, ...conditions },
    updateData,
    {
      new: true,
      runValidators: true,
      session,
    },
  )
    .populate(ISSUE_POPULATE)
    .lean();
};

const cancelAtomic = (issueId, updateData, session = null) => {
  return WarehouseIssue.findOneAndUpdate(
    { _id: issueId, status: "completed" },
    { ...updateData, status: "cancelled" },
    {
      new: true,
      runValidators: true,
      session,
    },
  )
    .populate(ISSUE_POPULATE)
    .lean();
};

export default {
  create,
  findAll,
  countAll,
  findById,
  findByIssueCode,
  findByOrderId,
  findByTripId,
  countByTripId,
  updateById,
  cancelAtomic,
};
