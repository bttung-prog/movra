import mongoose from "mongoose";

const addressSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    receiverName: {
      type: String,
      required: true,
      trim: true,
    },

    label: {
      type: String,
      trim: true,
      default: null,
    },

    province: {
      type: String,
      required: true,
      trim: true,
    },

    district: {
      type: String,
      required: true,
      trim: true,
    },

    ward: {
      type: String,
      required: true,
      trim: true,
    },

    detail: {
      type: String,
      required: true,
      trim: true,
    },

    latitude: {
      type: Number,
      min: -90,
      max: 90,
      default: null,
    },

    longitude: {
      type: Number,
      min: -180,
      max: 180,
      default: null,
    },

    postalCode: {
      type: String,
      trim: true,
      default: null,
    },

    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

addressSchema.index({ customerId: 1, isDefault: -1 });
addressSchema.index({ createdAt: -1 });

const Address = mongoose.model("Address", addressSchema);

export default Address;
