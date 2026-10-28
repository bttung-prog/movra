import User from "./user.js";

const create = ({ email, password, phone, fullName, role }, session) => {
  return User.create(
    [
      {
        email,
        password,
        phone,
        fullName,
        role,
      },
    ],
    { session },
  ).then((docs) => {
    const user = docs[0].toObject();
    delete user.password;
    return user;
  });
};

const findById = (userId, session = null) => {
  return User.findById(userId, null, { session }).select("-password").lean();
};

const findByEmail = (email) => {
  return User.findOne({ email }).lean();
};

const findByPhone = (phone) => {
  return User.findOne({ phone }).lean();
};

const findPassword = (userId) => {
  return User.findById(userId).select("password").lean();
};

const findAll = ({ filter = {}, skip = 0, limit = 10 }) => {
  return User.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .select("-password")
    .lean();
};

const countAll = (filter = {}) => {
  return User.countDocuments(filter);
};

const buildSearchFilter = (keyword) => ({
  $or: [
    { email: { $regex: keyword, $options: "i" } },
    { phone: { $regex: keyword, $options: "i" } },
    { fullName: { $regex: keyword, $options: "i" } },
  ],
});

const search = (keyword) => {
  return User.find(buildSearchFilter(keyword))
    .limit(50)
    .select("-password")
    .lean();
};

const searchPaginated = (
  keyword,
  { skip = 0, limit = 10, filter = {} } = {},
) => {
  return User.find({ ...filter, ...buildSearchFilter(keyword) })
    .sort({ createdAt: -1, _id: -1 })
    .skip(skip)
    .limit(limit)
    .select("-password")
    .lean();
};

const countSearch = (keyword, filter = {}) => {
  return User.countDocuments({ ...filter, ...buildSearchFilter(keyword) });
};

const updateById = (userId, updateData, session = null) => {
  return User.findByIdAndUpdate(userId, updateData, {
    new: true,
    runValidators: true,
    session,
  })
    .select("-password")
    .lean();
};

export default {
  create,
  findById,
  findByEmail,
  findByPhone,
  findPassword,
  findAll,
  countAll,
  search,
  searchPaginated,
  countSearch,
  updateById,
};
