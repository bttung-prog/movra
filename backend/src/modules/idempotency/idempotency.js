import mongoose from "mongoose";

import { IDEMPOTENCY_STATUSES } from "../../constants/idempotencyStatuses.js";

const idempotencySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    key: {
      type: String,
      required: true,
      trim: true,
    },

    endpoint: {
      type: String,
      required: true,
    },

    method: {
      type: String,
      required: true,
    },

    requestHash: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: Object.values(IDEMPOTENCY_STATUSES),
      default: IDEMPOTENCY_STATUSES.PROCESSING,
      required: true,
    },

    responseStatus: {
      type: Number,
      default: null,
    },

    responseBody: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true },
);

idempotencySchema.index({ userId: 1, key: 1 }, { unique: true });
idempotencySchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

const Idempotency = mongoose.model("Idempotency", idempotencySchema);

export default Idempotency;
