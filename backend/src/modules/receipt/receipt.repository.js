import WarehouseReceipt from "./receipt.js";

const RECEIPT_POPULATE = [
  { path: "orderId", select: "orderCode" },
  { path: "goodsCategoryId", select: "goodsCategoryName" },
  { path: "warehouseId", select: "warehouseName" },
  { path: "receivedBy", select: "fullName" },
];

const create = (receiptData, session = null) => {
  return WarehouseReceipt.create([receiptData], { session }).then(
    (docs) => docs[0],
  );
};

const findAll = ({
  filter = {},
  skip = 0,
  limit = 10,
  sort = { createdAt: -1 },
}) => {
  return WarehouseReceipt.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate(RECEIPT_POPULATE)
    .lean();
};

const countAll = ({ filter = {} }) => {
  return WarehouseReceipt.countDocuments(filter);
};

const findById = (receiptId, session = null) => {
  return WarehouseReceipt.findById(receiptId)
    .populate(RECEIPT_POPULATE)
    .session(session)
    .lean();
};

const findByOrderId = (orderId, warehouseId = null) => {
  const filter = { orderId };
  if (warehouseId) {
    filter.warehouseId = warehouseId;
  }

  return WarehouseReceipt.findOne(filter)
    .sort({ createdAt: -1 })
    .populate(RECEIPT_POPULATE)
    .lean();
};

const findByReceiptCode = (receiptCode) => {
  return WarehouseReceipt.findOne({ receiptCode })
    .populate(RECEIPT_POPULATE)
    .lean();
};

const updateById = (receiptId, updateData, session = null) => {
  return WarehouseReceipt.findByIdAndUpdate(receiptId, updateData, {
    new: true,
    runValidators: true,
    session,
  })
    .populate(RECEIPT_POPULATE)
    .lean();
};

const cancelAtomic = (receiptId, updateData, session = null) => {
  return WarehouseReceipt.findOneAndUpdate(
    { _id: receiptId, status: "completed" },
    { ...updateData, status: "cancelled" },
    {
      new: true,
      runValidators: true,
      session,
    },
  )
    .populate(RECEIPT_POPULATE)
    .lean();
};

export default {
  create,
  findAll,
  countAll,
  findById,
  findByReceiptCode,
  findByOrderId,
  updateById,
  cancelAtomic,
};
