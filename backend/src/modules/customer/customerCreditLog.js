import mongoose from "mongoose";

const creditChangeSchema = new mongoose.Schema(
  {
    from: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    to: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { _id: false },
);

const customerCreditLogSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    changes: {
      creditLimit: {
        type: creditChangeSchema,
        default: undefined,
      },

      defaultPaymentTerms: {
        type: creditChangeSchema,
        default: undefined,
      },

      contractDiscountRate: {
        type: creditChangeSchema,
        default: undefined,
      },
    },

    note: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true },
);

customerCreditLogSchema.index({ customerId: 1, createdAt: -1 });

const CustomerCreditLog = mongoose.model(
  "CustomerCreditLog",
  customerCreditLogSchema,
);

export default CustomerCreditLog;
