import mongoose from "mongoose";

const vehicleSchema = new mongoose.Schema(
  {
    plateNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    vehicleTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VehicleType",
      required: true,
    },

    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      default: null,
    },

    brand: {
      type: String,
      required: true,
      trim: true,
    },

    model: {
      type: String,
      required: true,
      trim: true,
    },

    yearManufactured: {
      type: Number,
      required: true,
    },

    capacityWeight: {
      type: Number,
      required: true,
    },

    capacityVolume: {
      type: Number,
      required: true,
    },

    registrationExpiryDate: {
      type: Date,
      required: true,
    },

    insuranceExpiryDate: {
      type: Date,
      required: true,
    },

    currentOdometer: {
      type: Number,
      default: 0,
      min: 0,
    },

    tripScheduleVersion: {
      type: Number,
      select: false,
    },

    status: {
      type: String,
      enum: ["available", "in_use", "maintenance", "retired"],
      default: "available",
    },
  },
  { timestamps: true },
);

vehicleSchema.index({ vehicleTypeId: 1 });
vehicleSchema.index({ warehouseId: 1 });
vehicleSchema.index({ registrationExpiryDate: 1 });
vehicleSchema.index({ insuranceExpiryDate: 1 });
vehicleSchema.index({ status: 1 });

const Vehicle = mongoose.model("Vehicle", vehicleSchema);

export default Vehicle;
