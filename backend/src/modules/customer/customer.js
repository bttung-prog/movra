import mongoose from "mongoose";

import { PAYMENT_TERMS } from "../../constants/paymentTerms.js";

const customerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      unique: true,
      required: true,
    },

    companyName: {
      type: String,
      trim: true,
    },

    taxCode: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },

    companyAddress: {
      type: String,
      trim: true,
    },

    contactPerson: {
      type: String,
      trim: true,
    },

    contactPhone: {
      type: String,
      trim: true,
    },

    creditLimit: {
      type: Number,
      default: 0,
      min: 0,
    },

    defaultPaymentTerms: {
      type: String,
      enum: Object.values(PAYMENT_TERMS),
      default: PAYMENT_TERMS.IMMEDIATE,
    },

    contractDiscountRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    walletBalance: {
      type: Number,
      default: 0,
    },

    totalSpent: {
      type: Number,
      default: 0,
    },

    lastPurchaseDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

customerSchema.index({ walletBalance: -1 });
customerSchema.index({ totalSpent: -1 });
customerSchema.index({ lastPurchaseDate: -1 });
customerSchema.index({ companyName: 1 });

const Customer = mongoose.model("Customer", customerSchema);

export default Customer;
