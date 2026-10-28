import WarehouseStaff from "./staff.js";

const POPULATE_FIELDS = [
  { path: "userId", select: "email fullName phone" },
  {
    path: "warehouseId",
    select: "warehouseName warehouseAddress status deletedAt",
  },
];

const create = (staffData, session = null) => {
  return WarehouseStaff.create([staffData], { session }).then(
    (docs) => docs[0],
  );
};

const findAll = ({
  filter = {},
  skip = 0,
  limit = 10,
  sort = { createdAt: -1 },
} = {}) => {
  return WarehouseStaff.find(filter)
    .populate(POPULATE_FIELDS)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .lean();
};

const countAll = (filter = {}) => {
  return WarehouseStaff.countDocuments(filter);
};

const countActiveByWarehouseId = (warehouseId) => {
  return WarehouseStaff.countDocuments({ warehouseId, status: "active" });
};

const findById = (staffId, session = null) => {
  return WarehouseStaff.findById(staffId, null, { session })
    .populate(POPULATE_FIELDS)
    .lean();
};

const findByUserId = (userId, session = null) => {
  return WarehouseStaff.findOne({ userId }, null, { session })
    .populate(POPULATE_FIELDS)
    .lean();
};

const findByCode = (staffCode) => {
  return WarehouseStaff.findOne({ staffCode }).populate(POPULATE_FIELDS).lean();
};

const updateById = (staffId, updateData, session = null) => {
  return WarehouseStaff.findByIdAndUpdate(staffId, updateData, {
    new: true,
    runValidators: true,
    session,
  })
    .populate(POPULATE_FIELDS)
    .lean();
};

const deleteById = (staffId) => {
  return WarehouseStaff.findByIdAndUpdate(
    staffId,
    { status: "inactive" },
    { new: true },
  )
    .populate(POPULATE_FIELDS)
    .lean();
};

const restoreById = (staffId) => {
  return WarehouseStaff.findByIdAndUpdate(
    staffId,
    { status: "active" },
    { new: true },
  )
    .populate(POPULATE_FIELDS)
    .lean();
};

const transferWarehouse = (staffId, warehouseId, session = null) => {
  return WarehouseStaff.findByIdAndUpdate(
    staffId,
    { warehouseId },
    { new: true, runValidators: true, session },
  )
    .populate(POPULATE_FIELDS)
    .lean();
};

const checkIdentity = async ({ userId, warehouseId }) => {
  return WarehouseStaff.findOne({
    userId,
    warehouseId,
  }).lean();
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
  deleteById,
  restoreById,
  transferWarehouse,
  checkIdentity,
};
