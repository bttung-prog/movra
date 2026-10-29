import mongoose from "mongoose";

const maintenanceLogSchema = new mongoose.Schema(
  {
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true,
    },

    scheduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MaintenanceSchedule",
      required: true,
    },

    previousLogId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MaintenanceLog",
    },

    type: {
      type: String,
      enum: ["routine", "repair", "inspection"],
      required: true,
      default: "routine",
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    cost: {
      type: Number,
      required: true,
      min: 0,
    },

    startDate: {
      type: Date,
      default: Date.now,
    },

    endDate: {
      type: Date,
    },

    odometerReading: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: ["scheduled", "in_progress", "completed", "cancelled"],
      default: "scheduled",
    },
  },
  { timestamps: true },
);

maintenanceLogSchema.index({ vehicleId: 1, createdAt: -1, _id: -1 });
maintenanceLogSchema.index(
  { previousLogId: 1 },
  { unique: true, sparse: true },
);
maintenanceLogSchema.index({ status: 1 });
maintenanceLogSchema.index({ startDate: 1 });

const MaintenanceLog = mongoose.model("MaintenanceLog", maintenanceLogSchema);

export default MaintenanceLog;
