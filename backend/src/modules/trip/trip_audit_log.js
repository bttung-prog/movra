import mongoose from "mongoose";

const tripAuditLogSchema = new mongoose.Schema(
  {
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trip",
      required: true,
    },

    action: {
      type: String,
      required: true,
      enum: [
        "created",
        "updated",
        "reassigned",
        "status_changed",
        "deleted",
        "restored",
      ],
    },

    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    changes: [
      {
        field: { type: String, required: true },
        oldValue: { type: mongoose.Schema.Types.Mixed, default: null },
        newValue: { type: mongoose.Schema.Types.Mixed, default: null },
      },
    ],
  },
  { timestamps: true },
);

tripAuditLogSchema.index({ tripId: 1, createdAt: -1 });

const TripAuditLog = mongoose.model("TripAuditLog", tripAuditLogSchema);

export default TripAuditLog;
