import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  startSession: vi.fn(),
  getCustomerById: vi.fn(),
  getCustomerByUserId: vi.fn(),
  debitWallet: vi.fn(),
  updateCustomerById: vi.fn(),
  getGoodsCategoryById: vi.fn(),
  getRouteById: vi.fn(),
  getTripById: vi.fn(),
  getTripIdsByWarehouseId: vi.fn(),
  syncTripTotalOrder: vi.fn(),
  getUserById: vi.fn(),
  calculateFee: vi.fn(),
  createNotification: vi.fn(),
  recordTransaction: vi.fn(),
  getWarehouseById: vi.fn(),
  getNearestWarehouse: vi.fn(),
  findByCode: vi.fn(),
  createOrder: vi.fn(),
  createTrackingLog: vi.fn(),
  findById: vi.fn(),
  findByIds: vi.fn(),
  findAll: vi.fn(),
  countAll: vi.fn(),
  updateById: vi.fn(),
  findPublicTrackingLogsByOrderId: vi.fn(),
  generateCode: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("mongoose", async (importOriginal) => {
  const actual = await importOriginal();

  return {
    ...actual,
    default: { ...actual.default, startSession: mocks.startSession },
  };
});

vi.mock("../../../src/modules/customer/customer.service.js", () => ({
  default: {
    getById: mocks.getCustomerById,
    getByUserId: mocks.getCustomerByUserId,
    debitWallet: mocks.debitWallet,
    updateById: mocks.updateCustomerById,
  },
}));

vi.mock("../../../src/modules/goodsCategory/goodsCategory.service.js", () => ({
  default: { getById: mocks.getGoodsCategoryById },
}));

vi.mock("../../../src/modules/route/route.service.js", () => ({
  default: { getById: mocks.getRouteById },
}));

vi.mock("../../../src/modules/trip/trip.service.js", () => ({
  default: {
    getById: mocks.getTripById,
    getIdsByWarehouseId: mocks.getTripIdsByWarehouseId,
    syncTotalOrder: mocks.syncTripTotalOrder,
  },
}));

vi.mock("../../../src/modules/user/user.service.js", () => ({
  default: { getById: mocks.getUserById },
}));

vi.mock("../../../src/modules/pricing/pricing.service.js", () => ({
  default: { calculateFee: mocks.calculateFee },
}));

vi.mock("../../../src/modules/notification/notification.service.js", () => ({
  default: { create: mocks.createNotification },
}));

vi.mock(
  "../../../src/modules/walletTransaction/walletTransaction.service.js",
  () => ({
    default: { recordTransaction: mocks.recordTransaction },
  }),
);

vi.mock("../../../src/modules/warehouse/warehouse.service.js", () => ({
  default: {
    getById: mocks.getWarehouseById,
    getNearestActiveWarehouse: mocks.getNearestWarehouse,
  },
}));

vi.mock("../../../src/modules/order/order.repository.js", () => ({
  default: {
    findByCode: mocks.findByCode,
    create: mocks.createOrder,
    createTrackingLog: mocks.createTrackingLog,
    findById: mocks.findById,
    findByIds: mocks.findByIds,
    findAll: mocks.findAll,
    countAll: mocks.countAll,
    updateById: mocks.updateById,
    findPublicTrackingLogsByOrderId: mocks.findPublicTrackingLogsByOrderId,
  },
}));

vi.mock("../../../src/utils/generateCode.js", () => ({
  default: mocks.generateCode,
}));

vi.mock("../../../src/configs/logger.js", () => ({
  default: { error: mocks.loggerError },
}));

import {
  ORDER_MESSAGES,
  PAYMENT_MESSAGES,
} from "../../../src/constants/messages.js";
import ROLES from "../../../src/constants/roles.js";
import orderService from "../../../src/modules/order/order.service.js";

const existingOrder = {
  _id: "order-1",
  orderCode: "ORD-0001",
  customerId: "customer-1",
  status: "created",
  deletedAt: null,
  shippingFee: 25000,
  codAmount: 5000,
};

const validCreatePayload = {
  customerId: "customer-1",
  senderName: "Sender",
  senderPhone: "0123456789",
  senderAddress: "Sender address",
  recipientName: "Recipient",
  recipientPhone: "0987654321",
  recipientAddress: "Recipient address",
  goodCategory: "category-1",
  weight: 2,
  volume: 1,
  quantity: 1,
  codAmount: 5000,
  pickupLocation: { latitude: 10.78, longitude: 106.69 },
  routeId: "route-1",
};

const transaction = {
  startTransaction: vi.fn(),
  commitTransaction: vi.fn().mockResolvedValue(undefined),
  abortTransaction: vi.fn().mockResolvedValue(undefined),
  endSession: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.startSession.mockResolvedValue(transaction);
  mocks.getCustomerById.mockResolvedValue({
    walletBalance: 100000,
    userId: { _id: "user-1" },
  });
  mocks.getNearestWarehouse.mockResolvedValue({
    warehouse: { _id: "warehouse-nearest" },
    distanceKm: 3.2,
  });
  mocks.getCustomerByUserId.mockResolvedValue({ _id: "customer-1" });
  mocks.debitWallet.mockResolvedValue({ walletBalance: 75000 });
  mocks.calculateFee.mockResolvedValue({ totalShippingFee: 25000 });
  mocks.findByCode.mockResolvedValue(null);
  mocks.createOrder.mockResolvedValue({
    _id: "order-1",
    orderCode: "ORD-0001",
  });
  mocks.createTrackingLog.mockResolvedValue({ _id: "tracking-1" });
  mocks.createNotification.mockResolvedValue(undefined);
  mocks.generateCode.mockReturnValue("ORD-0001");
});

describe("orderService.create", () => {
  it("requires a goods category", async () => {
    await expect(
      orderService.create({ ...validCreatePayload, goodCategory: null }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: ORDER_MESSAGES.CATEGORY_REQUIRED,
    });

    expect(mocks.getGoodsCategoryById).not.toHaveBeenCalled();
  });

  it("requires a customer", async () => {
    await expect(
      orderService.create({ ...validCreatePayload, customerId: null }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: ORDER_MESSAGES.CUSTOMER_REQUIRED,
    });
  });

  it("requires pickup coordinates for customer orders", async () => {
    await expect(
      orderService.create(
        {
          ...validCreatePayload,
          routeId: undefined,
          pickupLocation: undefined,
        },
        transaction,
        { role: ROLES.CUSTOMER },
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: ORDER_MESSAGES.PICKUP_LOCATION_REQUIRED,
    });
  });

  it("does not allow customers to assign an order to a trip", async () => {
    await expect(
      orderService.create({ ...validCreatePayload, tripId: "trip-1" }, null, {
        role: ROLES.CUSTOMER,
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: ORDER_MESSAGES.ACCESS_DENIED,
    });

    expect(mocks.startSession).not.toHaveBeenCalled();
  });

  it("assigns customer orders to the nearest active warehouse without a route", async () => {
    const payload = { ...validCreatePayload, routeId: undefined };
    const result = await orderService.create(payload, transaction, {
      role: ROLES.CUSTOMER,
    });

    expect(mocks.getNearestWarehouse).toHaveBeenCalledWith(10.78, 106.69);
    expect(mocks.calculateFee).toHaveBeenCalledWith(
      expect.objectContaining({ routeId: undefined }),
    );
    expect(mocks.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        warehouseId: "warehouse-nearest",
        pickupLocation: { latitude: 10.78, longitude: 106.69 },
        pickupDistanceKm: 3.2,
        routeId: undefined,
        status: "created",
      }),
      transaction,
    );
    expect(result).toEqual({ _id: "order-1", orderCode: "ORD-0001" });
  });

  it("creates the order and charges the wallet in the provided transaction", async () => {
    const result = await orderService.create(validCreatePayload, transaction);

    expect(result).toEqual({ _id: "order-1", orderCode: "ORD-0001" });
    expect(mocks.calculateFee).toHaveBeenCalledWith({
      weight: 2,
      volume: 1,
      routeId: "route-1",
      goodsCategoryId: "category-1",
    });
    expect(mocks.debitWallet).toHaveBeenCalledWith(
      "customer-1",
      25000,
      transaction,
    );
    expect(mocks.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        orderCode: "ORD-0001",
        customerId: "customer-1",
        shippingFee: 25000,
        shippingFeePaid: true,
        totalAmount: 30000,
        status: "created",
        paymentMethod: "wallet_balance",
        paymentStatus: "success",
      }),
      transaction,
    );
    expect(mocks.recordTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: "customer-1",
        amount: 25000,
        balanceBefore: 100000,
        balanceAfter: 75000,
        orderId: "order-1",
      }),
      transaction,
    );
    expect(mocks.createTrackingLog).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "order-1",
        status: "created",
      }),
      transaction,
    );
    expect(transaction.commitTransaction).not.toHaveBeenCalled();
    expect(transaction.endSession).not.toHaveBeenCalled();
  });

  it("rejects when the customer wallet cannot cover the fee", async () => {
    mocks.debitWallet.mockResolvedValue(null);

    await expect(
      orderService.create(validCreatePayload, transaction),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: PAYMENT_MESSAGES.INSUFFICIENT_WALLET_BALANCE,
    });

    expect(transaction.abortTransaction).not.toHaveBeenCalled();
    expect(transaction.commitTransaction).not.toHaveBeenCalled();
    expect(mocks.createOrder).not.toHaveBeenCalled();
  });

  it("rejects an invalid shipping fee before opening a transaction", async () => {
    mocks.calculateFee.mockResolvedValue({ totalShippingFee: -1 });

    await expect(orderService.create(validCreatePayload)).rejects.toMatchObject(
      {
        statusCode: 500,
        message: ORDER_MESSAGES.INVALID_SHIPPING_FEE,
      },
    );

    expect(mocks.startSession).not.toHaveBeenCalled();
  });
});

describe("orderService.confirmPickup", () => {
  const pickupOrder = {
    _id: "order-1",
    status: "driver_assigned",
    deletedAt: null,
    tripId: {
      _id: "trip-1",
      type: "pickup",
      status: "in_progress",
    },
  };

  beforeEach(() => {
    mocks.findById.mockResolvedValue(pickupOrder);
    mocks.getTripById.mockResolvedValue(pickupOrder.tripId);
    mocks.updateById.mockResolvedValue(pickupOrder);
  });

  it("records successful collection and moves the order to picked_up", async () => {
    await orderService.confirmPickup({
      orderId: pickupOrder._id,
      outcome: "picked_up",
      session: transaction,
    });

    expect(mocks.createTrackingLog).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: pickupOrder._id,
        tripId: "trip-1",
        status: "picked_up",
      }),
      transaction,
    );
    expect(mocks.updateById).toHaveBeenCalledWith(
      pickupOrder._id,
      { status: "picked_up" },
      transaction,
      expect.objectContaining({ status: "driver_assigned" }),
    );
  });

  it("records a failed collection without advancing the order status", async () => {
    await orderService.confirmPickup({
      orderId: pickupOrder._id,
      outcome: "failed",
      notes: "No one at the pickup address",
      session: transaction,
    });

    expect(mocks.createTrackingLog).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "driver_assigned",
        notes: "Lấy hàng thất bại: No one at the pickup address",
      }),
      transaction,
    );
    expect(mocks.updateById).toHaveBeenCalledWith(
      pickupOrder._id,
      { status: "driver_assigned" },
      transaction,
      expect.objectContaining({ status: "driver_assigned" }),
    );
  });

  it("rejects orders outside an active pickup trip", async () => {
    mocks.findById.mockResolvedValueOnce({
      ...pickupOrder,
      tripId: { ...pickupOrder.tripId, type: "delivery" },
    });

    await expect(
      orderService.confirmPickup({
        orderId: pickupOrder._id,
        outcome: "picked_up",
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: ORDER_MESSAGES.PICKUP_TRIP_REQUIRED,
    });
    expect(mocks.createTrackingLog).not.toHaveBeenCalled();
  });

  it("removes orders from the pickup trip when the warehouse stores them", async () => {
    await orderService.addTrackingLog({
      orderId: pickupOrder._id,
      tripId: "trip-1",
      status: "stored",
      clearTrip: true,
      session: transaction,
    });

    expect(mocks.updateById).toHaveBeenCalledWith(
      pickupOrder._id,
      { status: "stored", tripId: null },
      transaction,
      expect.objectContaining({ tripId: "trip-1" }),
    );
  });

  it("does not allow generic tracking logs to confirm pickup or warehouse storage", async () => {
    mocks.findById.mockResolvedValue(pickupOrder);

    await expect(
      orderService.addTrackingLog({
        orderId: pickupOrder._id,
        status: "picked_up",
        user: { role: ROLES.ADMIN },
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: ORDER_MESSAGES.PICKUP_CONFIRMATION_REQUIRED,
    });

    await expect(
      orderService.addTrackingLog({
        orderId: pickupOrder._id,
        status: "stored",
        user: { role: ROLES.ADMIN },
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: ORDER_MESSAGES.STORAGE_REQUIRES_RECEIPT,
    });
  });
});

describe("orderService.assignOrdersToTrip", () => {
  it("requires unreceived orders to be assigned to pickup trips", async () => {
    mocks.getTripById.mockResolvedValue({
      _id: "trip-1",
      type: "delivery",
      status: "planned",
      routeId: "route-1",
      warehouseId: "warehouse-1",
    });
    mocks.findByIds.mockResolvedValue([
      {
        _id: "order-1",
        orderCode: "ORD-0001",
        status: "created",
        routeId: "route-1",
        warehouseId: "warehouse-1",
      },
    ]);

    await expect(
      orderService.assignOrdersToTrip({
        tripId: "trip-1",
        orderIds: ["order-1"],
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: ORDER_MESSAGES.ORDER_TRIP_TYPE_MISMATCH,
    });
    expect(mocks.startSession).not.toHaveBeenCalled();
  });

  it("requires stored orders to be assigned to delivery or transfer trips", async () => {
    mocks.getTripById.mockResolvedValue({
      _id: "trip-1",
      type: "pickup",
      status: "planned",
      routeId: "route-1",
      warehouseId: "warehouse-1",
    });
    mocks.findByIds.mockResolvedValue([
      {
        _id: "order-1",
        orderCode: "ORD-0001",
        status: "stored",
        routeId: "route-1",
        warehouseId: "warehouse-1",
      },
    ]);

    await expect(
      orderService.assignOrdersToTrip({
        tripId: "trip-1",
        orderIds: ["order-1"],
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: ORDER_MESSAGES.ORDER_TRIP_TYPE_MISMATCH,
    });
    expect(mocks.startSession).not.toHaveBeenCalled();
  });
});

describe("orderService.getById", () => {
  it("returns an existing order", async () => {
    mocks.findById.mockResolvedValue(existingOrder);

    await expect(orderService.getById("order-1")).resolves.toBe(existingOrder);
  });

  it("rejects when the order does not exist", async () => {
    mocks.findById.mockResolvedValue(null);

    await expect(orderService.getById("missing")).rejects.toMatchObject({
      statusCode: 404,
      message: ORDER_MESSAGES.NOT_FOUND,
    });
  });

  it("rejects deleted orders by default", async () => {
    mocks.findById.mockResolvedValue({
      ...existingOrder,
      deletedAt: new Date(),
    });

    await expect(orderService.getById("order-1")).rejects.toMatchObject({
      statusCode: 400,
      message: ORDER_MESSAGES.ALREADY_DELETED,
    });
  });

  it("only allows a customer to read their own order", async () => {
    mocks.findById.mockResolvedValue(existingOrder);

    await expect(
      orderService.getById("order-1", true, {
        role: ROLES.CUSTOMER,
        customerId: "customer-2",
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: ORDER_MESSAGES.ACCESS_DENIED,
    });
  });
});

describe("orderService.getAll and getMyOrders", () => {
  it("applies pagination and excludes deleted orders", async () => {
    mocks.findAll.mockResolvedValue([existingOrder]);
    mocks.countAll.mockResolvedValue(21);

    await expect(
      orderService.getAll({
        filter: { status: "created" },
        page: 2,
        limit: 10,
      }),
    ).resolves.toEqual({
      data: [existingOrder],
      pagination: { page: 2, limit: 10, total: 21, totalPages: 3 },
    });
    expect(mocks.findAll).toHaveBeenCalledWith({
      filter: { deletedAt: null, status: "created" },
      skip: 10,
      limit: 10,
      sort: { createdAt: -1 },
    });
  });

  it("scopes a customer's order list to their customer profile", async () => {
    mocks.findAll.mockResolvedValue([]);
    mocks.countAll.mockResolvedValue(0);

    await orderService.getMyOrders({
      userId: "user-1",
      filter: { status: "created" },
    });

    expect(mocks.getCustomerByUserId).toHaveBeenCalledWith("user-1");
    expect(mocks.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: {
          deletedAt: null,
          status: "created",
          customerId: "customer-1",
        },
      }),
    );
  });

  it("requires dispatchers to have an assigned warehouse", async () => {
    await expect(
      orderService.getAll({ user: { role: ROLES.DISPATCHER } }),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(mocks.findAll).not.toHaveBeenCalled();
  });
});

describe("orderService.getPublicTrackingByCode", () => {
  it("returns public order tracking fields and chronological tracking logs", async () => {
    const deliveredAt = new Date("2026-01-01T00:00:00.000Z");
    const createdAt = new Date("2025-12-31T00:00:00.000Z");
    const logs = [{ status: "created" }];
    mocks.findByCode.mockResolvedValue({
      ...existingOrder,
      status: "delivered",
      weight: 2,
      volume: 1,
      type: "normal",
      deliveredAt,
      createdAt,
    });
    mocks.findPublicTrackingLogsByOrderId.mockResolvedValue(logs);

    await expect(
      orderService.getPublicTrackingByCode("ORD-0001"),
    ).resolves.toEqual({
      orderCode: "ORD-0001",
      status: "delivered",
      weight: 2,
      volume: 1,
      type: "normal",
      deliveredAt,
      createdAt,
      trackingLogs: logs,
    });
    expect(mocks.findPublicTrackingLogsByOrderId).toHaveBeenCalledWith(
      "order-1",
      { skip: 0, limit: 100, sort: { createdAt: 1 } },
    );
  });
});

describe("orderService.updateById", () => {
  it("recalculates total amount when updating COD", async () => {
    mocks.findById.mockResolvedValue(existingOrder);
    mocks.updateById.mockResolvedValue({ ...existingOrder, codAmount: 7000 });

    await orderService.updateById({
      orderId: "order-1",
      updateData: { codAmount: 7000 },
    });

    expect(mocks.updateById).toHaveBeenCalledWith(
      "order-1",
      { codAmount: 7000, totalAmount: 32000 },
      null,
      {
        codCollectedAmount: { $in: [null, 0] },
        codRemittedAmount: { $in: [null, 0] },
        codSettled: { $ne: true },
      },
    );
  });

  it("does not allow changing a trip through a regular update", async () => {
    mocks.findById.mockResolvedValue(existingOrder);

    await expect(
      orderService.updateById({
        orderId: "order-1",
        updateData: { tripId: "trip-2" },
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: ORDER_MESSAGES.ORDER_TRIP_CHANGE_REQUIRES_ASSIGNMENT,
    });
    expect(mocks.updateById).not.toHaveBeenCalled();
  });

  it("does not allow changing core delivery details after delivery", async () => {
    mocks.findById.mockResolvedValue({ ...existingOrder, status: "delivered" });

    await expect(
      orderService.updateById({
        orderId: "order-1",
        updateData: { recipientAddress: "New address" },
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: ORDER_MESSAGES.CANNOT_MODIFY_CORE("delivered"),
    });
    expect(mocks.updateById).not.toHaveBeenCalled();
  });

  it("rejects financial changes to a settled order", async () => {
    mocks.findById.mockResolvedValue({
      ...existingOrder,
      codSettled: true,
    });

    await expect(
      orderService.updateById({
        orderId: "order-1",
        updateData: { codAmount: 7000 },
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: ORDER_MESSAGES.CANNOT_MODIFY_SETTLED_FINANCIALS,
    });
  });
});
