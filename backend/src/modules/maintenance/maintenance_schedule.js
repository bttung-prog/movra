import mongoose from "mongoose";

const maintenanceScheduleSchema = new mongoose.Schema(
  {
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true,
    },

    taskName: {
      type: String,
      required: true,
      trim: true,
    },

    frequencyMonths: {
      type: Number,
      required: true,
      min: 0,
    },

    frequencyKm: {
      type: Number,
      required: true,
      min: 0,
    },

    lastServiceDate: {
      type: Date,
    },

    lastServiceKm: {
      type: Number,
      min: 0,
    },

    nextDueDate: {
      type: Date,
    },

    nextDueKm: {
      type: Number,
      min: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

maintenanceScheduleSchema.index({ vehicleId: 1 });
maintenanceScheduleSchema.index({ nextDueDate: 1 });
maintenanceScheduleSchema.index({ nextDueKm: 1 });
maintenanceScheduleSchema.index({ isActive: 1 });
maintenanceScheduleSchema.index({ deletedAt: -1 });

const MaintenanceSchedule = mongoose.model(
  "MaintenanceSchedule",
  maintenanceScheduleSchema,
);

export default MaintenanceSchedule;

