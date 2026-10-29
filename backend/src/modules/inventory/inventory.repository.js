import mongoose from "mongoose";
import Inventory from "./inventory.js";

const INVENTORY_POPULATE = [
  { path: "warehouseId", select: "warehouseName warehouseAddress status" },
  { path: "orderId", select: "orderCode status weight volume" },
  { path: "goodsCategoryId", select: "goodsCategoryName description" },
];

const create = (inventoryData, session = null) => {
  return Inventory.create([inventoryData], { session }).then((docs) => docs[0]);
};

const findAll = ({
  filter = {},
  skip = 0,
  limit = 10,
  sort = { createdAt: -1 },
  session = null,
}) => {
  return Inventory.find({ deletedAt: null, ...filter })
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate(INVENTORY_POPULATE)
    .session(session)
    .lean();
};

const countAll = ({ filter = {}, session = null }) => {
  return Inventory.countDocuments({ deletedAt: null, ...filter }).session(
    session,
  );
};

const findById = (inventoryId, session = null) => {
  return Inventory.findOne({ _id: inventoryId, deletedAt: null })
    .populate(INVENTORY_POPULATE)
    .session(session)
    .lean();
};

const findByOrderId = (orderId, warehouseId = null, session = null) => {
  const filter = { orderId, deletedAt: null };
  if (warehouseId) {
    filter.warehouseId = warehouseId;
  }

  return Inventory.findOne(filter)
    .sort({ updatedAt: -1 })
    .populate(INVENTORY_POPULATE)
    .session(session)
    .lean();
};

const findInStockByOrderId = (orderId, session = null) => {
  return Inventory.findOne({ orderId, status: "in_stock", deletedAt: null })
    .populate(INVENTORY_POPULATE)
    .session(session)
    .lean();
};

const markAsInStockAtomic = (inventoryId, session = null) => {
  return Inventory.findOneAndUpdate(
    { _id: inventoryId, status: "issued", deletedAt: null },
    { status: "in_stock" },
    {
      new: true,
      runValidators: true,
      session,
    },
  )
    .populate(INVENTORY_POPULATE)
    .lean();
};

const findByWarehouseAndOrder = (warehouseId, orderId, session = null) => {
  return Inventory.findOne({ warehouseId, orderId, deletedAt: null })
    .sort({ updatedAt: -1 })
    .populate(INVENTORY_POPULATE)
    .session(session)
    .lean();
};

const updateById = (inventoryId, data, session = null, conditions = {}) => {
  return Inventory.findOneAndUpdate(
    { ...conditions, _id: inventoryId, deletedAt: null },
    data,
    {
      new: true,
      runValidators: true,
      session,
    },
  )
    .populate(INVENTORY_POPULATE)
    .lean();
};

const markAsIssuedAtomic = (orderId, warehouseId = null, session = null) => {
  const filter = { orderId, status: "in_stock", deletedAt: null };
  if (warehouseId) {
    filter.warehouseId = warehouseId;
  }

  return Inventory.findOneAndUpdate(
    filter,
    { status: "issued" },
    {
      new: true,
      runValidators: true,
      session,
    },
  )
    .populate(INVENTORY_POPULATE)
    .lean();
};

const deleteById = (inventoryId, session = null) => {
  return Inventory.findOneAndUpdate(
    { _id: inventoryId, deletedAt: null },
    { deletedAt: new Date() },
    {
      new: true,
      runValidators: true,
      session,
    },
  )
    .populate(INVENTORY_POPULATE)
    .lean();
};

const softDeleteInStockByWarehouseAndOrder = (
  warehouseId,
  orderId,
  session = null,
) => {
  return Inventory.findOneAndUpdate(
    { warehouseId, orderId, status: "in_stock", deletedAt: null },
    { deletedAt: new Date() },
    {
      new: true,
      runValidators: true,
      session,
    },
  )
    .populate(INVENTORY_POPULATE)
    .lean();
};

const aggregateStockByWarehouse = (warehouseId = null, session = null) => {
  const matchFilter = { deletedAt: null, status: "in_stock" };
  if (warehouseId) {
    const rawId = warehouseId?._id
      ? warehouseId._id.toString()
      : warehouseId.toString();

    matchFilter.warehouseId =
      mongoose.Types.ObjectId.createFromHexString(rawId);
  }

  return Inventory.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: "$warehouseId",
        totalOrders: { $sum: 1 },
        totalQuantity: { $sum: "$quantity" },
      },
    },
    {
      $lookup: {
        from: "warehouses",
        localField: "_id",
        foreignField: "_id",
        as: "warehouse",
      },
    },
    { $unwind: { path: "$warehouse", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        warehouseId: "$_id",
        warehouseName: "$warehouse.warehouseName",
        warehouseAddress: "$warehouse.warehouseAddress",
        totalOrders: 1,
        totalQuantity: 1,
      },
    },
    { $sort: { totalOrders: -1 } },
  ]).session(session);
};

const updateConditionByOrderId = (orderId, condition, session = null) => {
  return Inventory.findOneAndUpdate(
    { orderId, deletedAt: null },
    { condition },
    {
      new: true,
      runValidators: true,
      session,
    },
  )
    .populate(INVENTORY_POPULATE)
    .lean();
};

const updateConditionById = (inventoryId, condition, session = null) => {
  return Inventory.findOneAndUpdate(
    { _id: inventoryId, status: "in_stock", deletedAt: null },
    { condition },
    {
      new: true,
      runValidators: true,
      session,
    },
  )
    .populate(INVENTORY_POPULATE)
    .lean();
};

export default {
  create,
  findAll,
  countAll,
  findById,
  findByOrderId,
  findInStockByOrderId,
  findByWarehouseAndOrder,
  updateById,
  updateConditionByOrderId,
  updateConditionById,
  markAsIssuedAtomic,
  markAsInStockAtomic,
  deleteById,
  softDeleteInStockByWarehouseAndOrder,
  aggregateStockByWarehouse,
};
