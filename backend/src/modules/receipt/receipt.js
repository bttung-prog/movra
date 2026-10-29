import mongoose from "mongoose";

import RECEIPT_STATUSES from "../../constants/receiptStatuses.js";
import { INVENTORY_CONDITIONS } from "../../constants/inventoryStatuses.js";

const warehouseReceiptSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },

    goodsCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GoodsCategory",
      required: true,
    },

    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
    },

    previousWarehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      default: null,
    },

    previousOrderStatus: {
      type: String,
    },

    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    condition: {
      type: String,
      enum: Object.values(INVENTORY_CONDITIONS),
      default: INVENTORY_CONDITIONS.GOOD,
      required: true,
    },

    receivedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },

    receiptCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    status: {
      type: String,
      enum: Object.values(RECEIPT_STATUSES),
      default: RECEIPT_STATUSES.COMPLETED,
    },

    note: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

warehouseReceiptSchema.index({ orderId: 1, createdAt: -1 });
warehouseReceiptSchema.index({ orderId: 1, status: 1 });
warehouseReceiptSchema.index({ warehouseId: 1, createdAt: -1 });
warehouseReceiptSchema.index({ goodsCategoryId: 1 });
warehouseReceiptSchema.index({ receivedBy: 1 });
warehouseReceiptSchema.index({ status: 1 });
warehouseReceiptSchema.index({ receivedAt: -1 });
warehouseReceiptSchema.index({ createdAt: -1 });

const WarehouseReceipt = mongoose.model(
  "WarehouseReceipt",
  warehouseReceiptSchema,
);

export default WarehouseReceipt;
