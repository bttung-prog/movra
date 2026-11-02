import Accountant from "./accountant.js";

const POPULATE_FIELDS = [
  { path: "userId", select: "email fullName phone role status" },
];

const create = (data, session = null) => {
  return Accountant.create([data], { session }).then((docs) => docs[0]);
};

const findAll = ({ filter = {}, skip = 0, limit = 10 } = {}) => {
  return Accountant.find(filter)
    .populate(POPULATE_FIELDS)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

const countAll = (filter = {}) => Accountant.countDocuments(filter);

const findById = (accountantId, session = null) => {
  return Accountant.findById(accountantId, null, { session })
    .populate(POPULATE_FIELDS)
    .lean();
};

const findByUserId = (userId, session = null) => {
  return Accountant.findOne({ userId }, null, { session })
    .populate(POPULATE_FIELDS)
    .lean();
};

const findByCode = (accountantCode) => {
  return Accountant.findOne({ accountantCode })
    .populate(POPULATE_FIELDS)
    .lean();
};

const updateById = (accountantId, updateData, session = null) => {
  return Accountant.findByIdAndUpdate(accountantId, updateData, {
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
  findById,
  findByUserId,
  findByCode,
  updateById,
};
