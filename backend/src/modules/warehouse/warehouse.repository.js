import { escapeRegex } from "../../utils/regexUtils.js";

import Warehouse from "./warehouse.js";

const POPULATE_MANAGER = {
  path: "managerId",
  select: "fullName email phone",
};

const create = (warehouseData) => Warehouse.create(warehouseData);

const findAll = ({
  filter = { deletedAt: null },
  skip = 0,
  limit = 10,
  sort = { createdAt: -1 },
}) => {
  return Warehouse.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate(POPULATE_MANAGER)
    .lean();
};

const countAll = ({ filter = { deletedAt: null } }) => {
  return Warehouse.countDocuments(filter);
};

const findById = (warehouseId) => {
  return Warehouse.findById(warehouseId).populate(POPULATE_MANAGER).lean();
};

const findActive = () => {
  return Warehouse.find({ status: "active", deletedAt: null }).lean();
};

const findByName = (warehouseName) => {
  return Warehouse.findOne({
    warehouseName: {
      $regex: new RegExp(`^${escapeRegex(warehouseName.trim())}$`, "i"),
    },
    deletedAt: null,
  }).lean();
};

const updateById = (warehouseId, updateData) => {
  return Warehouse.findByIdAndUpdate(warehouseId, updateData, {
    new: true,
    runValidators: true,
  })
    .populate(POPULATE_MANAGER)
    .lean();
};

export default {
  create,
  findAll,
  countAll,
  findById,
  findActive,
  findByName,
  updateById,
};
