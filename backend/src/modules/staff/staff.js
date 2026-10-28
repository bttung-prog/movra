import mongoose from "mongoose";

const warehouseStaffSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      unique: true,
      required: true,
    },

    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
    },

    staffCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      trim: true,
      required: true,
    },
  },
  { timestamps: true },
);

warehouseStaffSchema.index({ warehouseId: 1 });
warehouseStaffSchema.index({ status: 1 });

const WarehouseStaff = mongoose.model("WarehouseStaff", warehouseStaffSchema);

export default WarehouseStaff;
