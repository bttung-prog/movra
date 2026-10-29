import ShippingRate from "./pricing.js";

const RATE_POPULATE = [
  {
    path: "categorySurcharges.goodsCategoryId",
    select: "goodsCategoryName description",
  },
];

const create = (data, session = null) => {
  return ShippingRate.create([data], { session }).then((docs) => docs[0]);
};

const findAll = ({
  filter = {},
  skip = 0,
  limit = 10,
  sort = { createdAt: -1 },
} = {}) => {
  return ShippingRate.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate(RATE_POPULATE)
    .lean();
};

const countAll = ({ filter = {} } = {}) => {
  return ShippingRate.countDocuments(filter);
};

const findById = (id, session = null) => {
  const query = ShippingRate.findById(id).populate(RATE_POPULATE);
  if (session) {
    query.session(session);
  }
  return query;
};

const findActiveByServiceType = (serviceType = "standard") => {
  return ShippingRate.findOne({ serviceType, isActive: true }).populate(
    RATE_POPULATE,
  );
};

const updateById = (id, updateData, session = null) => {
  return ShippingRate.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
    session,
  }).populate(RATE_POPULATE);
};

const deleteById = (id, session = null) => {
  return ShippingRate.findByIdAndDelete(id, { session });
};

export default {
  create,
  findAll,
  countAll,
  findById,
  findActiveByServiceType,
  updateById,
  deleteById,
};
