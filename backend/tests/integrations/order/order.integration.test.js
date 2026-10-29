import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import ApiError from "../../../src/utils/ApiError.js";

const orderServiceMock = vi.hoisted(() => ({
  create: vi.fn(),
  getAll: vi.fn(),
  getMyOrders: vi.fn(),
  getById: vi.fn(),
}));

const authState = vi.hoisted(() => ({
  user: {
    userId: "user-1",
    role: "customer",
    customerId: "507f1f77bcf86cd799439011",
  },
}));

vi.mock("../../../src/modules/order/order.service.js", () => ({
  default: orderServiceMock,
}));

vi.mock("../../../src/middlewares/auth.middleware.js", () => ({
  default: (req, res, next) => {
    req.user = authState.user;
    next();
  },
}));

vi.mock("../../../src/middlewares/authorize.middleware.js", () => ({
  default:
    (...allowedRoles) =>
    (req, res, next) => {
      if (!req.user || !allowedRoles.includes(req.user.role)) {
        return next(new ApiError(403, "Forbidden"));
      }
      next();
    },
}));

import app from "../../../src/app.js";

describe("Order API integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = {
      userId: "user-1",
      role: "customer",
      customerId: "507f1f77bcf86cd799439011",
    };
  });

  it("creates an order for an authenticated customer", async () => {
    orderServiceMock.create.mockResolvedValue({
      _id: "order-1",
      orderCode: "ORD-0001",
      status: "created",
    });

    const payload = {
      senderName: "Nguyen Van A",
      senderPhone: "0123456789",
      senderAddress: "123 A Street",
      pickupLocation: { latitude: 10.78, longitude: 106.69 },
      recipientName: "Tran Thi B",
      recipientPhone: "0987654321",
      recipientAddress: "456 B Street",
      goodCategory: "507f1f77bcf86cd799439012",
      weight: 2,
      volume: 1,
      quantity: 1,
      codAmount: 500000,
      type: "normal",
    };

    const response = await request(app)
      .post("/api/v1/orders")
      .set("Origin", "http://localhost:5173")
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual({
      _id: "order-1",
      orderCode: "ORD-0001",
      status: "created",
    });
    expect(orderServiceMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        senderName: "Nguyen Van A",
        customerId: "507f1f77bcf86cd799439011",
        createdBy: "user-1",
      }),
      null,
      expect.objectContaining({
        userId: "user-1",
        role: "customer",
      }),
    );
  });

  it("rejects invalid order payload before calling the service", async () => {
    const response = await request(app)
      .post("/api/v1/orders")
      .set("Origin", "http://localhost:5173")
      .send({
        senderName: "Nguyen Van A",
        senderPhone: "123",
        senderAddress: "123 A Street",
        recipientName: "Tran Thi B",
        recipientPhone: "0987654321",
        recipientAddress: "456 B Street",
        goodCategory: "507f1f77bcf86cd799439012",
        weight: 2,
        volume: 1,
        quantity: 1,
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(orderServiceMock.create).not.toHaveBeenCalled();
  });

  it("blocks requests when the user role is not allowed", async () => {
    authState.user = {
      userId: "driver-1",
      role: "driver",
      customerId: "507f1f77bcf86cd799439011",
    };

    const payload = {
      senderName: "Nguyen Van A",
      senderPhone: "0123456789",
      senderAddress: "123 A Street",
      recipientName: "Tran Thi B",
      recipientPhone: "0987654321",
      recipientAddress: "456 B Street",
      goodCategory: "507f1f77bcf86cd799439012",
      weight: 2,
      volume: 1,
      quantity: 1,
    };

    const response = await request(app)
      .post("/api/v1/orders")
      .set("Origin", "http://localhost:5173")
      .send(payload);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(orderServiceMock.create).not.toHaveBeenCalled();
  });

  it("lists the authenticated customer's orders", async () => {
    orderServiceMock.getMyOrders.mockResolvedValue({
      orders: [{ _id: "order-1", orderCode: "ORD-0001" }],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });

    const response = await request(app)
      .get("/api/v1/orders/my-orders")
      .set("Origin", "http://localhost:5173")
      .query({ page: 1, limit: 10 });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual({
      orders: [{ _id: "order-1", orderCode: "ORD-0001" }],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
    expect(orderServiceMock.getMyOrders).toHaveBeenCalledWith({
      userId: "user-1",
      customerId: "507f1f77bcf86cd799439011",
      filter: {},
      page: 1,
      limit: 10,
    });
  });

  it("returns an order by id for an allowed customer", async () => {
    orderServiceMock.getById.mockResolvedValue({
      _id: "507f1f77bcf86cd799439014",
      orderCode: "ORD-0002",
      status: "created",
    });

    const response = await request(app)
      .get("/api/v1/orders/507f1f77bcf86cd799439014")
      .set("Origin", "http://localhost:5173");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual({
      _id: "507f1f77bcf86cd799439014",
      orderCode: "ORD-0002",
      status: "created",
    });
    expect(orderServiceMock.getById).toHaveBeenCalledWith(
      "507f1f77bcf86cd799439014",
      true,
      expect.objectContaining({ userId: "user-1", role: "customer" }),
    );
  });

  it("lists orders for admins with a status filter", async () => {
    orderServiceMock.getAll.mockResolvedValue({
      orders: [{ _id: "order-3", orderCode: "ORD-0003" }],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });

    authState.user = {
      userId: "admin-1",
      role: "admin",
      customerId: null,
    };

    const response = await request(app)
      .get("/api/v1/orders")
      .query({ page: 1, limit: 10, status: "created" })
      .set("Origin", "http://localhost:5173");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(orderServiceMock.getAll).toHaveBeenCalledWith({
      filter: { status: "created" },
      page: 1,
      limit: 10,
      user: expect.objectContaining({ userId: "admin-1", role: "admin" }),
    });
  });

  it("rejects invalid order ids before calling the service", async () => {
    const response = await request(app)
      .get("/api/v1/orders/not-a-valid-id")
      .set("Origin", "http://localhost:5173");

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(orderServiceMock.getById).not.toHaveBeenCalled();
  });
});
