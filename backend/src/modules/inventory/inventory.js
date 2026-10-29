import mongoose from "mongoose";
import {
  INVENTORY_STATUSES,
  INVENTORY_CONDITIONS,
} from "../../constants/inventoryStatuses.js";

const inventorySchema = new mongoose.Schema(
  {
    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
    },

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

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    location: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: Object.values(INVENTORY_STATUSES),
      default: INVENTORY_STATUSES.IN_STOCK,
    },

    condition: {
      type: String,
      enum: Object.values(INVENTORY_CONDITIONS),
      default: INVENTORY_CONDITIONS.GOOD,
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

inventorySchema.index(
  { warehouseId: 1, orderId: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
inventorySchema.index(
  { orderId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: INVENTORY_STATUSES.IN_STOCK,
      deletedAt: null,
    },
  },
);
inventorySchema.index({ orderId: 1, deletedAt: 1 });
inventorySchema.index({ warehouseId: 1, goodsCategoryId: 1, deletedAt: 1 });
inventorySchema.index({ status: 1, deletedAt: 1 });
inventorySchema.index({ location: 1, deletedAt: 1 });
inventorySchema.index({ deletedAt: 1 });
inventorySchema.index({ createdAt: -1 });

const Inventory = mongoose.model("Inventory", inventorySchema);

export default Inventory;
