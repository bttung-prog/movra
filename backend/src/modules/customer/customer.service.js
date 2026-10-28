import { CUSTOMER_MESSAGES } from "../../constants/messages.js";
import ROLES from "../../constants/roles.js";

import ApiError from "../../utils/ApiError.js";

import userService from "../user/user.service.js";

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

  if (search && search.trim()) {
    const matchingUsers = await userService.searchPaginated(search.trim(), {
      page: pageNumber,
      limit: limitNumber,
      filter: { role: ROLES.CUSTOMER },
    });
    const userIds = matchingUsers.data.map((user) => user._id);
    let customers = [];

    if (userIds.length > 0) {
      const pageCustomers = await customerRepository.findAll({
        filter: { ...filter, userId: { $in: userIds } },
        skip: 0,
        limit: userIds.length,
      });
      const customersByUserId = new Map(
        pageCustomers.map((customer) => [
          String(customer.userId?._id || customer.userId),
          customer,
        ]),
      );
      customers = matchingUsers.data
        .map((user) => customersByUserId.get(String(user._id)))
        .filter(Boolean);
    }

    return {
      data: customers,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        totalCustomers: matchingUsers.pagination.totalUsers,
        totalPages: matchingUsers.pagination.totalPages,
      },
    };
  }

  const queryFilter = { ...filter };
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

export default {
  create,
  getAll,
  getById,
  getByUserId,
  updateById,
  updateByUserId,
  debitWallet,
  adjustWalletBalance,
};
