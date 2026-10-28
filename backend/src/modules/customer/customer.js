import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      unique: true,
      required: true,
    },

    gender: {
      type: String,
      enum: ["male", "female", "other"],
      default: "male",
    },

    walletBalance: {
      type: Number,
      default: 0,
    },

    totalSpent: {
      type: Number,
      default: 0,
    },

    loyaltyPoints: {
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
customerSchema.index({ loyaltyPoints: -1 });
customerSchema.index({ lastPurchaseDate: -1 });

const Customer = mongoose.model("Customer", customerSchema);

export default Customer;
