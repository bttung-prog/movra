import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import ApiError from "../../../src/utils/ApiError.js";

const paymentServiceMock = vi.hoisted(() => ({
  create: vi.fn(),
  getAll: vi.fn(),
  getById: vi.fn(),
}));

const authState = vi.hoisted(() => ({
  user: {
    userId: "user-1",
    role: "customer",
    customerId: "507f1f77bcf86cd799439011",
  },
}));

vi.mock("../../../src/modules/payment/payment.service.js", () => ({
  default: paymentServiceMock,
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

describe("Payment API integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = {
      userId: "user-1",
      role: "customer",
      customerId: "507f1f77bcf86cd799439011",
    };
  });

  it("creates a payment for an authenticated customer", async () => {
    paymentServiceMock.create.mockResolvedValue({
      _id: "payment-1",
      paymentCode: "PAY-0001",
      paymentStatus: "pending",
    });

    const response = await request(app)
      .post("/api/v1/payments")
      .set("Origin", "http://localhost:5173")
      .send({
        orderId: "507f1f77bcf86cd799439013",
        payerType: "customer",
        paymentAmount: 250000,
        paymentMethod: "bank",
        transactionReference: "REF-001",
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual({
      _id: "payment-1",
      paymentCode: "PAY-0001",
      paymentStatus: "pending",
    });
    expect(paymentServiceMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "507f1f77bcf86cd799439013",
        paymentAmount: 250000,
        paymentMethod: "bank",
      }),
      expect.objectContaining({
        userId: "user-1",
        role: "customer",
        customerId: "507f1f77bcf86cd799439011",
      }),
    );
  });

  it("rejects invalid payment payload before calling the service", async () => {
    const response = await request(app)
      .post("/api/v1/payments")
      .set("Origin", "http://localhost:5173")
      .send({
        paymentAmount: 0,
        paymentMethod: "bank",
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(paymentServiceMock.create).not.toHaveBeenCalled();
  });

  it("lists the authenticated customer payments", async () => {
    paymentServiceMock.getAll.mockResolvedValue({
      payments: [{ _id: "payment-1", paymentCode: "PAY-0001" }],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });

    const response = await request(app)
      .get("/api/v1/payments/my-payments")
      .set("Origin", "http://localhost:5173")
      .query({ page: 1, limit: 10, paymentStatus: "pending" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual({
      payments: [{ _id: "payment-1", paymentCode: "PAY-0001" }],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
    expect(paymentServiceMock.getAll).toHaveBeenCalledWith({
      filter: {
        paymentStatus: "pending",
        customerId: "507f1f77bcf86cd799439011",
      },
      page: 1,
      limit: 10,
    });
  });

  it("returns a payment by id for an allowed user", async () => {
    paymentServiceMock.getById.mockResolvedValue({
      _id: "payment-2",
      paymentCode: "PAY-0002",
      paymentStatus: "completed",
    });

    const response = await request(app)
      .get("/api/v1/payments/507f1f77bcf86cd799439014")
      .set("Origin", "http://localhost:5173");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual({
      _id: "payment-2",
      paymentCode: "PAY-0002",
      paymentStatus: "completed",
    });
    expect(paymentServiceMock.getById).toHaveBeenCalledWith(
      "507f1f77bcf86cd799439014",
      expect.objectContaining({ userId: "user-1", role: "customer" }),
    );
  });

  it("rejects invalid payment ids before calling the service", async () => {
    const response = await request(app)
      .get("/api/v1/payments/not-a-valid-id")
      .set("Origin", "http://localhost:5173");

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(paymentServiceMock.getById).not.toHaveBeenCalled();
  });

  it("blocks requests when the user role is not allowed", async () => {
    authState.user = {
      userId: "driver-1",
      role: "driver",
      customerId: "507f1f77bcf86cd799439011",
    };

    const response = await request(app)
      .get("/api/v1/payments")
      .set("Origin", "http://localhost:5173")
      .query({ page: 1, limit: 10 });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(paymentServiceMock.getAll).not.toHaveBeenCalled();
  });
});
