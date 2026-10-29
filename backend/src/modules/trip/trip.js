import mongoose from "mongoose";

import TRIP_TYPES from "../../constants/tripTypes.js";

const tripSchema = new mongoose.Schema(
  {
    tripCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

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

    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      default: null,
    },

    routeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Route",
    },

    type: {
      type: String,
      enum: Object.values(TRIP_TYPES),
      default: TRIP_TYPES.DELIVERY,
    },

    status: {
      type: String,
      required: true,
      enum: ["planned", "in_progress", "completed", "cancelled"],
      default: "planned",
    },

    plannedStart: {
      type: Date,
      required: true,
    },

    plannedEnd: {
      type: Date,
      required: true,
    },

    actualStart: {
      type: Date,
    },

    actualEnd: {
      type: Date,
    },

    totalDistance: {
      type: Number,
    },

    totalOrder: {
      type: Number,
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

tripSchema.index({ driverId: 1, status: 1 });
tripSchema.index({ warehouseId: 1, status: 1 });
tripSchema.index({ vehicleId: 1, status: 1 });
tripSchema.index({ type: 1 });
tripSchema.index({ deletedAt: -1 });

const Trip = mongoose.model("Trip", tripSchema);

export default Trip;
