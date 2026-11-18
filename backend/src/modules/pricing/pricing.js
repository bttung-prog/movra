import mongoose from "mongoose";

import { SERVICE_TYPES } from "../../constants/serviceTypes.js";

const categorySurchargeSchema = new mongoose.Schema(
  {
    goodsCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GoodsCategory",
      required: true,
    },

    surchargePercentage: {
      type: Number,
      default: 0,
      min: 0,
    },

    surchargeFixed: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false },
);

const shippingRateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },

    serviceType: {
      type: String,
      enum: Object.values(SERVICE_TYPES),
      required: true,
    },

    basePrice: {
      type: Number,
      required: true,
      min: 0,
    },

    baseWeight: {
      type: Number,
      default: 1000,
      min: 0,
    },

    extraWeightPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    baseDistance: {
      type: Number,
      default: 1,
      min: 1,
    },

    extraDistancePrice: {
      type: Number,
      required: true,
      min: 0,
    },

    categorySurcharges: {
      type: [categorySurchargeSchema],
      default: [],
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true },
);

shippingRateSchema.index({ serviceType: 1, isActive: 1 });

const ShippingRate = mongoose.model("ShippingRate", shippingRateSchema);

export default ShippingRate;
