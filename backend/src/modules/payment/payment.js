import mongoose from "mongoose";

import PAYMENT_STATUSES from "../../constants/paymentStatuses.js";
import PAYMENT_METHODS, {
  PAYER_TYPES,
} from "../../constants/paymentMethods.js";
import PAYMENT_PURPOSES from "../../constants/paymentPurposes.js";

import { integerAmount, integerMoney } from "../../utils/integerMoneySchema.js";

const paymentsSchema = new mongoose.Schema(
  {
    paymentCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      default: null,
    },

    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },

    codOrders: [
      {
        orderId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Order",
          required: true,
        },

        expectedCod: integerMoney({
          default: 0,
        }),
        collectedAmount: integerMoney({
          default: 0,
        }),
        remittedAmount: integerMoney({
          default: 0,
        }),
        shortfallAmount: integerMoney({
          default: 0,
        }),
      },
    ],

    discrepancyAmount: integerAmount({
      default: 0,
    }),

    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trip",
      default: null,
    },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },

    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      default: null,
    },

    payerType: {
      type: String,
      enum: Object.values(PAYER_TYPES),
      required: true,
    },

    purpose: {
      type: String,
      enum: Object.values(PAYMENT_PURPOSES),
      default: PAYMENT_PURPOSES.STANDARD,
    },

    paymentDate: {
      type: Date,
      default: Date.now,
      required: true,
    },

    paymentAmount: integerMoney({
      required: true,
    }),

    refundedAmount: integerMoney({
      default: 0,
    }),

    refundHistory: [
      {
        amount: integerMoney({ required: true }),
        reason: { type: String, trim: true, default: "" },
        refundedAt: { type: Date, required: true },
        refundedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
      },
    ],

    paymentMethod: {
      type: String,
      enum: Object.values(PAYMENT_METHODS),
      required: true,
    },

    paymentStatus: {
      type: String,
      enum: Object.values(PAYMENT_STATUSES),
      default: PAYMENT_STATUSES.PENDING,
    },

    transactionReference: {
      type: String,
      trim: true,
      default: null,
    },

    handledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    proofUrl: {
      type: String,
      trim: true,
      default: null,
    },

    notes: {
      type: String,
      trim: true,
      default: "",
    },

    refundDetails: {
      amount: integerMoney({ default: null }),
      refundReason: { type: String, default: null },
      refundedAt: { type: Date, default: null },
      refundedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
    },
  },
  { timestamps: true },
);

paymentsSchema.index({ invoiceId: 1 });
paymentsSchema.index({ orderId: 1 });
paymentsSchema.index({ tripId: 1 });
paymentsSchema.index({ customerId: 1 });
paymentsSchema.index({ driverId: 1 });
paymentsSchema.index({ paymentStatus: 1, paymentDate: -1 });
paymentsSchema.index({ payerType: 1 });
paymentsSchema.index({ createdAt: -1 });
paymentsSchema.index(
  { paymentMethod: 1, transactionReference: 1 },
  {
    unique: true,
    partialFilterExpression: { purpose: PAYMENT_PURPOSES.WALLET_TOP_UP },
  },
);

const Payment = mongoose.model("Payment", paymentsSchema);

export default Payment;
