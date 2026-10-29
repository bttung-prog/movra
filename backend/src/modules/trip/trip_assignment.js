import mongoose from "mongoose";

const tripAssignmentsSchema = new mongoose.Schema(
  {
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trip",
      required: true,
    },

    oldVehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
    },

    newVehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
    },

    oldDriverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
    },

    newDriverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
    },

    reason: {
      type: String,
    },

    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  },
);

const TripAssignment = mongoose.model("TripAssignment", tripAssignmentsSchema);

export default TripAssignment;
