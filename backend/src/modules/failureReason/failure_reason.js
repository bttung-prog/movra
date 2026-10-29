import mongoose from "mongoose";

const failureReasonSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },

    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trip",
      required: true,
    },

    failureReasonType: {
      type: String,
      enum: [
        "customer_rejected",
        "damaged",
        "wrong_address",
        "payment_failed",
        "other",
      ],
      required: true,
      trim: true,
    },

    failureReasonDescription: {
      type: String,
      trim: true,
    },

    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    latitude: {
      type: Number,
    },

    longitude: {
      type: Number,
    },

    address: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);

failureReasonSchema.index({ orderId: 1, createdAt: -1 });
failureReasonSchema.index({ tripId: 1 });
failureReasonSchema.index({ failureReasonType: 1 });

const FailureReason = mongoose.model("FailureReason", failureReasonSchema);

export default FailureReason;
