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

vi.mock("../../../src/utils/generateCode.js", () => ({
  default: mocks.generateCode,
}));

import { WALLET_TRANSACTION_MESSAGES } from "../../../src/constants/messages.js";
import ROLES from "../../../src/constants/roles.js";
import walletTransactionService from "../../../src/modules/walletTransaction/walletTransaction.service.js";

const customerId = "customer-1";
const transactionId = "transaction-1";
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

  it("rejects invalid top-up details before accessing the database", async () => {
    await expect(
      walletTransactionService.topUp(
        {
          amount: 0,
          transactionReference: "REF-1",
        },
        { role: ROLES.CUSTOMER, customerId },
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: WALLET_TRANSACTION_MESSAGES.INVALID_TOPUP,
    });
    expect(mocks.getCustomerById).not.toHaveBeenCalled();
    expect(mocks.createWalletTopUp).not.toHaveBeenCalled();
  });
});

describe("walletTransactionService.adjustWallet", () => {
  it("requires an authenticated admin and a valid positive amount", async () => {
    await expect(
      walletTransactionService.adjustWallet(
        { customerId, amount: 250, direction: "credit", reason: "Correction" },
        { role: ROLES.CUSTOMER, userId: "user-1" },
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: WALLET_TRANSACTION_MESSAGES.ADMIN_ONLY_ADJUSTMENT,
    });

    await expect(
      walletTransactionService.adjustWallet(
        { customerId, amount: 0, direction: "credit", reason: "Correction" },
        { role: ROLES.ADMIN, userId: "admin-1" },
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: WALLET_TRANSACTION_MESSAGES.INVALID_ADJUSTMENT,
    });
    expect(mocks.getCustomerById).not.toHaveBeenCalled();
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
