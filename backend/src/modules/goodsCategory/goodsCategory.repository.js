import GoodsCategory from "./goodsCategory.js";

const create = (categoryData, session = null) => {
  return GoodsCategory.create([categoryData], { session }).then((docs) =>
    docs[0]?.toObject ? docs[0].toObject() : docs[0],
  );
};

const findAll = ({
  filter = {},
  skip = 0,
  limit = 10,
  sort = { createdAt: -1 },
  session = null,
} = {}) => {
  return GoodsCategory.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .session(session)
    .lean();
};

const countAll = ({ filter = {}, session = null } = {}) => {
  return GoodsCategory.countDocuments(filter).session(session);
};

const findById = (goodsCategoryId, session = null) => {
  return GoodsCategory.findById(goodsCategoryId).session(session).lean();
};

const findByName = (goodsCategoryName, filter = {}, session = null) => {
  return GoodsCategory.findOne({
    goodsCategoryName,
    ...filter,
  })
    .collation({ locale: "en", strength: 2 })
    .session(session)
    .lean();
};

const updateById = (goodsCategoryId, updateData, session = null) => {
  return GoodsCategory.findByIdAndUpdate(goodsCategoryId, updateData, {
    new: true,
    runValidators: true,
    session,
  }).lean();
};

const deleteById = (goodsCategoryId, session = null) => {
  return GoodsCategory.findByIdAndUpdate(
    goodsCategoryId,
    { deletedAt: new Date() },
    { new: true, session },
  ).lean();
};

const restoreById = (goodsCategoryId, session = null) => {
  return GoodsCategory.findByIdAndUpdate(
    goodsCategoryId,
    { deletedAt: null },
    { new: true, session },
  ).lean();
};

export default {
  create,
  findAll,
  countAll,
  findById,
  findByName,
  updateById,
  deleteById,
  restoreById,
};
