import mongoose from "mongoose";

import WAREHOUSE_STATUSES from "../../constants/warehouseStatuses.js";

const warehouseSchema = new mongoose.Schema(
  {
    warehouseName: {
      type: String,
      required: true,
    },

    warehouseAddress: {
      type: String,
      required: true,
    },

    latitude: {
      type: Number,
      min: -90,
      max: 90,
    },

    longitude: {
      type: Number,
      min: -180,
      max: 180,
    },

    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    status: {
      type: String,
      enum: Object.values(WAREHOUSE_STATUSES),
      default: WAREHOUSE_STATUSES.ACTIVE,
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

warehouseSchema.index(
  { warehouseName: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
warehouseSchema.index({ status: 1 });
warehouseSchema.index({ deletedAt: 1 });

const Warehouse = mongoose.model("Warehouse", warehouseSchema);

export default Warehouse;
