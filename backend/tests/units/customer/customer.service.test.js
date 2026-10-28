import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findAll: vi.fn(),
  countAll: vi.fn(),
  findById: vi.fn(),
  findByUserId: vi.fn(),
  updateById: vi.fn(),
  getUserById: vi.fn(),
  searchPaginated: vi.fn(),
}));

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

vi.mock("../../../src/modules/user/user.service.js", () => ({
  default: {
    getById: mocks.getUserById,
    searchPaginated: mocks.searchPaginated,
  },
}));

import { CUSTOMER_MESSAGES } from "../../../src/constants/messages.js";
import ROLES from "../../../src/constants/roles.js";
import customerService from "../../../src/modules/customer/customer.service.js";

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
      filter: { gender: "female" },
      page: 2,
      limit: 10,
    });

    expect(mocks.findAll).toHaveBeenCalledWith({
      filter: { gender: "female" },
      skip: 10,
      limit: 10,
    });
    expect(mocks.countAll).toHaveBeenCalledWith({ gender: "female" });
    expect(result).toEqual({
      data: [customer],
      pagination: {
        page: 2,
        limit: 10,
        totalCustomers: 21,
        totalPages: 3,
      },
    });
    expect(mocks.searchPaginated).not.toHaveBeenCalled();
  });

  it("searches users first and restores their result order in customer data", async () => {
    const firstUser = { _id: "user-2" };
    const secondUser = { _id: "user-3" };
    const firstCustomer = { _id: "customer-2", userId: "user-2" };
    const secondCustomer = { _id: "customer-3", userId: "user-3" };
    mocks.searchPaginated.mockResolvedValue({
      data: [firstUser, secondUser],
      pagination: { totalUsers: 12, totalPages: 2 },
    });
    mocks.findAll.mockResolvedValue([secondCustomer, firstCustomer]);

    const result = await customerService.getAll({
      filter: { gender: "male" },
      page: 2,
      limit: 5,
      search: "  Linh ",
    });

    expect(mocks.searchPaginated).toHaveBeenCalledWith("Linh", {
      page: 2,
      limit: 5,
      filter: { role: ROLES.CUSTOMER },
    });
    expect(mocks.findAll).toHaveBeenCalledWith({
      filter: {
        gender: "male",
        userId: { $in: ["user-2", "user-3"] },
      },
      skip: 0,
      limit: 2,
    });
    expect(result).toEqual({
      data: [firstCustomer, secondCustomer],
      pagination: {
        page: 2,
        limit: 5,
        totalCustomers: 12,
        totalPages: 2,
      },
    });
    expect(mocks.countAll).not.toHaveBeenCalled();
  });

  it("does not query customers when a user search has no matches", async () => {
    mocks.searchPaginated.mockResolvedValue({
      data: [],
      pagination: { totalUsers: 0, totalPages: 0 },
    });

    const result = await customerService.getAll({ search: "missing" });

    expect(result.data).toEqual([]);
    expect(mocks.findAll).not.toHaveBeenCalled();
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
    await customerService.updateByUserId(userId, { gender: "female" });

    expect(mocks.findByUserId).toHaveBeenCalledWith(userId, null);
    expect(mocks.updateById).toHaveBeenCalledWith(customerId, {
      gender: "female",
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
