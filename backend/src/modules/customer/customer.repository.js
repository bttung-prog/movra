import Customer from "./customer.js";

const create = (userId, session) => {
  return Customer.create(
    [
      {
        userId: userId,
      },
    ],
    { session },
  ).then((docs) => docs[0]);
};

const findAll = ({ filter = {}, skip = 0, limit = 10 }) => {
  return Customer.find(filter)
    .populate("userId", "email phone fullName")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

const countAll = (filter = {}) => {
  return Customer.countDocuments(filter);
};

const findById = (customerId, session = null) => {
  const query = Customer.findById(customerId)
    .populate("userId", "email phone fullName")
    .lean();

  if (session) {
    query.session(session);
  }

  return query;
};

const findByUserId = (userId, session = null) => {
  return Customer.findOne({ userId: userId }, null, { session })
    .populate("userId", "email phone fullName")
    .lean();
};

const updateById = (customerId, updateData, session = null, conditions = {}) => {
  return Customer.findOneAndUpdate(
    { ...conditions, _id: customerId },
    updateData,
    { new: true, runValidators: true, session },
  )
    .populate("userId", "email phone fullName")
    .lean();
};

export default {
  create,
  findAll,
  countAll,
  findById,
  findByUserId,
  updateById,
};
