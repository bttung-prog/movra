import mongoose from "mongoose";

const dispatcherSchema = new mongoose.Schema(
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

    dispatcherCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
      trim: true,
      required: true,
    },
  },
  { timestamps: true },
);

dispatcherSchema.index({ warehouseId: 1 });
dispatcherSchema.index({ status: 1 });

const Dispatcher = mongoose.model("Dispatcher", dispatcherSchema);

export default Dispatcher;
