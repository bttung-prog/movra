import mongoose from "mongoose";

const routeSchema = new mongoose.Schema(
  {
    originWarehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
    },

    destinationWarehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
    },

    distance: {
      type: Number,
      required: true,
    },

    expectedDuration: {
      type: Number,
      required: true,
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

routeSchema.index(
  { originWarehouseId: 1, destinationWarehouseId: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
routeSchema.index({ deletedAt: -1 });

const Route = mongoose.model("Route", routeSchema);

export default Route;

