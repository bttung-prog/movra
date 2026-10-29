import mongoose from "mongoose";

const tripExpensesSchema = new mongoose.Schema(
  {
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trip",
      required: true,
    },

    expenseType: {
      type: String,
      enum: ["fuel", "toll", "parking", "repair", "other"],
      required: true,
    },

    expenseAmount: {
      type: Number,
      required: true,
    },

    expenseDate: {
      type: Date,
      required: true,
    },

    note: {
      type: String,
    },

    receiptUrl: {
      type: String,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

const TripExpense = mongoose.model("TripExpense", tripExpensesSchema);

export default TripExpense;
