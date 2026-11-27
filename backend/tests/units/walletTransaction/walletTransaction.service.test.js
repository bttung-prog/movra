import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findAll: vi.fn(),
  countAll: vi.fn(),
  findById: vi.fn(),
  findByCode: vi.fn(),
  getCustomerById: vi.fn(),
  adjustWalletBalance: vi.fn(),
  createWalletTopUp: vi.fn(),
  generateCode: vi.fn(),
  startSession: vi.fn(),
  notifyTopUpPending: vi.fn(),
  notifyWalletAdjusted: vi.fn(),
}));

vi.mock(
  "../../../src/modules/walletTransaction/walletTransaction.repository.js",
  () => ({
    default: {
      create: mocks.create,
      findAll: mocks.findAll,
      countAll: mocks.countAll,
      findById: mocks.findById,
      findByCode: mocks.findByCode,
    },
  }),
);

vi.mock("../../../src/modules/customer/customer.service.js", () => ({
  default: {
    getById: mocks.getCustomerById,
    adjustWalletBalance: mocks.adjustWalletBalance,
  },
}));

vi.mock("../../../src/modules/payment/payment.service.js", () => ({
  default: { createWalletTopUp: mocks.createWalletTopUp },
}));

vi.mock(
  "../../../src/modules/walletTransaction/walletNotification.service.js",
  () => ({
    default: {
      notifyTopUpPending: mocks.notifyTopUpPending,
      notifyWalletAdjusted: mocks.notifyWalletAdjusted,
    },
  }),
);

vi.mock("mongoose", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: { ...actual.default, startSession: mocks.startSession },
  };
});

vi.mock("../../../src/utils/generateCode.js", () => ({
  generateCode: mocks.generateCode,
}));

import { WALLET_TRANSACTION_MESSAGES } from "../../../src/constants/messages.js";
import { ROLES } from "../../../src/constants/roles.js";
import walletTransactionService from "../../../src/modules/walletTransaction/walletTransaction.service.js";

const customerId = "customer-1";
const transactionId = "transaction-1";
const session = {
  startTransaction: vi.fn(),
  commitTransaction: vi.fn().mockResolvedValue(undefined),
  abortTransaction: vi.fn().mockResolvedValue(undefined),
  endSession: vi.fn(),
};
const transaction = {
  _id: transactionId,
  customerId,
  transactionCode: "WTRX-0001",
  amount: 250,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.generateCode.mockReturnValue("WTRX-0001");
  mocks.create.mockResolvedValue(transaction);
  mocks.findAll.mockResolvedValue([transaction]);
  mocks.countAll.mockResolvedValue(21);
  mocks.findById.mockResolvedValue(transaction);
  mocks.findByCode.mockResolvedValue(transaction);
  mocks.startSession.mockResolvedValue(session);
  mocks.notifyTopUpPending.mockResolvedValue(2);
  mocks.notifyWalletAdjusted.mockResolvedValue(1);
});

describe("walletTransactionService.recordTransaction", () => {
  it("generates a transaction code when one is not supplied", async () => {
    await walletTransactionService.recordTransaction({
      customerId,
      amount: 250,
    });

    expect(mocks.generateCode).toHaveBeenCalledWith("WTRX");
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId,
        amount: 250,
        transactionCode: "WTRX-0001",
      }),
      null,
    );
  });

  it("preserves a supplied transaction code and forwards the session", async () => {
    const session = { id: "session-1" };

    await walletTransactionService.recordTransaction(
      { customerId, transactionCode: "CUSTOM-1" },
      session,
    );

    expect(mocks.generateCode).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ transactionCode: "CUSTOM-1" }),
      session,
    );
  });
});

describe("walletTransactionService.topUp", () => {
  it("requires a customer role and a customer profile", async () => {
    await expect(
      walletTransactionService.topUp(
        { amount: 1000, transactionReference: "REF-1" },
        { role: ROLES.ADMIN, customerId },
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: WALLET_TRANSACTION_MESSAGES.TOPUP_CUSTOMER_ONLY,
    });

    await expect(
      walletTransactionService.topUp(
        { amount: 1000, transactionReference: "REF-1" },
        { role: ROLES.CUSTOMER },
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: WALLET_TRANSACTION_MESSAGES.CUSTOMER_REQUIRED_FOR_TOPUP,
    });
    expect(mocks.createWalletTopUp).not.toHaveBeenCalled();
  });

  it("creates a pending top-up and notifies the customer and accountants", async () => {
    const customer = {
      _id: customerId,
      userId: { _id: "customer-user-1" },
      walletBalance: 500000,
    };
    const payment = {
      _id: "payment-1",
      paymentCode: "PAY-0001",
      paymentAmount: 100000,
      paymentStatus: "pending",
      purpose: "wallet_top_up",
    };
    const actor = {
      role: ROLES.CUSTOMER,
      customerId,
      userId: "customer-user-1",
    };
    mocks.getCustomerById.mockResolvedValue(customer);
    mocks.createWalletTopUp.mockResolvedValue(payment);

    const result = await walletTransactionService.topUp(
      {
        amount: 100000,
        paymentMethod: "bank",
        transactionReference: "  REF-1  ",
      },
      actor,
    );

    expect(mocks.getCustomerById).toHaveBeenCalledWith(customerId, session);
    expect(mocks.createWalletTopUp).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId,
        paymentAmount: 100000,
        transactionReference: "REF-1",
        paymentMethod: "bank",
      }),
      session,
    );
    expect(mocks.notifyTopUpPending).toHaveBeenCalledWith({
      payment,
      customer,
      actor,
    });
    expect(result).toEqual({ payment, credited: false });
    expect(session.commitTransaction).toHaveBeenCalled();
  });
});

describe("walletTransactionService.adjustWallet", () => {
  it("requires an authenticated admin or accountant", async () => {
    await expect(
      walletTransactionService.adjustWallet(
        { customerId, amount: 250, direction: "credit", reason: "Correction" },
        { role: ROLES.CUSTOMER, userId: "user-1" },
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: WALLET_TRANSACTION_MESSAGES.ADMIN_ONLY_ADJUSTMENT,
    });
    expect(mocks.getCustomerById).not.toHaveBeenCalled();
  });

  it("adjusts the balance and notifies the customer", async () => {
    const customer = {
      _id: customerId,
      userId: { _id: "customer-user-1" },
      walletBalance: 100000,
    };
    const updatedCustomer = {
      ...customer,
      walletBalance: 125000,
    };
    mocks.getCustomerById.mockResolvedValue(customer);
    mocks.adjustWalletBalance.mockResolvedValue(updatedCustomer);

    const result = await walletTransactionService.adjustWallet(
      {
        customerId,
        amount: 25000,
        direction: "credit",
        reason: "Correction",
      },
      { role: ROLES.ACCOUNTANT, userId: "accountant-1" },
    );

    expect(mocks.adjustWalletBalance).toHaveBeenCalledWith(
      customerId,
      25000,
      session,
    );
    expect(mocks.notifyWalletAdjusted).toHaveBeenCalledWith({
      customer: updatedCustomer,
      walletTransaction: transaction,
      direction: "credit",
      amount: 25000,
      balanceBefore: 100000,
      balanceAfter: 125000,
    });
    expect(result).toEqual({
      walletTransaction: transaction,
      newBalance: 125000,
    });
    expect(session.commitTransaction).toHaveBeenCalled();
  });
});

describe("walletTransactionService.getAll", () => {
  it("paginates transactions and returns metadata", async () => {
    const result = await walletTransactionService.getAll({
      filter: { customerId },
      page: 2,
      limit: 10,
    });

    expect(mocks.findAll).toHaveBeenCalledWith({
      filter: { customerId },
      skip: 10,
      limit: 10,
      sort: { createdAt: -1 },
    });
    expect(mocks.countAll).toHaveBeenCalledWith({ filter: { customerId } });
    expect(result).toEqual({
      transactions: [transaction],
      pagination: { page: 2, limit: 10, total: 21, totalPages: 3 },
    });
  });
});

describe("walletTransactionService.getById and getByCode", () => {
  it("returns a transaction belonging to the requesting customer", async () => {
    await expect(
      walletTransactionService.getById(transactionId, {
        role: ROLES.CUSTOMER,
        customerId,
      }),
    ).resolves.toBe(transaction);
    await expect(
      walletTransactionService.getByCode("WTRX-0001", {
        role: ROLES.CUSTOMER,
        customerId,
      }),
    ).resolves.toBe(transaction);
  });

  it("denies customer access to another customer's transaction", async () => {
    await expect(
      walletTransactionService.getById(transactionId, {
        role: ROLES.CUSTOMER,
        customerId: "another-customer",
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: WALLET_TRANSACTION_MESSAGES.ACCESS_DENIED,
    });
  });

  it("returns not found for unknown transaction IDs or codes", async () => {
    mocks.findById.mockResolvedValue(null);
    mocks.findByCode.mockResolvedValue(null);

    await expect(
      walletTransactionService.getById(transactionId),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: WALLET_TRANSACTION_MESSAGES.NOT_FOUND,
    });
    await expect(
      walletTransactionService.getByCode("MISSING"),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: WALLET_TRANSACTION_MESSAGES.NOT_FOUND,
    });
  });
});
