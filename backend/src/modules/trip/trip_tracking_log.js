import mongoose from "mongoose";

const tripTrackingLogsSchema = new mongoose.Schema(
  {
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trip",
      required: true,
    },

    status: {
      type: String,
      required: true,
      enum: [
        "planned",
        "departed",
        "in_progress",
        "arrived_destination",
        "completed",
        "cancelled",
        "incident",
      ],
    },

    latitude: {
      type: Number,
      required: true,
    },

    longitude: {
      type: Number,
      required: true,
    },

    address: {
      type: String,
      default: null,
      trim: true,
    },

    speed: {
      type: Number,
      default: null,
    },

    notes: {
      type: String,
      default: null,
      trim: true,
    },

    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

tripTrackingLogsSchema.index({ tripId: 1, createdAt: -1 });

const TripTrackingLog = mongoose.model(
  "TripTrackingLog",
  tripTrackingLogsSchema,
);

export default TripTrackingLog;
