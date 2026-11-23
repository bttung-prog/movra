import { ROLES } from "../../constants/roles.js";
import { COMMON_MESSAGES, TRIP_MESSAGES } from "../../constants/messages.js";

import { ApiError } from "../../utils/ApiError.js";
import {
  getActorUserIdString,
  getReferenceIdString,
} from "../../utils/actor.util.js";

import driverService from "../driver/driver.service.js";
import userService from "../user/user.service.js";

import tripRepository from "./trip.repository.js";
import tripExpenseRepository from "./tripExpense.repository.js";
import tripAccess from "./trip.access.js";

const ensureTripAccess = async (
  tripId,
  requireNotDeleted = true,
  user = null,
) => {
  const trip = await tripRepository.findById(tripId);
  if (!trip) {
    throw new ApiError(404, TRIP_MESSAGES.NOT_FOUND);
  }
  if (requireNotDeleted && trip.deletedAt !== null) {
    throw new ApiError(400, TRIP_MESSAGES.ALREADY_DELETED);
  }
  await tripAccess.assertTripWarehouseAccess(trip, user);
  return trip;
};

const addExpense = async (
  tripId,
  { expenseType, expenseAmount, expenseDate, note, receiptUrl, createdBy },
  user = null,
) => {
  const trip = await ensureTripAccess(tripId, true, user);

  if (user && user.role === ROLES.DRIVER) {
    const driver = await driverService.getById(trip.driverId?._id);

    if (getReferenceIdString(driver.userId) !== getActorUserIdString(user)) {
      throw new ApiError(403, TRIP_MESSAGES.NOT_ASSIGNED_DRIVER);
    }
  }

  if (createdBy) {
    await userService.getById(createdBy);
  }

  return tripExpenseRepository.create({
    tripId,
    expenseType,
    expenseAmount,
    expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
    note,
    receiptUrl,
    createdBy,
  });
};

const getExpensesByTripId = async (
  tripId,
  { page = 1, limit = 20, user = null } = {},
) => {
  await ensureTripAccess(tripId, false, user);

  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const limitNumber = Math.max(1, parseInt(limit, 10) || 20);
  const skip = (pageNumber - 1) * limitNumber;

  const [expenses, total, totalAmount] = await Promise.all([
    tripExpenseRepository.findByTripId(tripId, {
      skip,
      limit: limitNumber,
    }),
    tripExpenseRepository.countByTripId(tripId),
    tripExpenseRepository.calculateTotalByTripId(tripId),
  ]);

  return {
    data: expenses,
    totalExpenseAmount: totalAmount,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages: Math.ceil(total / limitNumber),
    },
  };
};

const getTotalExpensesByTripId = async (tripId, user = null) => {
  await ensureTripAccess(tripId, false, user);

  const totalAmount =
    await tripExpenseRepository.calculateTotalByTripId(tripId);

  return { tripId, totalAmount };
};

const updateExpenseById = async (expenseId, updateData, user = null) => {
  if (user?.role === ROLES.DRIVER) {
    throw new ApiError(403, COMMON_MESSAGES.FORBIDDEN);
  }

  const existingExpense = await tripExpenseRepository.findById(expenseId);

  if (!existingExpense) {
    throw new ApiError(404, TRIP_MESSAGES.EXPENSE_NOT_FOUND);
  }

  await ensureTripAccess(existingExpense.tripId, false, user);

  return tripExpenseRepository.updateById(expenseId, updateData);
};

const deleteExpenseById = async (expenseId, user = null) => {
  const existingExpense = await tripExpenseRepository.findById(expenseId);

  if (!existingExpense) {
    throw new ApiError(404, TRIP_MESSAGES.EXPENSE_NOT_FOUND);
  }

  await ensureTripAccess(existingExpense.tripId, false, user);

  if (user && user.role === ROLES.DRIVER) {
    if (
      getReferenceIdString(existingExpense.createdBy) !==
      getActorUserIdString(user)
    ) {
      throw new ApiError(403, TRIP_MESSAGES.EXPENSE_DELETE_OWN_ONLY);
    }
  }

  return tripExpenseRepository.deleteById(expenseId);
};

export default {
  addExpense,
  getExpensesByTripId,
  getTotalExpensesByTripId,
  updateExpenseById,
  deleteExpenseById,
};
