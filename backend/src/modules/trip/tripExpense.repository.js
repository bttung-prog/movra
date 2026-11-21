import mongoose from "mongoose";

import TripExpense from "./trip_expenses.js";

const EXPENSE_POPULATE = [
  {
    path: "createdBy",
    select: "fullName phone",
  },
];

const create = (expenseData, session = null) => {
  return TripExpense.create([expenseData], { session }).then((docs) => docs[0]);
};

const findByTripId = (
  tripId,
  { skip = 0, limit = 20, sort = { createdAt: -1 } } = {},
) => {
  return TripExpense.find({ tripId })
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate(EXPENSE_POPULATE)
    .lean();
};

const countByTripId = (tripId) => {
  return TripExpense.countDocuments({ tripId });
};

const findById = (expenseId) => {
  return TripExpense.findById(expenseId).populate(EXPENSE_POPULATE).lean();
};

const calculateTotalByTripId = async (tripId) => {
  const result = await TripExpense.aggregate([
    {
      $match: {
        tripId: mongoose.Types.ObjectId.createFromHexString(String(tripId)),
      },
    },
    { $group: { _id: "$tripId", totalAmount: { $sum: "$expenseAmount" } } },
  ]);

  return result.length > 0 ? result[0].totalAmount : 0;
};

const updateById = (expenseId, updateData, session = null) => {
  return TripExpense.findByIdAndUpdate(expenseId, updateData, {
    new: true,
    runValidators: true,
    session,
  })
    .populate(EXPENSE_POPULATE)
    .lean();
};

const deleteById = (expenseId, session = null) => {
  return TripExpense.findByIdAndDelete(expenseId, { session });
};

export default {
  create,
  findByTripId,
  countByTripId,
  findById,
  calculateTotalByTripId,
  updateById,
  deleteById,
};
