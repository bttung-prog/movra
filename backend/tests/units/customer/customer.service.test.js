import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findAll: vi.fn(),
  countAll: vi.fn(),
  findById: vi.fn(),
  findByUserId: vi.fn(),
  updateById: vi.fn(),
  getUserById: vi.fn(),
  startSession: vi.fn(),
  createCreditLog: vi.fn(),
  findCreditLogsByCustomerId: vi.fn(),
  countCreditLogsByCustomerId: vi.fn(),
}));

vi.mock("mongoose", async (importOriginal) => {
  const actual = await importOriginal();

  return {
    ...actual,
    default: { ...actual.default, startSession: mocks.startSession },
  };
});

vi.mock("../../../src/modules/customer/customer.repository.js", () => ({
  default: {
    create: mocks.create,
    findAll: mocks.findAll,
    countAll: mocks.countAll,
    findById: mocks.findById,
    findByUserId: mocks.findByUserId,
    updateById: mocks.updateById,
  },
}));

vi.mock(
  "../../../src/modules/customer/customerCreditLog.repository.js",
  () => ({
    default: {
      create: mocks.createCreditLog,
      findByCustomerId: mocks.findCreditLogsByCustomerId,
      countByCustomerId: mocks.countCreditLogsByCustomerId,
    },
  }),
);

vi.mock("../../../src/modules/user/user.service.js", () => ({
  default: {
    getById: mocks.getUserById,
  },
}));

import { CUSTOMER_MESSAGES } from "../../../src/constants/messages.js";
import { ROLES } from "../../../src/constants/roles.js";
import customerService from "../../../src/modules/customer/customer.service.js";
import { escapeRegex } from "../../../src/utils/regexUtils.js";

const customerId = "customer-1";
const userId = "user-1";
const customer = {
  _id: customerId,
  userId,
  walletBalance: 1000,
  totalSpent: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUserById.mockResolvedValue({ _id: userId, role: ROLES.CUSTOMER });
  mocks.findByUserId.mockResolvedValue(null);
  mocks.create.mockResolvedValue(customer);
  mocks.findAll.mockResolvedValue([customer]);
  mocks.countAll.mockResolvedValue(21);
  mocks.findById.mockResolvedValue(customer);
  mocks.updateById.mockResolvedValue(customer);
  mocks.findCreditLogsByCustomerId.mockResolvedValue([]);
  mocks.countCreditLogsByCustomerId.mockResolvedValue(0);
});

describe("customerService.create", () => {
  it("checks the user and creates a customer profile", async () => {
    const session = { id: "session-1" };

    await customerService.create(userId, session);

    expect(mocks.getUserById).toHaveBeenCalledWith(userId, session);
    expect(mocks.findByUserId).toHaveBeenCalledWith(userId, session);
    expect(mocks.create).toHaveBeenCalledWith(userId, session);
  });

  it("rejects a duplicate customer profile", async () => {
    mocks.findByUserId.mockResolvedValue(customer);

    await expect(customerService.create(userId)).rejects.toMatchObject({
      statusCode: 409,
      message: CUSTOMER_MESSAGES.ALREADY_EXISTS,
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

describe("customerService.getAll", () => {
  it("paginates customers without a search term", async () => {
    const result = await customerService.getAll({
      filter: { companyName: "Movra" },
      page: 2,
      limit: 10,
    });

    expect(mocks.findAll).toHaveBeenCalledWith({
      filter: { companyName: "Movra" },
      skip: 10,
      limit: 10,
    });
    expect(mocks.countAll).toHaveBeenCalledWith({ companyName: "Movra" });
    expect(result).toEqual({
      data: [customer],
      pagination: {
        page: 2,
        limit: 10,
        totalCustomers: 21,
        totalPages: 3,
      },
    });
  });

  it("searches customers by company name or tax code", async () => {
    const firstCustomer = { _id: "customer-2", companyName: "Movra" };
    const secondCustomer = {
      _id: "customer-3",
      companyName: "Movra Logistics",
    };
    mocks.findAll.mockResolvedValue([firstCustomer, secondCustomer]);
    mocks.countAll.mockResolvedValue(12);

    const result = await customerService.getAll({
      filter: { creditLimit: { $gt: 0 } },
      page: 2,
      limit: 5,
      search: "  Movra (JSC) ",
    });

    const keyword = escapeRegex("Movra (JSC)");
    const expectedFilter = {
      $and: [
        { creditLimit: { $gt: 0 } },
        {
          $or: [
            { companyName: { $regex: keyword, $options: "i" } },
            { taxCode: { $regex: keyword, $options: "i" } },
          ],
        },
      ],
    };

    expect(mocks.findAll).toHaveBeenCalledWith({
      filter: expectedFilter,
      skip: 5,
      limit: 5,
    });
    expect(mocks.countAll).toHaveBeenCalledWith(expectedFilter);
    expect(result).toEqual({
      data: [firstCustomer, secondCustomer],
      pagination: {
        page: 2,
        limit: 5,
        totalCustomers: 12,
        totalPages: 3,
      },
    });
  });

  it("returns an empty page when the keyword has no matches", async () => {
    mocks.findAll.mockResolvedValue([]);
    mocks.countAll.mockResolvedValue(0);

    const result = await customerService.getAll({ search: "missing" });

    expect(result.data).toEqual([]);
    expect(result.pagination.totalCustomers).toBe(0);
    expect(mocks.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, limit: 10 }),
    );
    expect(mocks.countAll).toHaveBeenCalled();
  });
});

describe("customerService lookups and updates", () => {
  it("returns customers by ID or user ID and reports missing records", async () => {
    mocks.findByUserId.mockResolvedValueOnce(customer);
    await expect(customerService.getById(customerId)).resolves.toBe(customer);
    await expect(customerService.getByUserId(userId)).resolves.toBe(customer);

    mocks.findById.mockResolvedValueOnce(null);
    await expect(customerService.getById(customerId)).rejects.toMatchObject({
      statusCode: 404,
      message: CUSTOMER_MESSAGES.NOT_FOUND,
    });
    mocks.findByUserId.mockResolvedValueOnce(null);
    await expect(customerService.getByUserId(userId)).rejects.toMatchObject({
      statusCode: 404,
      message: CUSTOMER_MESSAGES.NOT_FOUND,
    });
  });

  it("requires an existing customer before updating by ID", async () => {
    const updateData = { totalSpent: 100 };
    const session = { id: "session-1" };
    const conditions = { walletBalance: { $gte: 0 } };

    await customerService.updateById(
      customerId,
      updateData,
      session,
      conditions,
    );

    expect(mocks.findById).toHaveBeenCalledWith(customerId, session);
    expect(mocks.updateById).toHaveBeenCalledWith(
      customerId,
      updateData,
      session,
      conditions,
    );

    mocks.findById.mockResolvedValueOnce(null);
    await expect(
      customerService.updateById(customerId, updateData),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: CUSTOMER_MESSAGES.NOT_FOUND,
    });
  });

  it("updates a customer profile using its user ID", async () => {
    mocks.findByUserId.mockResolvedValueOnce(customer);
    await customerService.updateByUserId(userId, { companyName: "Movra" });

    expect(mocks.findByUserId).toHaveBeenCalledWith(userId, null);
    expect(mocks.updateById).toHaveBeenCalledWith(customerId, {
      companyName: "Movra",
    });
  });
});

describe("customerService wallet operations", () => {
  it("debits only a positive finite amount and guards against a negative balance", async () => {
    const session = { id: "session-1" };
    await customerService.debitWallet(customerId, 200, session);

    expect(mocks.updateById).toHaveBeenCalledWith(
      customerId,
      { $inc: { walletBalance: -200 } },
      session,
      { walletBalance: { $gte: 200 } },
    );

    for (const amount of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => customerService.debitWallet(customerId, amount)).toThrow(
        expect.objectContaining({
          statusCode: 400,
          message: CUSTOMER_MESSAGES.INVALID_WALLET_DEBIT_AMOUNT,
        }),
      );
    }
  });

  it("adjusts wallet balance and prevents a debit below zero", async () => {
    const session = { id: "session-2" };
    await customerService.adjustWalletBalance(customerId, 300, session);
    expect(mocks.updateById).toHaveBeenCalledWith(
      customerId,
      { $inc: { walletBalance: 300 } },
      session,
      {},
    );

    await customerService.adjustWalletBalance(customerId, -100, session);
    expect(mocks.updateById).toHaveBeenLastCalledWith(
      customerId,
      { $inc: { walletBalance: -100 } },
      session,
      { walletBalance: { $gte: 100 } },
    );

    for (const amount of [0, Number.NaN, Number.NEGATIVE_INFINITY]) {
      expect(() =>
        customerService.adjustWalletBalance(customerId, amount),
      ).toThrow(
        expect.objectContaining({
          statusCode: 400,
          message: CUSTOMER_MESSAGES.INVALID_WALLET_ADJUSTMENT_AMOUNT,
        }),
      );
    }
  });
});

const createSession = () => ({
  startTransaction: vi.fn(),
  commitTransaction: vi.fn().mockResolvedValue(undefined),
  abortTransaction: vi.fn().mockResolvedValue(undefined),
  endSession: vi.fn(),
});

describe("customerService credit audit", () => {
  it("updates non-credit fields without writing an audit log", async () => {
    const updatedCustomer = { ...customer, companyName: "Movra" };
    mocks.updateById.mockResolvedValue(updatedCustomer);

    const result = await customerService.updateByAdmin(
      customerId,
      { companyName: "Movra" },
      "admin-1",
    );

    expect(result).toBe(updatedCustomer);
    expect(mocks.updateById).toHaveBeenCalledWith(customerId, {
      companyName: "Movra",
    });
    expect(mocks.startSession).not.toHaveBeenCalled();
    expect(mocks.createCreditLog).not.toHaveBeenCalled();
  });

  it("writes an audit log when credit terms change", async () => {
    const session = createSession();
    mocks.startSession.mockResolvedValue(session);
    mocks.findById.mockResolvedValue({
      ...customer,
      creditLimit: 0,
      defaultPaymentTerms: "immediate",
      contractDiscountRate: 0,
    });
    mocks.updateById.mockResolvedValue({
      ...customer,
      creditLimit: 50000000,
      defaultPaymentTerms: "net_30",
    });
    mocks.createCreditLog.mockResolvedValue({ _id: "log-1" });

    await customerService.updateByAdmin(
      customerId,
      {
        creditLimit: 50000000,
        defaultPaymentTerms: "net_30",
        contractDiscountRate: 0,
        creditNote: "Approved by CFO",
      },
      "admin-1",
    );

    expect(mocks.updateById).toHaveBeenCalledWith(
      customerId,
      {
        creditLimit: 50000000,
        defaultPaymentTerms: "net_30",
        contractDiscountRate: 0,
      },
      session,
    );
    expect(mocks.createCreditLog).toHaveBeenCalledWith(
      {
        customerId,
        changedBy: "admin-1",
        changes: {
          creditLimit: { from: 0, to: 50000000 },
          defaultPaymentTerms: { from: "immediate", to: "net_30" },
        },
        note: "Approved by CFO",
      },
      session,
    );
    expect(session.commitTransaction).toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalled();
  });

  it("rolls back the update when the audit log cannot be written", async () => {
    const session = createSession();
    mocks.startSession.mockResolvedValue(session);
    mocks.findById.mockResolvedValue({ ...customer, creditLimit: 0 });
    mocks.updateById.mockResolvedValue({ ...customer, creditLimit: 1000 });
    mocks.createCreditLog.mockRejectedValue(new Error("audit failed"));

    await expect(
      customerService.updateByAdmin(
        customerId,
        { creditLimit: 1000 },
        "admin-1",
      ),
    ).rejects.toThrow("audit failed");

    expect(session.abortTransaction).toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalled();
  });

  it("returns paginated credit history for an existing customer", async () => {
    mocks.findById.mockResolvedValue(customer);
    mocks.findCreditLogsByCustomerId.mockResolvedValue([{ _id: "log-1" }]);
    mocks.countCreditLogsByCustomerId.mockResolvedValue(21);

    const result = await customerService.getCreditHistory(customerId, {
      page: 2,
      limit: 10,
    });

    expect(mocks.findCreditLogsByCustomerId).toHaveBeenCalledWith({
      customerId,
      skip: 10,
      limit: 10,
    });
    expect(mocks.countCreditLogsByCustomerId).toHaveBeenCalledWith(customerId);
    expect(result).toEqual({
      data: [{ _id: "log-1" }],
      pagination: { page: 2, limit: 10, total: 21, totalPages: 3 },
    });
  });
});
