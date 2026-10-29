import mongoose from "mongoose";

export const SETTLEMENT_STATUSES = {
  DRAFT: "draft",
  CONFIRMED: "confirmed",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

export const PAYOUT_METHODS = {
  WALLET: "wallet",
  BANK_TRANSFER: "bank_transfer",
};

const codSettlementSchema = new mongoose.Schema(
  {
    settlementCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    codAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    netPayoutAmount: {
      type: Number,
      required: true,
      default: 0,
    },

    payoutMethod: {
      type: String,
      enum: Object.values(PAYOUT_METHODS),
      default: PAYOUT_METHODS.WALLET,
      required: true,
    },

    bankDetails: {
      bankName: { type: String, trim: true, default: null },
      accountNumber: { type: String, trim: true, default: null },
      accountHolder: { type: String, trim: true, default: null },
    },

    bankTransferReference: {
      type: String,
      trim: true,
      default: null,
    },

    status: {
      type: String,
      enum: Object.values(SETTLEMENT_STATUSES),
      default: SETTLEMENT_STATUSES.DRAFT,
      required: true,
    },

    handledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    settledAt: {
      type: Date,
      default: null,
    },

    notes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true },
);

codSettlementSchema.index({ customerId: 1, createdAt: -1 });
codSettlementSchema.index({ status: 1, createdAt: -1 });
codSettlementSchema.index(
  { orderId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["draft", "confirmed", "completed"] },
    },
  },
);

const CodSettlement = mongoose.model("CodSettlement", codSettlementSchema);

export default CodSettlement;
