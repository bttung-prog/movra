import mongoose from "mongoose";

const accountantSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      unique: true,
      required: true,
    },

    accountantCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      trim: true,
      required: true,
    },
  },
  { timestamps: true },
);

accountantSchema.index({ status: 1 });

const Accountant = mongoose.model("Accountant", accountantSchema);

export default Accountant;
