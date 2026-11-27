import mongoose from "mongoose";

import { FAILURE_REASON_TYPES } from "../../constants/failureReasonTypes.js";

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
      enum: Object.values(FAILURE_REASON_TYPES),
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
