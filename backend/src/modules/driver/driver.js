import mongoose from "mongoose";

const driverSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      unique: true,
      required: true,
    },

    driverCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
    },

    currentVehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
      unique: true,
      sparse: true,
    },

    idCardNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    dateOfBirth: {
      type: Date,
      required: true,
    },

    gender: {
      type: String,
      enum: ["male", "female", "other"],
      required: true,
    },

    address: {
      type: String,
      required: true,
      trim: true,
    },

    licenseNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    licenseType: {
      type: String,
      enum: [
        "A1",
        "A",
        "B1",
        "B",
        "C1",
        "C",
        "D1",
        "D2",
        "D",
        "BE",
        "C1E",
        "CE",
        "D1E",
        "D2E",
        "DE",
      ],
      trim: true,
      required: true,
    },

    licenseExpiryDate: {
      type: Date,
      required: true,
      validate: {
        validator: (expiryDate) => expiryDate > new Date(),
        message: "License expiry date must be in the future",
      },
    },

    hiredDate: {
      type: Date,
      default: Date.now,
    },

    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
      trim: true,
      required: true,
    },

    rating: {
      type: Number,
      default: 5,
      min: 1,
      max: 5,
    },

    totalReviews: {
      type: Number,
      default: 0,
      min: 0,
    },

    tripScheduleVersion: {
      type: Number,
      select: false,
    },
  },
  { timestamps: true },
);

driverSchema.index({ hiredDate: 1 });
driverSchema.index({ status: 1 });

const Driver = mongoose.model("Driver", driverSchema);

export default Driver;
