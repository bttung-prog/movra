import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  startSession: vi.fn(),
  getCustomerById: vi.fn(),
  getCustomerByUserId: vi.fn(),
  assertCreditAvailable: vi.fn(),
  debitWallet: vi.fn(),
  updateCustomerById: vi.fn(),
  getGoodsCategoryById: vi.fn(),
  getRouteById: vi.fn(),
  getActiveRouteByWarehousePair: vi.fn(),
  getTripById: vi.fn(),
  getTripIdsByWarehouseId: vi.fn(),
  syncTripTotalOrder: vi.fn(),
  getUserById: vi.fn(),
  calculateFee: vi.fn(),
  createNotification: vi.fn(),
  createManyNotifications: vi.fn(),
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
  updateMany: vi.fn(),
  bulkWrite: vi.fn(),
  findLoadsByTripId: vi.fn(),
  findTrackingLogsByOrderId: vi.fn(),
  findPublicTrackingLogsByOrderId: vi.fn(),
  countTrackingLogsByOrderId: vi.fn(),
  getLatestTrackingLogByOrderId: vi.fn(),
  findRawByFilter: vi.fn(),
  findBillableByCustomer: vi.fn(),
  countUnfinishedOrdersByTrip: vi.fn(),
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

vi.mock("../../../src/modules/customer/customerCredit.service.js", () => ({
  default: {
    assertCreditAvailable: mocks.assertCreditAvailable,
  },
}));

vi.mock("../../../src/modules/goodsCategory/goodsCategory.service.js", () => ({
  default: { getById: mocks.getGoodsCategoryById },
}));

vi.mock("../../../src/modules/route/route.service.js", () => ({
  default: {
    getById: mocks.getRouteById,
    getActiveByWarehousePair: mocks.getActiveRouteByWarehousePair,
  },
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
  default: {
    create: mocks.createNotification,
    createMany: mocks.createManyNotifications,
  },
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
    findById: mocks.findById,
    findByIds: mocks.findByIds,
    findAll: mocks.findAll,
    countAll: mocks.countAll,
    updateById: mocks.updateById,
    updateMany: mocks.updateMany,
    bulkWrite: mocks.bulkWrite,
    findLoadsByTripId: mocks.findLoadsByTripId,
    findRawByFilter: mocks.findRawByFilter,
    findBillableByCustomer: mocks.findBillableByCustomer,
    countUnfinishedOrdersByTrip: mocks.countUnfinishedOrdersByTrip,
  },
}));

vi.mock("../../../src/modules/order/orderTrackingLog.repository.js", () => ({
  default: {
    create: mocks.createTrackingLog,
    findByOrderId: mocks.findTrackingLogsByOrderId,
    findPublicByOrderId: mocks.findPublicTrackingLogsByOrderId,
    countByOrderId: mocks.countTrackingLogsByOrderId,
    getLatestByOrderId: mocks.getLatestTrackingLogByOrderId,
  },
}));

vi.mock("../../../src/utils/generateCode.js", () => ({
  generateCode: mocks.generateCode,
}));

vi.mock("../../../src/configs/logger.js", () => ({
  default: { error: mocks.loggerError },
}));

import {
  CUSTOMER_MESSAGES,
  ORDER_MESSAGES,
  WAREHOUSE_MESSAGES,
} from "../../../src/constants/messages.js";
import { ROLES } from "../../../src/constants/roles.js";
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
  length: 100,
  width: 100,
  height: 100,
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
    _id: "customer-1",
    walletBalance: 100000,
    creditLimit: 0,
    defaultPaymentTerms: "immediate",
    contractDiscountRate: 0,
    userId: { _id: "user-1" },
  });
  mocks.assertCreditAvailable.mockResolvedValue(null);
  mocks.getNearestWarehouse.mockResolvedValue({
    warehouse: { _id: "warehouse-nearest" },
    distanceKm: 3.2,
  });
  mocks.getCustomerByUserId.mockResolvedValue({ _id: "customer-1" });
  mocks.calculateFee.mockResolvedValue({ totalShippingFee: 25000 });
  mocks.findByCode.mockResolvedValue(null);
  mocks.createOrder.mockResolvedValue({
    _id: "order-1",
    orderCode: "ORD-0001",
  });
  mocks.createTrackingLog.mockResolvedValue({ _id: "tracking-1" });
  mocks.createNotification.mockResolvedValue(undefined);
  mocks.createManyNotifications.mockResolvedValue(undefined);
  mocks.generateCode.mockReturnValue("ORD-0001");
  mocks.findLoadsByTripId.mockResolvedValue([]);
  mocks.updateMany.mockResolvedValue({ modifiedCount: 1 });
  mocks.bulkWrite.mockImplementation(async (operations = []) => ({
    matchedCount: operations.length,
    modifiedCount: operations.length,
  }));
  mocks.findRawByFilter.mockResolvedValue([]);
  mocks.countUnfinishedOrdersByTrip.mockResolvedValue(0);
});

describe("orderService.create", () => {
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

  it("requires delivery coordinates for customer orders", async () => {
    await expect(
      orderService.create(
        {
          ...validCreatePayload,
          routeId: undefined,
          deliveryLocation: undefined,
        },
        transaction,
        { role: ROLES.CUSTOMER },
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: ORDER_MESSAGES.DELIVERY_LOCATION_REQUIRED,
    });
  });

  it("assigns intra-zone customer orders to Kho A without a route (d1 + d3)", async () => {
    mocks.getNearestWarehouse
      .mockResolvedValueOnce({
        warehouse: { _id: "warehouse-nearest" },
        distanceKm: 3.2,
      })
      .mockResolvedValueOnce({
        warehouse: { _id: "warehouse-nearest" },
        distanceKm: 4.8,
      });

    const payload = {
      ...validCreatePayload,
      routeId: undefined,
      deliveryLocation: { latitude: 10.8, longitude: 106.72 },
    };
    const result = await orderService.create(payload, transaction, {
      role: ROLES.CUSTOMER,
    });

    expect(mocks.getNearestWarehouse).toHaveBeenCalledTimes(2);
    expect(mocks.getActiveRouteByWarehousePair).not.toHaveBeenCalled();
    expect(mocks.calculateFee).toHaveBeenCalledWith(
      expect.objectContaining({
        routeId: null,
        distance: 8,
        shippingMode: "consolidated",
      }),
    );
    expect(mocks.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        warehouseId: "warehouse-nearest",
        destinationWarehouseId: "warehouse-nearest",
        pickupLocation: { latitude: 10.78, longitude: 106.69 },
        deliveryLocation: { latitude: 10.8, longitude: 106.72 },
        pickupDistanceKm: 3.2,
        deliveryDistanceKm: 4.8,
        totalDistanceKm: 8,
        routeId: null,
        shippingMode: "consolidated",
        status: "created",
      }),
      transaction,
    );
    expect(result).toEqual({ _id: "order-1", orderCode: "ORD-0001" });
  });

  it("resolves inter-warehouse route and 3-stage distance for customer orders", async () => {
    mocks.getNearestWarehouse
      .mockResolvedValueOnce({
        warehouse: { _id: "warehouse-a" },
        distanceKm: 4.5,
      })
      .mockResolvedValueOnce({
        warehouse: { _id: "warehouse-b" },
        distanceKm: 5.5,
      });
    mocks.getActiveRouteByWarehousePair.mockResolvedValue({
      _id: "route-ab",
      distance: 120,
    });

    const payload = {
      ...validCreatePayload,
      routeId: undefined,
      deliveryLocation: { latitude: 21.02, longitude: 105.83 },
    };
    await orderService.create(payload, transaction, { role: ROLES.CUSTOMER });

    expect(mocks.getActiveRouteByWarehousePair).toHaveBeenCalledWith(
      "warehouse-a",
      "warehouse-b",
    );
    expect(mocks.calculateFee).toHaveBeenCalledWith(
      expect.objectContaining({
        routeId: "route-ab",
        distance: 130,
      }),
    );
    expect(mocks.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        warehouseId: "warehouse-a",
        destinationWarehouseId: "warehouse-b",
        routeId: "route-ab",
        pickupDistanceKm: 4.5,
        deliveryDistanceKm: 5.5,
        totalDistanceKm: 130,
      }),
      transaction,
    );
  });

  it("rejects inter-warehouse consolidated order when no active route exists", async () => {
    mocks.getNearestWarehouse
      .mockResolvedValueOnce({
        warehouse: { _id: "warehouse-a" },
        distanceKm: 4,
      })
      .mockResolvedValueOnce({
        warehouse: { _id: "warehouse-b" },
        distanceKm: 6,
      });
    mocks.getActiveRouteByWarehousePair.mockResolvedValue(null);

    await expect(
      orderService.create(
        {
          ...validCreatePayload,
          routeId: undefined,
          deliveryLocation: { latitude: 21.02, longitude: 105.83 },
        },
        transaction,
        { role: ROLES.CUSTOMER },
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: ORDER_MESSAGES.ROUTE_NOT_SUPPORTED,
    });
  });

  it("calculates direct FTL distance A -> B without route lookup", async () => {
    await orderService.create(
      {
        ...validCreatePayload,
        routeId: undefined,
        shippingMode: "direct",
        deliveryLocation: { latitude: 10.88, longitude: 106.79 },
      },
      transaction,
      { role: ROLES.CUSTOMER },
    );

    expect(mocks.getActiveRouteByWarehousePair).not.toHaveBeenCalled();
    expect(mocks.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        shippingMode: "direct",
        routeId: null,
        destinationWarehouseId: null,
        warehouseId: "warehouse-nearest",
        totalDistanceKm: expect.any(Number),
      }),
      transaction,
    );
  });

  it("requires a warehouse or pickup location for admin order creation", async () => {
    await expect(
      orderService.create(
        {
          ...validCreatePayload,
          warehouseId: null,
          pickupLocation: null,
        },
        transaction,
        { role: ROLES.ADMIN },
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: ORDER_MESSAGES.WAREHOUSE_REQUIRED,
    });
  });

  it("creates the order as unpaid without charging the wallet", async () => {
    const result = await orderService.create(
      { ...validCreatePayload, quantity: 3 },
      transaction,
    );

    expect(result).toEqual({ _id: "order-1", orderCode: "ORD-0001" });
    expect(mocks.calculateFee).toHaveBeenCalledWith({
      serviceType: "standard",
      shippingMode: "consolidated",
      weight: 2,
      length: 100,
      width: 100,
      height: 100,
      quantity: 3,
      distance: 3.2,
      routeId: "route-1",
      goodsCategoryId: "category-1",
      contractDiscountRate: 0,
    });
    expect(mocks.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        orderCode: "ORD-0001",
        customerId: "customer-1",
        length: 100,
        width: 100,
        height: 100,
        volume: 1000000,
        shippingFee: 25000,
        shippingFeePaid: false,
        shippingFeePaidAmount: 0,
        totalAmount: 30000,
        status: "created",
        paymentMethod: null,
        paymentTerms: "immediate",
        paymentStatus: "pending",
        paymentTime: null,
      }),
      transaction,
    );
    expect(mocks.assertCreditAvailable).not.toHaveBeenCalled();
    expect(mocks.debitWallet).not.toHaveBeenCalled();
    expect(mocks.updateCustomerById).not.toHaveBeenCalled();
    expect(mocks.recordTransaction).not.toHaveBeenCalled();
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

  it("checks the credit limit and snapshots payment terms for postpaid customers", async () => {
    mocks.getCustomerById.mockResolvedValue({
      _id: "customer-1",
      userId: { _id: "user-1" },
      walletBalance: 0,
      creditLimit: 500000,
      defaultPaymentTerms: "net_30",
    });

    await orderService.create({ ...validCreatePayload }, transaction);

    expect(mocks.assertCreditAvailable).toHaveBeenCalledWith({
      customer: expect.objectContaining({ _id: "customer-1" }),
      paymentTerms: "net_30",
      additionalAmount: 25000,
    });
    expect(mocks.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: "customer-1",
        paymentTerms: "net_30",
        shippingFee: 25000,
      }),
      transaction,
    );
  });

  it("rejects a postpaid order when the credit limit is exceeded", async () => {
    const message = CUSTOMER_MESSAGES.CREDIT_LIMIT_EXCEEDED(10000, 25000);
    mocks.getCustomerById.mockResolvedValue({
      _id: "customer-1",
      userId: { _id: "user-1" },
      walletBalance: 0,
      creditLimit: 10000,
      defaultPaymentTerms: "net_30",
    });
    mocks.assertCreditAvailable.mockRejectedValue({
      statusCode: 409,
      message,
    });

    await expect(
      orderService.create({ ...validCreatePayload }, transaction),
    ).rejects.toMatchObject({
      statusCode: 409,
      message,
    });

    expect(mocks.createOrder).not.toHaveBeenCalled();
    expect(mocks.createTrackingLog).not.toHaveBeenCalled();
  });

  it("applies the customer's contract discount and snapshots the pricing breakdown", async () => {
    mocks.getCustomerById.mockResolvedValue({
      _id: "customer-1",
      userId: { _id: "user-1" },
      walletBalance: 0,
      creditLimit: 0,
      defaultPaymentTerms: "immediate",
      contractDiscountRate: 5,
    });
    mocks.calculateFee.mockResolvedValue({
      totalShippingFee: 23750,
      shippingFeeBeforeDiscount: 25000,
      discountRate: 5,
      discountAmount: 1250,
    });

    await orderService.create({ ...validCreatePayload }, transaction);

    expect(mocks.calculateFee).toHaveBeenCalledWith(
      expect.objectContaining({ contractDiscountRate: 5 }),
    );
    expect(mocks.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        shippingFee: 23750,
        shippingFeeBeforeDiscount: 25000,
        discountRateApplied: 5,
        discountAmount: 1250,
        totalAmount: 28750,
      }),
      transaction,
    );
  });

  it("creates an express order and passes serviceType to pricing", async () => {
    const result = await orderService.create(
      { ...validCreatePayload, type: "express" },
      transaction,
    );

    expect(result).toEqual({ _id: "order-1", orderCode: "ORD-0001" });
    expect(mocks.calculateFee).toHaveBeenCalledWith({
      serviceType: "express",
      shippingMode: "consolidated",
      weight: 2,
      length: 100,
      width: 100,
      height: 100,
      quantity: 1,
      distance: 3.2,
      routeId: "route-1",
      goodsCategoryId: "category-1",
      contractDiscountRate: 0,
    });
    expect(mocks.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "express",
      }),
      transaction,
    );
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

  it("allows a destination warehouse dispatcher to view inbound order details", async () => {
    mocks.findById.mockResolvedValue({
      ...existingOrder,
      warehouseId: "warehouse-origin",
      destinationWarehouseId: "warehouse-dest",
    });

    await expect(
      orderService.getById("order-1", true, {
        role: ROLES.DISPATCHER,
        warehouseId: "warehouse-dest",
      }),
    ).resolves.toMatchObject({
      _id: "order-1",
      destinationWarehouseId: "warehouse-dest",
    });
  });

  it("rejects an unrelated warehouse dispatcher from viewing order details", async () => {
    mocks.findById.mockResolvedValue({
      ...existingOrder,
      warehouseId: "warehouse-origin",
      destinationWarehouseId: "warehouse-dest",
    });

    await expect(
      orderService.getById("order-1", true, {
        role: ROLES.DISPATCHER,
        warehouseId: "warehouse-other",
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: WAREHOUSE_MESSAGES.ACCESS_DENIED,
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

  it("scopes a dispatcher's order list directly to their assigned warehouse", async () => {
    mocks.findAll.mockResolvedValue([existingOrder]);
    mocks.countAll.mockResolvedValue(1);

    await orderService.getAll({
      filter: { status: "created" },
      user: { role: ROLES.DISPATCHER, warehouseId: "warehouse-1" },
    });

    expect(mocks.findAll).toHaveBeenCalledWith({
      filter: {
        deletedAt: null,
        status: "created",
        warehouseId: "warehouse-1",
      },
      skip: 0,
      limit: 10,
      sort: { createdAt: -1 },
    });
    expect(mocks.getTripIdsByWarehouseId).not.toHaveBeenCalled();
  });

  it("allows a dispatcher to query inbound orders by destinationWarehouseId", async () => {
    mocks.findAll.mockResolvedValue([existingOrder]);
    mocks.countAll.mockResolvedValue(1);

    await orderService.getAll({
      filter: {
        destinationWarehouseId: "warehouse-dest",
        status: "transporting",
      },
      user: { role: ROLES.DISPATCHER, warehouseId: "warehouse-dest" },
    });

    expect(mocks.findAll).toHaveBeenCalledWith({
      filter: {
        deletedAt: null,
        status: "transporting",
        destinationWarehouseId: "warehouse-dest",
      },
      skip: 0,
      limit: 10,
      sort: { createdAt: -1 },
    });
  });

  it("rejects a dispatcher querying a foreign destination warehouse", async () => {
    await expect(
      orderService.getAll({
        filter: { destinationWarehouseId: "warehouse-foreign" },
        user: { role: ROLES.DISPATCHER, warehouseId: "warehouse-own" },
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: WAREHOUSE_MESSAGES.ACCESS_DENIED,
    });
  });

  it("allows a dispatcher to query all warehouse-related orders with warehouseScope: all", async () => {
    mocks.findAll.mockResolvedValue([existingOrder]);
    mocks.countAll.mockResolvedValue(1);

    await orderService.getAll({
      filter: { warehouseScope: "all" },
      user: { role: ROLES.DISPATCHER, warehouseId: "warehouse-1" },
    });

    expect(mocks.findAll).toHaveBeenCalledWith({
      filter: {
        $and: [
          { deletedAt: null },
          {
            $or: [
              { warehouseId: "warehouse-1" },
              { destinationWarehouseId: "warehouse-1" },
            ],
          },
        ],
      },
      skip: 0,
      limit: 10,
      sort: { createdAt: -1 },
    });
  });
});

describe("orderService.cancelOrder", () => {
  it("unassigns the cancelled order and syncs its trip in the same transaction", async () => {
    mocks.findById.mockResolvedValue({
      ...existingOrder,
      status: "driver_assigned",
      tripId: "trip-1",
    });
    mocks.updateById.mockResolvedValue({
      ...existingOrder,
      status: "cancelled",
      tripId: null,
    });
    mocks.createTrackingLog.mockResolvedValue({ _id: "tracking-1" });

    await orderService.cancelOrder({
      orderId: "order-1",
      reason: "Customer cancelled",
    });

    expect(mocks.updateById).toHaveBeenCalledWith(
      "order-1",
      expect.objectContaining({ status: "cancelled", tripId: null }),
      transaction,
      expect.any(Object),
    );
    expect(mocks.createTrackingLog).toHaveBeenCalledWith(
      expect.objectContaining({ tripId: "trip-1", status: "cancelled" }),
      transaction,
    );
    expect(mocks.syncTripTotalOrder).toHaveBeenCalledWith(
      "trip-1",
      transaction,
    );
    expect(transaction.commitTransaction).toHaveBeenCalled();
  });

  it("refunds wallet balance when cancelling an undelivered order paid via wallet", async () => {
    mocks.findById.mockResolvedValue({
      ...existingOrder,
      status: "created",
      paymentMethod: "wallet_balance",
      shippingFeePaid: true,
      shippingFeePaidAmount: 30000,
      shippingFee: 30000,
      customerId: { _id: "cust-1" },
    });
    mocks.updateById.mockResolvedValue({
      ...existingOrder,
      status: "cancelled",
      tripId: null,
    });
    mocks.getCustomerById.mockResolvedValue({
      _id: "cust-1",
      walletBalance: 10000,
      totalSpent: 0,
    });
    mocks.updateCustomerById.mockResolvedValue({ _id: "cust-1" });
    mocks.createTrackingLog.mockResolvedValue({ _id: "tracking-1" });

    await orderService.cancelOrder({
      orderId: "order-1",
      reason: "Customer cancelled",
    });

    expect(mocks.updateCustomerById).toHaveBeenCalledWith(
      "cust-1",
      {
        $inc: {
          walletBalance: 30000,
        },
      },
      transaction,
      {},
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

  it("does not derive payment status from collected COD", async () => {
    mocks.findById.mockResolvedValue(existingOrder);
    mocks.updateById.mockResolvedValue({
      ...existingOrder,
      codCollected: true,
    });

    await orderService.updateById({
      orderId: "order-1",
      updateData: { codCollected: true },
    });

    const [, payload] = mocks.updateById.mock.calls[0];
    expect(payload.codCollected).toBe(true);
    expect(payload).not.toHaveProperty("paymentStatus");
    expect(payload).not.toHaveProperty("paymentTime");
  });
});

describe("orderService.markAsDelivered", () => {
  const deliveryOrder = {
    _id: "order-1",
    deletedAt: null,
    orderCode: "ORD-0001",
    status: "out_for_delivery",
    codAmount: 50000,
    codCollected: false,
    codCollectedAmount: 0,
    tripId: "trip-1",
    customerId: { userId: { _id: "user-1" } },
  };

  it("requires codCollectedAmount when order has COD and has not been collected", async () => {
    mocks.findById.mockResolvedValue(deliveryOrder);
    mocks.getTripById.mockResolvedValue({ _id: "trip-1" });

    await expect(
      orderService.markAsDelivered({
        orderId: "order-1",
        user: { role: ROLES.ADMIN },
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: ORDER_MESSAGES.COD_COLLECTION_REQUIRED,
    });
  });

  it("rejects when codCollectedAmount does not match order codAmount", async () => {
    mocks.findById.mockResolvedValue(deliveryOrder);
    mocks.getTripById.mockResolvedValue({ _id: "trip-1" });

    await expect(
      orderService.markAsDelivered({
        orderId: "order-1",
        codCollectedAmount: 30000,
        user: { role: ROLES.ADMIN },
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: ORDER_MESSAGES.INVALID_COD_COLLECTED_AMOUNT,
    });
  });

  it("marks as delivered and records COD collection when exact amount is provided", async () => {
    mocks.findById.mockResolvedValue(deliveryOrder);
    mocks.getTripById.mockResolvedValue({ _id: "trip-1" });
    mocks.updateById.mockResolvedValue({
      ...deliveryOrder,
      status: "delivered",
      codCollected: true,
      codCollectedAmount: 50000,
    });
    mocks.createTrackingLog.mockResolvedValue({ _id: "log-1" });

    const result = await orderService.markAsDelivered({
      orderId: "order-1",
      codCollectedAmount: 50000,
      user: { role: ROLES.ADMIN },
    });

    expect(result.order.status).toBe("delivered");
    expect(mocks.updateById).toHaveBeenCalledWith(
      "order-1",
      expect.objectContaining({
        status: "delivered",
        codCollected: true,
        codCollectedAmount: 50000,
      }),
      transaction,
      expect.any(Object),
    );
  });

  it("marks as delivered without COD when order codAmount is 0", async () => {
    mocks.findById.mockResolvedValue({
      ...deliveryOrder,
      codAmount: 0,
    });
    mocks.getTripById.mockResolvedValue({ _id: "trip-1" });
    mocks.updateById.mockResolvedValue({
      ...deliveryOrder,
      codAmount: 0,
      status: "delivered",
    });
    mocks.createTrackingLog.mockResolvedValue({ _id: "log-1" });

    const result = await orderService.markAsDelivered({
      orderId: "order-1",
      user: { role: ROLES.ADMIN },
    });

    expect(result.order.status).toBe("delivered");
    expect(mocks.updateById).toHaveBeenCalledWith(
      "order-1",
      expect.not.objectContaining({
        codCollected: true,
      }),
      transaction,
      expect.any(Object),
    );
  });

  it("sends delivery update and feedback request notifications when customer user exists", async () => {
    mocks.findById.mockResolvedValue({
      ...deliveryOrder,
      codAmount: 0,
    });
    mocks.getTripById.mockResolvedValue({ _id: "trip-1" });
    mocks.updateById.mockResolvedValue({
      ...deliveryOrder,
      codAmount: 0,
      status: "delivered",
    });
    mocks.createTrackingLog.mockResolvedValue({ _id: "log-1" });

    await orderService.markAsDelivered({
      orderId: "order-1",
      user: { role: ROLES.ADMIN },
    });

    expect(mocks.createManyNotifications).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          userId: "user-1",
          type: "ORDER_UPDATE",
        }),
        expect.objectContaining({
          userId: "user-1",
          type: "FEEDBACK_REQUEST",
          data: expect.objectContaining({ orderId: "order-1" }),
        }),
      ]),
    );
  });

  it("marks as delivered and records customer spending without awarding loyalty points", async () => {
    mocks.findById.mockResolvedValue({
      ...deliveryOrder,
      codAmount: 0,
      shippingFee: 50000,
      shippingFeePaid: true,
      shippingFeePaidAmount: 50000,
      customerId: { _id: "cust-1", userId: { _id: "user-1" } },
    });
    mocks.getTripById.mockResolvedValue({ _id: "trip-1" });
    mocks.updateById.mockResolvedValue({
      ...deliveryOrder,
      codAmount: 0,
      status: "delivered",
    });
    mocks.createTrackingLog.mockResolvedValue({ _id: "log-1" });
    mocks.updateCustomerById.mockResolvedValue({ _id: "cust-1" });

    const result = await orderService.markAsDelivered({
      orderId: "order-1",
      user: { role: ROLES.ADMIN },
    });

    expect(result.order.status).toBe("delivered");
    expect(mocks.updateById).toHaveBeenCalledWith(
      "order-1",
      expect.objectContaining({
        status: "delivered",
      }),
      transaction,
      expect.any(Object),
    );
    expect(mocks.updateById).toHaveBeenCalledWith(
      "order-1",
      expect.not.objectContaining({
        loyaltyPointsAwarded: true,
      }),
      transaction,
      expect.any(Object),
    );
    expect(mocks.updateCustomerById).toHaveBeenCalledWith(
      "cust-1",
      {
        $inc: { totalSpent: 50000 },
        lastPurchaseDate: expect.any(Date),
      },
      transaction,
    );
  });

  it("records customer spending at delivery even when the shipping fee is not fully paid", async () => {
    mocks.findById.mockResolvedValue({
      ...deliveryOrder,
      codAmount: 0,
      shippingFeePaid: false,
      shippingFeePaidAmount: 20000,
      shippingFee: 50000,
      customerId: { _id: "cust-1", userId: { _id: "user-1" } },
    });
    mocks.getTripById.mockResolvedValue({ _id: "trip-1" });
    mocks.updateById.mockResolvedValue({
      ...deliveryOrder,
      codAmount: 0,
      status: "delivered",
    });
    mocks.createTrackingLog.mockResolvedValue({ _id: "log-1" });
    mocks.updateCustomerById.mockResolvedValue({ _id: "cust-1" });

    const result = await orderService.markAsDelivered({
      orderId: "order-1",
      user: { role: ROLES.ADMIN },
    });

    expect(result.order.status).toBe("delivered");
    expect(mocks.updateById).toHaveBeenCalledWith(
      "order-1",
      expect.not.objectContaining({
        loyaltyPointsAwarded: true,
      }),
      transaction,
      expect.any(Object),
    );
    expect(mocks.updateCustomerById).toHaveBeenCalledWith(
      "cust-1",
      {
        $inc: { totalSpent: 50000 },
        lastPurchaseDate: expect.any(Date),
      },
      transaction,
    );
  });

  describe("orderService.markOrderAsFeedbacked", () => {
    it("updates order isFeedbacked to true", async () => {
      mocks.updateById.mockResolvedValue({
        _id: "order-1",
        isFeedbacked: true,
      });

      await orderService.markOrderAsFeedbacked("order-1", transaction);

      expect(mocks.updateById).toHaveBeenCalledWith(
        "order-1",
        { isFeedbacked: true },
        transaction,
      );
    });
  });
});

describe("orderService invoice billing helpers", () => {
  it("allocates an invoice payment sequentially across its orders", async () => {
    mocks.findByIds.mockResolvedValue([
      {
        _id: "order-2",
        shippingFee: 1500,
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      },
      {
        _id: "order-1",
        shippingFee: 2500,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);

    const updatedCount = await orderService.applyInvoicePayment({
      orderIds: ["order-1", "order-2"],
      paidAmount: 3000,
      paymentMethod: "bank",
      paymentTime: new Date("2026-02-01T00:00:00.000Z"),
      session: transaction,
    });

    expect(updatedCount).toBe(2);
    expect(mocks.updateById).not.toHaveBeenCalled();

    const [bulkOps] = mocks.bulkWrite.mock.calls[0];
    expect(bulkOps).toHaveLength(2);
    expect(bulkOps[0].updateOne.filter).toEqual({ _id: "order-1" });
    expect(bulkOps[0].updateOne.update.$set).toEqual(
      expect.objectContaining({
        shippingFeePaidAmount: 2500,
        shippingFeePaid: true,
        paymentStatus: "completed",
        paymentMethod: "bank",
      }),
    );
    expect(bulkOps[1].updateOne.filter).toEqual({ _id: "order-2" });
    expect(bulkOps[1].updateOne.update.$set).toEqual(
      expect.objectContaining({
        shippingFeePaidAmount: 500,
        shippingFeePaid: false,
        paymentStatus: "pending",
      }),
    );
  });

  it("marks every order paid when the invoice covers all shipping fees", async () => {
    mocks.findByIds.mockResolvedValue([
      {
        _id: "order-1",
        shippingFee: 2500,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        _id: "order-2",
        shippingFee: 1500,
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      },
    ]);

    await orderService.applyInvoicePayment({
      orderIds: ["order-1", "order-2"],
      paidAmount: 4000,
      session: transaction,
    });

    const [bulkOps] = mocks.bulkWrite.mock.calls[0];
    expect(bulkOps).toHaveLength(2);
    expect(bulkOps[1].updateOne.filter).toEqual({ _id: "order-2" });
    expect(bulkOps[1].updateOne.update.$set).toEqual(
      expect.objectContaining({
        shippingFeePaidAmount: 1500,
        shippingFeePaid: true,
        paymentStatus: "completed",
      }),
    );
    expect(mocks.updateById).not.toHaveBeenCalled();
  });

  it("returns billable orders for a billing period", async () => {
    const fromDate = new Date("2026-01-01T00:00:00.000Z");
    const toDate = new Date("2026-01-31T00:00:00.000Z");
    const orders = [{ _id: "order-1" }];
    mocks.findBillableByCustomer.mockResolvedValue(orders);

    const result = await orderService.getBillableOrdersForInvoice({
      customerId: "customer-1",
      fromDate,
      toDate,
      excludeOrderIds: ["order-9"],
    });

    expect(mocks.findBillableByCustomer).toHaveBeenCalledWith({
      customerId: "customer-1",
      fromDate,
      toDate,
      excludeOrderIds: ["order-9"],
    });
    expect(result).toEqual(orders);
  });
});
