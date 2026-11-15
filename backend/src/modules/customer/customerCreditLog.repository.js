import CustomerCreditLog from "./customerCreditLog.js";

const CHANGED_BY_POPULATE = {
  path: "changedBy",
  select: "fullName email role",
};

const create = (logData, session = null) => {
  return CustomerCreditLog.create([logData], { session }).then(
    (docs) => docs[0],
  );
};

const findByCustomerId = ({ customerId, skip = 0, limit = 20 }) => {
  return CustomerCreditLog.find({ customerId })
    .sort({ createdAt: -1, _id: -1 })
    .skip(skip)
    .limit(limit)
    .populate(CHANGED_BY_POPULATE)
    .lean();
};

const countByCustomerId = (customerId) => {
  return CustomerCreditLog.countDocuments({ customerId });
};

export default {
  create,
  findByCustomerId,
  countByCustomerId,
};
