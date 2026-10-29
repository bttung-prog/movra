import mongoose from "mongoose";
import ISSUE_STATUSES from "../../constants/issueStatuses.js";

const warehouseIssueSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },

    goodsCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GoodsCategory",
      required: true,
    },

    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
    },

    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trip",
      required: true,
    },

    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    issuedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    status: {
      type: String,
      enum: Object.values(ISSUE_STATUSES),
      default: ISSUE_STATUSES.COMPLETED,
    },

    issueCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    note: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

warehouseIssueSchema.index({ orderId: 1, createdAt: -1 });
warehouseIssueSchema.index({ orderId: 1, status: 1 });
warehouseIssueSchema.index({ warehouseId: 1, createdAt: -1 });
warehouseIssueSchema.index({ tripId: 1, createdAt: -1 });
warehouseIssueSchema.index({ goodsCategoryId: 1 });
warehouseIssueSchema.index({ issuedBy: 1 });
warehouseIssueSchema.index({ status: 1 });
warehouseIssueSchema.index({ issuedAt: -1 });
warehouseIssueSchema.index({ createdAt: -1 });

const WarehouseIssue = mongoose.model("WarehouseIssue", warehouseIssueSchema);

export default WarehouseIssue;
