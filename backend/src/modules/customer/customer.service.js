import mongoose from "mongoose";

import { CREDIT_AUDIT_FIELDS } from "../../constants/creditAuditFields.js";
import { CUSTOMER_MESSAGES } from "../../constants/messages.js";

import { ApiError } from "../../utils/ApiError.js";
import { escapeRegex } from "../../utils/regexUtils.js";

import userService from "../user/user.service.js";

import customerCreditLogRepository from "./customerCreditLog.repository.js";
import customerRepository from "./customer.repository.js";

const create = async (userId, session = null) => {
  await userService.getById(userId, session);

  const existingCustomer = await customerRepository.findByUserId(
    userId,
    session,
  );

  if (existingCustomer) {
    throw new ApiError(409, CUSTOMER_MESSAGES.ALREADY_EXISTS);
  }

  return customerRepository.create(userId, session);
};

const getAll = async ({
  filter = {},
  page = 1,
  limit = 10,
  search = "",
} = {}) => {
  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const limitNumber = Math.max(1, parseInt(limit, 10) || 10);
  const skip = (pageNumber - 1) * limitNumber;

  let queryFilter = { ...filter };
  if (search && search.trim()) {
    const keyword = escapeRegex(search.trim());
    queryFilter = {
      $and: [
        filter,
        {
          $or: [
            { companyName: { $regex: keyword, $options: "i" } },
            { taxCode: { $regex: keyword, $options: "i" } },
          ],
        },
      ],
    };
  }

  const [customers, totalCustomers] = await Promise.all([
    customerRepository.findAll({
      filter: queryFilter,
      skip,
      limit: limitNumber,
    }),
    customerRepository.countAll(queryFilter),
  ]);

  return {
    data: customers,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      totalCustomers,
      totalPages: Math.ceil(totalCustomers / limitNumber),
    },
  };
};

const getById = async (customerId, session = null) => {
  const customer = await customerRepository.findById(customerId, session);

  if (!customer) {
    throw new ApiError(404, CUSTOMER_MESSAGES.NOT_FOUND);
  }

  return customer;
};

const getByUserId = async (userId, session = null) => {
  const customer = await customerRepository.findByUserId(userId, session);

  if (!customer) {
    throw new ApiError(404, CUSTOMER_MESSAGES.NOT_FOUND);
  }

  return customer;
};

const updateById = async (
  customerId,
  updateData,
  session = null,
  conditions = {},
) => {
  await getById(customerId, session);

  return customerRepository.updateById(
    customerId,
    updateData,
    session,
    conditions,
  );
};

const debitWallet = (customerId, amount, session = null) => {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(400, CUSTOMER_MESSAGES.INVALID_WALLET_DEBIT_AMOUNT);
  }

  return customerRepository.updateById(
    customerId,
    { $inc: { walletBalance: -amount } },
    session,
    { walletBalance: { $gte: amount } },
  );
};

const adjustWalletBalance = (customerId, amount, session = null) => {
  if (!Number.isFinite(amount) || amount === 0) {
    throw new ApiError(400, CUSTOMER_MESSAGES.INVALID_WALLET_ADJUSTMENT_AMOUNT);
  }

  return customerRepository.updateById(
    customerId,
    { $inc: { walletBalance: amount } },
    session,
    amount < 0 ? { walletBalance: { $gte: Math.abs(amount) } } : {},
  );
};

const updateByUserId = async (userId, updateData) => {
  const customer = await getByUserId(userId);

  return customerRepository.updateById(customer._id, updateData);
};

const buildCreditChanges = (existingCustomer, updates) => {
  const changes = {};

  for (const field of CREDIT_AUDIT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(updates, field)) {
      continue;
    }

    const previousValue = existingCustomer?.[field] ?? null;
    const nextValue = updates[field];

    if (previousValue !== nextValue) {
      changes[field] = {
        from: previousValue,
        to: nextValue,
      };
    }
  }

  return changes;
};

const updateByAdmin = async (customerId, updateData, changedBy = null) => {
  const { creditNote = "", ...customerUpdate } = updateData;
  const existingCustomer = await getById(customerId);
  const changes = buildCreditChanges(existingCustomer, customerUpdate);

  if (Object.keys(changes).length === 0) {
    return customerRepository.updateById(customerId, customerUpdate);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const updatedCustomer = await customerRepository.updateById(
      customerId,
      customerUpdate,
      session,
    );

    if (updatedCustomer) {
      await customerCreditLogRepository.create(
        {
          customerId,
          changedBy,
          changes,
          note: creditNote,
        },
        session,
      );
    }

    await session.commitTransaction();
    return updatedCustomer;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const getCreditHistory = async (customerId, { page = 1, limit = 20 } = {}) => {
  await getById(customerId);

  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const limitNumber = Math.max(1, parseInt(limit, 10) || 20);
  const skip = (pageNumber - 1) * limitNumber;

  const [logs, total] = await Promise.all([
    customerCreditLogRepository.findByCustomerId({
      customerId,
      skip,
      limit: limitNumber,
    }),
    customerCreditLogRepository.countByCustomerId(customerId),
  ]);

  return {
    data: logs,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages: Math.ceil(total / limitNumber),
    },
  };
};

export default {
  create,
  getAll,
  getById,
  getByUserId,
  updateById,
  updateByUserId,
  updateByAdmin,
  getCreditHistory,
  debitWallet,
  adjustWalletBalance,
};
