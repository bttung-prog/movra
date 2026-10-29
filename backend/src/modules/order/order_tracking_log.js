import mongoose from "mongoose";

const orderTrackingLogsSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },

    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trip",
    },

    status: {
      type: String,
      required: true,
      enum: [
        "created",
        "driver_assigned",
        "pickup_scheduled",
        "picked_up",
        "stored",
        "transporting",
        "out_for_delivery",
        "delivery_scheduled",
        "delivered",
        "failed",
        "returned",
        "cancelled",
      ],
    },

    latitude: {
      type: Number,
    },

    longitude: {
      type: Number,
    },

    address: {
      type: String,
      default: null,
      trim: true,
    },

    notes: {
      type: String,
      default: null,
      trim: true,
    },

    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

orderTrackingLogsSchema.index({ orderId: 1, createdAt: -1 });
orderTrackingLogsSchema.index({ tripId: 1 });

const OrderTrackingLog = mongoose.model(
  "OrderTrackingLog",
  orderTrackingLogsSchema,
);

export default OrderTrackingLog;
