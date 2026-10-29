import mongoose from "mongoose";

const vehicleTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    maxWeight: {
      type: Number,
      required: true,
    },

    maxVolume: {
      type: Number,
      required: true,
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

vehicleTypeSchema.index(
  { name: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
vehicleTypeSchema.index({ deletedAt: -1, createdAt: -1 });

const VehicleType = mongoose.model("VehicleType", vehicleTypeSchema);

export default VehicleType;
