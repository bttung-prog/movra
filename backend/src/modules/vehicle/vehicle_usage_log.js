import mongoose from "mongoose";

const vehicleUsageLogsSchema = new mongoose.Schema(
  {
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true,
    },

    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      required: true,
    },

    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trip",
      required: true,
    },

    startOdo: {
      type: Number,
      required: true,
    },

    endOdo: {
      type: Number,
    },

    startTime: {
      type: Date,
      required: true,
    },

    endTime: {
      type: Date,
    },

    fuelConsumed: {
      type: Number,
    },

    notes: {
      type: String,
      trim: true,
      default: "",
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

vehicleUsageLogsSchema.index({ vehicleId: 1 });
vehicleUsageLogsSchema.index({ driverId: 1 });
vehicleUsageLogsSchema.index({ tripId: 1 });
vehicleUsageLogsSchema.index({ deletedAt: -1 });

const VehicleUsageLog = mongoose.model(
  "VehicleUsageLog",
  vehicleUsageLogsSchema,
);

export default VehicleUsageLog;
