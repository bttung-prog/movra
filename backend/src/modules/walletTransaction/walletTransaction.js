import mongoose from "mongoose";

import {
  WALLET_TRANSACTION_TYPES,
  WALLET_TRANSACTION_DIRECTIONS,
} from "../../constants/walletTransactionTypes.js";
import { WALLET_TRANSACTION_STATUSES } from "../../constants/walletTransactionStatuses.js";

import { integerMoney } from "../../utils/integerMoneySchema.js";

const walletTransactionSchema = new mongoose.Schema(
  {
    transactionCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    type: {
      type: String,
      enum: Object.values(WALLET_TRANSACTION_TYPES),
      required: true,
    },

    direction: {
      type: String,
      enum: Object.values(WALLET_TRANSACTION_DIRECTIONS),
      default: null,
    },

    adjustmentDirection: {
      type: String,
      enum: ["credit", "debit"],
      default: null,
    },

    reason: {
      type: String,
      trim: true,
      default: null,
    },

    handledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    amount: {
      required: true,
      ...integerMoney({ min: 1 }),
    },

    balanceBefore: {
      required: true,
      ...integerMoney(),
    },

    balanceAfter: {
      required: true,
      ...integerMoney(),
    },

    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },

    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },

    settlementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CodSettlement",
      default: null,
    },

    status: {
      type: String,
      enum: Object.values(WALLET_TRANSACTION_STATUSES),
      default: WALLET_TRANSACTION_STATUSES.SUCCESS,
    },

    notes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

walletTransactionSchema.index({ customerId: 1, createdAt: -1 });
walletTransactionSchema.index({ paymentId: 1 });
walletTransactionSchema.index({ settlementId: 1 });
walletTransactionSchema.index({ type: 1 });
walletTransactionSchema.index({ status: 1 });

const WalletTransaction = mongoose.model(
  "WalletTransaction",
  walletTransactionSchema,
);

export default WalletTransaction;
