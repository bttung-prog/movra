import mongoose from "mongoose";

import { ORDER_STATUSES } from "../../constants/orderStatuses.js";
import { PAYMENT_STATUSES } from "../../constants/paymentStatuses.js";
import { SERVICE_TYPES } from "../../constants/serviceTypes.js";
import { SHIPPING_MODES } from "../../constants/shippingModes.js";

const orderSchema = new mongoose.Schema(
  {
    orderCode: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    senderName: {
      type: String,
      required: true,
      trim: true,
    },

    senderPhone: {
      type: String,
      required: true,
      trim: true,
    },

    senderAddress: {
      type: String,
      required: true,
      trim: true,
    },

    pickupLocation: {
      latitude: { type: Number, min: -90, max: 90 },
      longitude: { type: Number, min: -180, max: 180 },
    },

    pickupDistanceKm: {
      type: Number,
      min: 0,
    },

    recipientName: {
      type: String,
      required: true,
      trim: true,
    },

    recipientPhone: {
      type: String,
      required: true,
      trim: true,
    },

    recipientAddress: {
      type: String,
      required: true,
      trim: true,
    },

    deliveryLocation: {
      latitude: { type: Number, min: -90, max: 90 },
      longitude: { type: Number, min: -180, max: 180 },
    },

    deliveryDistanceKm: {
      type: Number,
      min: 0,
    },

    totalDistanceKm: {
      type: Number,
      min: 0,
    },

    goodCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GoodsCategory",
      required: true,
    },

    weight: {
      type: Number,
      required: true,
    },

    volume: {
      type: Number,
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    codAmount: {
      type: Number,
      default: 0,
    },

    codCollected: {
      type: Boolean,
      default: false,
    },

    codCollectedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    codRemittedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    codSettled: {
      type: Boolean,
      default: false,
    },

    shippingFee: {
      type: Number,
      default: 23000,
      required: true,
    },

    shippingFeePaid: {
      type: Boolean,
      default: false,
    },

    shippingFeePaidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    loyaltyPointsAwarded: {
      type: Boolean,
      default: false,
    },

    totalAmount: {
      type: Number,
      required: true,
    },

    routeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Route",
    },

    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      default: null,
    },

    destinationWarehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      default: null,
    },

    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trip",
    },

    type: {
      type: String,
      enum: Object.values(SERVICE_TYPES),
      default: SERVICE_TYPES.STANDARD,
    },

    shippingMode: {
      type: String,
      enum: Object.values(SHIPPING_MODES),
      default: SHIPPING_MODES.CONSOLIDATED,
    },

    status: {
      type: String,
      enum: Object.values(ORDER_STATUSES),
      default: ORDER_STATUSES.CREATED,
    },

    deliveryAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    paymentStatus: {
      type: String,
      enum: Object.values(PAYMENT_STATUSES),
      default: PAYMENT_STATUSES.PENDING,
    },

    paymentMethod: {
      type: String,
      default: null,
      trim: true,
    },

    paymentTime: {
      type: Date,
    },

    notes: {
      type: String,
      trim: true,
    },

    podImageUrl: {
      type: String,
      trim: true,
      default: null,
    },

    recipientReceivedName: {
      type: String,
      trim: true,
      default: null,
    },

    deliveredAt: {
      type: Date,
      default: null,
    },

    isFeedbacked: {
      type: Boolean,
      default: false,
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

orderSchema.index({ customerId: 1 });
orderSchema.index({ customerId: 1, isFeedbacked: 1 });
orderSchema.index({ tripId: 1 });
orderSchema.index({ warehouseId: 1 });
orderSchema.index({ destinationWarehouseId: 1 });
orderSchema.index({ shippingMode: 1 });
orderSchema.index({ warehouseId: 1, deletedAt: 1, createdAt: -1 });
orderSchema.index({ warehouseId: 1, status: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ codSettled: 1, status: 1 });
orderSchema.index({ deletedAt: -1 });
orderSchema.index({ createdAt: -1 });

const Order = mongoose.model("Order", orderSchema);

export default Order;
