import mongoose from "mongoose";

import ROLES from "../../constants/roles.js";
import PAYMENT_METHODS from "../../constants/paymentMethods.js";
import { WALLET_TRANSACTION_MESSAGES } from "../../constants/messages.js";
import { WALLET_TRANSACTION_TYPES } from "../../constants/walletTransactionTypes.js";
import { WALLET_TRANSACTION_STATUSES } from "../../constants/walletTransactionStatuses.js";

import ApiError from "../../utils/ApiError.js";
import generateCode from "../../utils/generateCode.js";

import customerService from "../customer/customer.service.js";
import paymentService from "../payment/payment.service.js";

import walletTransactionRepository from "./walletTransaction.repository.js";

const recordTransaction = async (data, session = null) => {
  const transactionCode = data.transactionCode || generateCode("WTRX");
  return walletTransactionRepository.create(
    {
      ...data,
      transactionCode,
    },
    session,
  );
};

const topUp = async (payload, actor) => {
  const {
    amount,
    paymentMethod = PAYMENT_METHODS.BANK,
    transactionReference,
    proofUrl,
    notes = "",
  } = payload;

  const customerId = actor?.customerId;
  if (actor?.role !== ROLES.CUSTOMER) {
    throw new ApiError(403, WALLET_TRANSACTION_MESSAGES.TOPUP_CUSTOMER_ONLY);
  }

  if (!customerId) {
    throw new ApiError(
      400,
      WALLET_TRANSACTION_MESSAGES.CUSTOMER_REQUIRED_FOR_TOPUP,
    );
  }

  if (
    !Number.isSafeInteger(Number(amount)) ||
    Number(amount) <= 0 ||
    ![PAYMENT_METHODS.BANK, PAYMENT_METHODS.E_WALLET].includes(paymentMethod) ||
    typeof transactionReference !== "string" ||
    !transactionReference.trim()
  ) {
    throw new ApiError(400, WALLET_TRANSACTION_MESSAGES.INVALID_TOPUP);
  }
  const cleanReference = transactionReference.trim();

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    await customerService.getById(customerId, session);

    const paymentCode = generateCode("PAY");
    const paymentData = {
      paymentCode,
      customerId,
      paymentDate: new Date(),
      paymentAmount: Number(amount),
      paymentMethod,
      transactionReference: cleanReference,
      handledBy: null,
      proofUrl: proofUrl || null,
      notes: notes || "Nạp tiền vào ví khách hàng",
    };

    const payment = await paymentService.createWalletTopUp(
      paymentData,
      session,
    );

    await session.commitTransaction();

    return { payment, credited: false };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const adjustWallet = async (payload, actor) => {
  const { customerId, amount, direction, reason } = payload;
  if (!actor?.userId || actor.role !== ROLES.ADMIN) {
    throw new ApiError(403, WALLET_TRANSACTION_MESSAGES.ADMIN_ONLY_ADJUSTMENT);
  }

  const adjustmentAmount = Number(amount);
  if (!Number.isSafeInteger(adjustmentAmount) || adjustmentAmount <= 0) {
    throw new ApiError(400, WALLET_TRANSACTION_MESSAGES.INVALID_ADJUSTMENT);
  }

  const balanceChange =
    direction === "debit" ? -adjustmentAmount : adjustmentAmount;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const customer = await customerService.getById(customerId, session);
    const balanceBefore = Number(customer.walletBalance || 0);
    const balanceAfter = balanceBefore + balanceChange;
    if (balanceAfter < 0) {
      throw new ApiError(
        400,
        WALLET_TRANSACTION_MESSAGES.INSUFFICIENT_BALANCE_FOR_ADJUSTMENT,
      );
    }

    const updatedCustomer = await customerService.adjustWalletBalance(
      customerId,
      balanceChange,
      session,
    );
    if (!updatedCustomer) {
      throw new ApiError(409, WALLET_TRANSACTION_MESSAGES.BALANCE_CHANGED);
    }

    const walletTransaction = await recordTransaction(
      {
        customerId,
        type: WALLET_TRANSACTION_TYPES.ADJUSTMENT,
        amount: adjustmentAmount,
        adjustmentDirection: direction,
        balanceBefore,
        balanceAfter,
        reason,
        handledBy: actor.userId,
        status: WALLET_TRANSACTION_STATUSES.SUCCESS,
        notes: reason,
      },
      session,
    );

    await session.commitTransaction();
    return { walletTransaction, newBalance: balanceAfter };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const getAll = async ({
  filter = {},
  page = 1,
  limit = 10,
  sort = { createdAt: -1 },
} = {}) => {
  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const limitNumber = Math.max(1, parseInt(limit, 10) || 10);
  const skip = (pageNumber - 1) * limitNumber;

  const [transactions, total] = await Promise.all([
    walletTransactionRepository.findAll({
      filter,
      skip,
      limit: limitNumber,
      sort,
    }),
    walletTransactionRepository.countAll({ filter }),
  ]);

  return {
    transactions,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages: Math.ceil(total / limitNumber),
    },
  };
};

const assertCustomerTransactionAccess = (transaction, actor) => {
  const transactionCustomerId =
    transaction.customerId?._id || transaction.customerId;

  if (
    !actor?.customerId ||
    !transactionCustomerId ||
    transactionCustomerId.toString() !== actor.customerId.toString()
  ) {
    throw new ApiError(403, WALLET_TRANSACTION_MESSAGES.ACCESS_DENIED);
  }
};

const getById = async (id, actor = null) => {
  const transaction = await walletTransactionRepository.findById(id);
  if (!transaction) {
    throw new ApiError(404, WALLET_TRANSACTION_MESSAGES.NOT_FOUND);
  }

  if (actor?.role === ROLES.CUSTOMER) {
    assertCustomerTransactionAccess(transaction, actor);
  }

  return transaction;
};

const getByCode = async (code, actor = null) => {
  const transaction = await walletTransactionRepository.findByCode(code);
  if (!transaction) {
    throw new ApiError(404, WALLET_TRANSACTION_MESSAGES.NOT_FOUND);
  }

  if (actor?.role === ROLES.CUSTOMER) {
    assertCustomerTransactionAccess(transaction, actor);
  }

  return transaction;
};

export default {
  recordTransaction,
  topUp,
  adjustWallet,
  getAll,
  getById,
  getByCode,
};
