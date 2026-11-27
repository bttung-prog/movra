import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      enum: [
        "ORDER_UPDATE",
        "TRIP_UPDATE",
        "PAYMENT",
        "INVOICE",
        "COD",
        "SYSTEM",
        "FEEDBACK",
        "FEEDBACK_REQUEST",
        "MAINTENANCE",
        "WAREHOUSE",
        "VEHICLE",
        "ACCOUNT",
      ],
      default: "ORDER_UPDATE",
    },

    dedupeKey: {
      type: String,
      trim: true,
      default: null,
    },

    data: {
      orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
      },

      orderCode: {
        type: String,
        trim: true,
      },

      status: {
        type: String,
        trim: true,
      },

      previousRole: {
        type: String,
        trim: true,
      },

      role: {
        type: String,
        trim: true,
      },

      previousStatus: {
        type: String,
        trim: true,
      },

      event: {
        type: String,
        trim: true,
      },

      phase: {
        type: String,
        trim: true,
      },

      eventKey: {
        type: String,
        trim: true,
      },

      attempt: {
        type: Number,
        min: 0,
      },

      issueId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "WarehouseIssue",
      },

      issueCode: {
        type: String,
        trim: true,
      },

      receiptCode: {
        type: String,
        trim: true,
      },

      goodsCategoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "GoodsCategory",
      },

      quantity: {
        type: Number,
        min: 1,
      },

      previousCondition: {
        type: String,
        trim: true,
      },

      condition: {
        type: String,
        trim: true,
      },

      receiptId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Receipt",
      },

      fromWarehouseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Warehouse",
      },

      toWarehouseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Warehouse",
      },

      failedCount: {
        type: Number,
        min: 0,
      },

      returnedCount: {
        type: Number,
        min: 0,
      },

      orderCodes: {
        type: [String],
        default: undefined,
      },

      tripCode: {
        type: String,
        trim: true,
      },

      driverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Driver",
      },

      feedbackId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Feedback",
      },

      warehouseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Warehouse",
      },

      rating: {
        type: Number,
        min: 1,
        max: 5,
      },

      tags: {
        type: [String],
        default: undefined,
      },

      plannedStart: {
        type: Date,
      },

      action: {
        type: String,
        trim: true,
      },

      orderCount: {
        type: Number,
        min: 0,
      },

      tripId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Trip",
      },

      vehicleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Vehicle",
      },

      invoiceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Invoice",
      },

      invoiceCode: {
        type: String,
        trim: true,
      },

      orderIds: {
        type: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
          },
        ],
        default: undefined,
      },

      totalAmount: {
        type: Number,
        min: 0,
      },

      paidAmount: {
        type: Number,
        min: 0,
      },

      remainingAmount: {
        type: Number,
        min: 0,
      },

      dueDate: {
        type: Date,
      },

      paymentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Payment",
      },

      paymentCode: {
        type: String,
        trim: true,
      },

      purpose: {
        type: String,
        trim: true,
      },

      payerType: {
        type: String,
        trim: true,
      },

      amount: {
        type: Number,
        min: 0,
      },

      walletTransactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "WalletTransaction",
      },

      transactionCode: {
        type: String,
        trim: true,
      },

      direction: {
        type: String,
        trim: true,
      },

      balanceBefore: {
        type: Number,
        min: 0,
      },

      balanceAfter: {
        type: Number,
        min: 0,
      },

      vehicleType: {
        type: String,
        trim: true,
      },

      documentType: {
        type: String,
        trim: true,
      },

      expiryDate: {
        type: Date,
      },

      daysRemaining: {
        type: Number,
        min: 0,
      },

      notes: {
        type: String,
        trim: true,
      },

      remittanceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Payment",
      },

      refundAmount: {
        type: Number,
        min: 0,
      },

      settlementId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CodSettlement",
      },

      settlementCode: {
        type: String,
        trim: true,
      },

      netPayoutAmount: {
        type: Number,
        min: 0,
      },

      payoutMethod: {
        type: String,
        trim: true,
      },

      bankName: {
        type: String,
        trim: true,
      },

      scheduleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MaintenanceSchedule",
      },

      maintenanceLogId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MaintenanceLog",
      },

      plateNumber: {
        type: String,
        trim: true,
      },

      taskName: {
        type: String,
        trim: true,
      },

      dueKm: {
        type: Number,
        min: 0,
      },

      currentOdometer: {
        type: Number,
        min: 0,
      },

      cost: {
        type: Number,
        min: 0,
      },

      bankTransferReference: {
        type: String,
        trim: true,
      },
    },

    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },

    readAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index(
  { userId: 1, dedupeKey: 1 },
  {
    unique: true,
    partialFilterExpression: { dedupeKey: { $type: "string" } },
  },
);
notificationSchema.index({ createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
