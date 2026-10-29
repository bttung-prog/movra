import mongoose from "mongoose";

import INVOICE_STATUSES from "../../constants/invoiceStatuses.js";

import { integerMoney } from "../../utils/integerMoneySchema.js";

const invoiceItemSchema = new mongoose.Schema(
  {
    description: {
      type: String,
      required: true,
      trim: true,
    },

    quantity: {
      type: Number,
      default: 1,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: "Quantity must be a safe integer",
      },
    },

    unitPrice: integerMoney({
      required: true,
    }),

    amount: integerMoney({
      required: true,
    }),
  },
  { _id: false },
);

const invoicesSchema = new mongoose.Schema(
  {
    invoiceCode: {
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

    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },

    items: {
      type: [invoiceItemSchema],
      default: [],
    },

    subTotal: integerMoney({
      required: true,
    }),

    tax: integerMoney({
      default: 0,
    }),

    discount: integerMoney({
      default: 0,
    }),

    totalAmount: integerMoney({
      required: true,
    }),

    paidAmount: integerMoney({
      default: 0,
    }),

    remainingAmount: integerMoney({
      required: true,
    }),

    status: {
      type: String,
      enum: Object.values(INVOICE_STATUSES),
      default: INVOICE_STATUSES.DRAFT,
    },

    paymentTerms: {
      type: String,
      enum: ["immediate", "net_15", "net_30"],
      default: "immediate",
    },

    issueDate: {
      type: Date,
      default: Date.now,
    },

    dueDate: {
      type: Date,
      required: true,
    },

    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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

invoicesSchema.index({ customerId: 1, status: 1 });
invoicesSchema.index(
  { orderId: 1 },
  {
    name: "one_active_invoice_per_order",
    unique: true,
    partialFilterExpression: {
      orderId: { $type: "objectId" },
      status: {
        $in: [
          INVOICE_STATUSES.DRAFT,
          INVOICE_STATUSES.ISSUED,
          INVOICE_STATUSES.PARTIALLY_PAID,
          INVOICE_STATUSES.PAID,
          INVOICE_STATUSES.OVERDUE,
        ],
      },
    },
  },
);
invoicesSchema.index({ status: 1, dueDate: 1 });
invoicesSchema.index({ createdAt: -1 });

const Invoice = mongoose.model("Invoice", invoicesSchema);

export default Invoice;
