import Dispatcher from "./dispatcher.js";

const POPULATE_FIELDS = [
  { path: "userId", select: "email fullName phone" },
  { path: "warehouseId", select: "warehouseName warehouseAddress status" },
];

const create = (data, session = null) => {
  return Dispatcher.create([data], { session }).then((docs) => docs[0]);
};

const findAll = ({
  filter = {},
  skip = 0,
  limit = 10,
  sort = { createdAt: -1 },
} = {}) => {
  return Dispatcher.find(filter)
    .populate(POPULATE_FIELDS)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .lean();
};

const countAll = (filter = {}) => {
  return Dispatcher.countDocuments(filter);
};

const countActiveByWarehouseId = (warehouseId) => {
  return Dispatcher.countDocuments({ warehouseId, status: "active" });
};

const findById = (dispatcherId) => {
  return Dispatcher.findById(dispatcherId).populate(POPULATE_FIELDS).lean();
};

const findByUserId = (userId, session = null) => {
  return Dispatcher.findOne({ userId }, null, { session })
    .populate(POPULATE_FIELDS)
    .lean();
};

const findByCode = (dispatcherCode) => {
  return Dispatcher.findOne({ dispatcherCode })
    .populate(POPULATE_FIELDS)
    .lean();
};

const updateById = (dispatcherId, updateData, session = null) => {
  return Dispatcher.findByIdAndUpdate(dispatcherId, updateData, {
    new: true,
    runValidators: true,
    session,
  })
    .populate(POPULATE_FIELDS)
    .lean();
};

export default {
  create,
  findAll,
  countAll,
  countActiveByWarehouseId,
  findById,
  findByUserId,
  findByCode,
  updateById,
};
