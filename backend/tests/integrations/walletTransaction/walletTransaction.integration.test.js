import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import ApiError from "../../../src/utils/ApiError.js";

const walletTransactionServiceMock = vi.hoisted(() => ({
  topUp: vi.fn(),
  adjustWallet: vi.fn(),
  getAll: vi.fn(),
  getById: vi.fn(),
  getByCode: vi.fn(),
}));

const authState = vi.hoisted(() => ({
  user: {
    userId: "user-1",
    role: "customer",
    customerId: "507f1f77bcf86cd799439011",
  },
}));

vi.mock("../../../src/modules/walletTransaction/walletTransaction.service.js", () => ({
  default: walletTransactionServiceMock,
}));

vi.mock("../../../src/middlewares/auth.middleware.js", () => ({
  default: (req, res, next) => {
    req.user = authState.user;
    next();
  },
}));

vi.mock("../../../src/middlewares/authorize.middleware.js", () => ({
  default: (...allowedRoles) => (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(new ApiError(403, "Forbidden"));
    }
    next();
  },
}));

import app from "../../../src/app.js";

describe("Wallet transaction API integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = {
      userId: "user-1",
      role: "customer",
      customerId: "507f1f77bcf86cd799439011",
    };
  });

  it("creates a wallet top-up for an authenticated customer", async () => {
    walletTransactionServiceMock.topUp.mockResolvedValue({
      _id: "txn-1",
      transactionCode: "WTRX-0001",
      amount: 500000,
      status: "pending",
    });

    const response = await request(app)
      .post("/api/v1/wallet-transactions/top-up")
      .set("Origin", "http://localhost:5173")
      .send({
        amount: 500000,
        paymentMethod: "bank",
        transactionReference: "REF-123",
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual({
      _id: "txn-1",
      transactionCode: "WTRX-0001",
      amount: 500000,
      status: "pending",
    });
    expect(walletTransactionServiceMock.topUp).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 500000,
        paymentMethod: "bank",
        transactionReference: "REF-123",
      }),
      expect.objectContaining({
        userId: "user-1",
        role: "customer",
        customerId: "507f1f77bcf86cd799439011",
      }),
    );
  });

  it("rejects invalid top-up payload before calling the service", async () => {
    const response = await request(app)
      .post("/api/v1/wallet-transactions/top-up")
      .set("Origin", "http://localhost:5173")
      .send({
        amount: 0,
        paymentMethod: "bank",
        transactionReference: "REF-123",
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(walletTransactionServiceMock.topUp).not.toHaveBeenCalled();
  });

  it("lists the authenticated customer's wallet transactions", async () => {
    walletTransactionServiceMock.getAll.mockResolvedValue({
      transactions: [{ _id: "txn-1", transactionCode: "WTRX-0001" }],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });

    const response = await request(app)
      .get("/api/v1/wallet-transactions/my-transactions")
      .set("Origin", "http://localhost:5173")
      .query({ page: 1, limit: 10, status: "success" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual({
      transactions: [{ _id: "txn-1", transactionCode: "WTRX-0001" }],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
    expect(walletTransactionServiceMock.getAll).toHaveBeenCalledWith({
      filter: {
        customerId: "507f1f77bcf86cd799439011",
        status: "success",
      },
      page: 1,
      limit: 10,
    });
  });

  it("returns a wallet transaction by id for an allowed customer", async () => {
    walletTransactionServiceMock.getById.mockResolvedValue({
      _id: "507f1f77bcf86cd799439014",
      transactionCode: "WTRX-0002",
      status: "completed",
    });

    const response = await request(app)
      .get("/api/v1/wallet-transactions/507f1f77bcf86cd799439014")
      .set("Origin", "http://localhost:5173");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual({
      _id: "507f1f77bcf86cd799439014",
      transactionCode: "WTRX-0002",
      status: "completed",
    });
    expect(walletTransactionServiceMock.getById).toHaveBeenCalledWith(
      "507f1f77bcf86cd799439014",
      expect.objectContaining({ userId: "user-1", role: "customer" }),
    );
  });

  it("rejects invalid wallet transaction ids before calling the service", async () => {
    const response = await request(app)
      .get("/api/v1/wallet-transactions/not-a-valid-id")
      .set("Origin", "http://localhost:5173");

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(walletTransactionServiceMock.getById).not.toHaveBeenCalled();
  });

  it("blocks requests when the user role is not allowed", async () => {
    authState.user = {
      userId: "admin-1",
      role: "admin",
      customerId: "507f1f77bcf86cd799439011",
    };

    const response = await request(app)
      .get("/api/v1/wallet-transactions/my-transactions")
      .set("Origin", "http://localhost:5173")
      .query({ page: 1, limit: 10 });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(walletTransactionServiceMock.getAll).not.toHaveBeenCalled();
  });
});
