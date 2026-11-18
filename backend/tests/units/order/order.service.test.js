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
  findLoadsByTripId: vi.fn(),
  findPublicTrackingLogsByOrderId: vi.fn(),
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
    updateMany: mocks.updateMany,
    findLoadsByTripId: mocks.findLoadsByTripId,
    findPublicTrackingLogsByOrderId: mocks.findPublicTrackingLogsByOrderId,
    findRawByFilter: mocks.findRawByFilter,
    findBillableByCustomer: mocks.findBillableByCustomer,
    countUnfinishedOrdersByTrip: mocks.countUnfinishedOrdersByTrip,
  },
}));

vi.mock("../../../src/utils/generateCode.js", () => ({
  default: mocks.generateCode,
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
  mocks.generateCode.mockReturnValue("ORD-0001");
  mocks.findLoadsByTripId.mockResolvedValue([]);
  mocks.updateMany.mockResolvedValue({ modifiedCount: 1 });
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

  it("rejects assignment when total weight exceeds vehicle capacity", async () => {
    mocks.getTripById.mockResolvedValue({
      _id: "trip-1",
      type: "delivery",
      status: "planned",
      routeId: "route-1",
      warehouseId: "warehouse-1",
      vehicleId: {
        _id: "vehicle-1",
        capacityWeight: 100,
        capacityVolume: 10,
      },
    });
    mocks.findByIds.mockResolvedValue([
      {
        _id: "order-1",
        orderCode: "ORD-0001",
        status: "stored",
        routeId: "route-1",
        warehouseId: "warehouse-1",
        weight: 30,
        volume: 1000000,
        quantity: 2,
      },
    ]);
    mocks.findLoadsByTripId.mockResolvedValue([
      { _id: "other-1", weight: 80, volume: 2000000, quantity: 1 },
    ]);

    await expect(
      orderService.assignOrdersToTrip({
        tripId: "trip-1",
        orderIds: ["order-1"],
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: ORDER_MESSAGES.EXCEED_VEHICLE_WEIGHT(140, 100),
    });
    expect(mocks.startSession).not.toHaveBeenCalled();
  });

  it("rejects assignment when total volume exceeds vehicle capacity", async () => {
    mocks.getTripById.mockResolvedValue({
      _id: "trip-1",
      type: "delivery",
      status: "planned",
      routeId: "route-1",
      warehouseId: "warehouse-1",
      vehicleId: {
        _id: "vehicle-1",
        capacityWeight: 500,
        capacityVolume: 5,
      },
    });
    mocks.findByIds.mockResolvedValue([
      {
        _id: "order-1",
        orderCode: "ORD-0001",
        status: "stored",
        routeId: "route-1",
        warehouseId: "warehouse-1",
        weight: 20,
        volume: 2000000,
        quantity: 2,
      },
    ]);
    mocks.findLoadsByTripId.mockResolvedValue([
      { _id: "other-1", weight: 50, volume: 4000000, quantity: 1 },
    ]);

    await expect(
      orderService.assignOrdersToTrip({
        tripId: "trip-1",
        orderIds: ["order-1"],
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: ORDER_MESSAGES.EXCEED_VEHICLE_VOLUME(8, 5),
    });
    expect(mocks.startSession).not.toHaveBeenCalled();
  });

  it("successfully assigns orders when within vehicle capacity", async () => {
    const trip = {
      _id: "trip-1",
      tripCode: "TRIP-0001",
      type: "delivery",
      status: "planned",
      routeId: "route-1",
      warehouseId: "warehouse-1",
      vehicleId: {
        _id: "vehicle-1",
        capacityWeight: 500,
        capacityVolume: 10,
      },
    };
    const order = {
      _id: "order-1",
      orderCode: "ORD-0001",
      status: "stored",
      routeId: "route-1",
      warehouseId: "warehouse-1",
      weight: 50,
      volume: 1000000,
      quantity: 2,
    };
    mocks.getTripById.mockResolvedValue(trip);
    mocks.findByIds.mockResolvedValue([order]);
    mocks.findLoadsByTripId.mockResolvedValue([
      { _id: "other-1", weight: 100, volume: 2000000, quantity: 1 },
    ]);
    mocks.updateMany.mockResolvedValue({ modifiedCount: 1 });

    const result = await orderService.assignOrdersToTrip({
      tripId: "trip-1",
      orderIds: ["order-1"],
    });

    expect(result).toEqual({ assignedCount: 1, tripId: "trip-1" });
    expect(mocks.startSession).toHaveBeenCalled();
    expect(mocks.updateMany).toHaveBeenCalledWith(
      {
        _id: { $in: ["order-1"] },
        status: "stored",
        $or: [{ tripId: null }, { tripId: "trip-1" }],
      },
      { tripId: "trip-1", warehouseId: "warehouse-1" },
      transaction,
    );
    expect(mocks.syncTripTotalOrder).toHaveBeenCalledWith(
      "trip-1",
      transaction,
    );
  });

  it("allows assigning intra-zone or arrived orders to a delivery trip without routeId", async () => {
    const deliveryTrip = {
      _id: "trip-delivery",
      tripCode: "TRIP-DEL-1",
      type: "delivery",
      status: "planned",
      routeId: null,
      warehouseId: "warehouse-b",
    };
    const arrivedOrder = {
      _id: "order-1",
      orderCode: "ORD-0001",
      status: "stored",
      routeId: "route-ab",
      warehouseId: "warehouse-b",
      destinationWarehouseId: "warehouse-b",
    };
    mocks.getTripById.mockResolvedValue(deliveryTrip);
    mocks.findByIds.mockResolvedValue([arrivedOrder]);
    mocks.updateMany.mockResolvedValue({ modifiedCount: 1 });

    const result = await orderService.assignOrdersToTrip({
      tripId: "trip-delivery",
      orderIds: ["order-1"],
    });

    expect(result).toEqual({ assignedCount: 1, tripId: "trip-delivery" });
  });

  it("blocks assigning an order at Kho A to a delivery trip if its destinationWarehouseId is Kho B", async () => {
    mocks.getTripById.mockResolvedValue({
      _id: "trip-delivery-a",
      type: "delivery",
      status: "planned",
      routeId: null,
      warehouseId: "warehouse-a",
    });
    mocks.findByIds.mockResolvedValue([
      {
        _id: "order-1",
        orderCode: "ORD-0001",
        status: "stored",
        routeId: "route-ab",
        warehouseId: "warehouse-a",
        destinationWarehouseId: "warehouse-b",
      },
    ]);

    await expect(
      orderService.assignOrdersToTrip({
        tripId: "trip-delivery-a",
        orderIds: ["order-1"],
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: ORDER_MESSAGES.TRANSFER_REQUIRED_BEFORE_DELIVERY,
    });
  });

  it("enforces routeId match when assigning stored orders to a transfer trip", async () => {
    mocks.getTripById.mockResolvedValue({
      _id: "trip-transfer",
      type: "transfer",
      status: "planned",
      routeId: "route-ab",
      warehouseId: "warehouse-a",
    });
    mocks.findByIds.mockResolvedValue([
      {
        _id: "order-1",
        orderCode: "ORD-0001",
        status: "stored",
        routeId: "route-ac",
        warehouseId: "warehouse-a",
      },
    ]);

    await expect(
      orderService.assignOrdersToTrip({
        tripId: "trip-transfer",
        orderIds: ["order-1"],
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: ORDER_MESSAGES.ROUTE_TRIP_MISMATCH,
    });
  });
});

describe("orderService.unassignOrdersFromTrip", () => {
  it("throws error when order is not assigned to any trip", async () => {
    const order = {
      _id: "order-1",
      orderCode: "ORD-0001",
      status: "created",
      tripId: null,
      warehouseId: "warehouse-1",
    };
    mocks.findByIds.mockResolvedValue([order]);

    await expect(
      orderService.unassignOrdersFromTrip({ orderIds: ["order-1"] }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: ORDER_MESSAGES.ORDER_NOT_ASSIGNED,
    });
  });

  it("throws error when order status cannot be unassigned", async () => {
    const order = {
      _id: "order-1",
      orderCode: "ORD-0001",
      status: "delivered",
      tripId: "trip-1",
      warehouseId: "warehouse-1",
    };
    const trip = {
      _id: "trip-1",
      status: "planned",
      type: "delivery",
    };
    mocks.findByIds.mockResolvedValue([order]);
    mocks.getTripById.mockResolvedValue(trip);

    await expect(
      orderService.unassignOrdersFromTrip({ orderIds: ["order-1"] }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: ORDER_MESSAGES.CANNOT_UNASSIGN_ORDER_STATUS(
        order.orderCode,
        order.status,
      ),
    });
  });

  it("successfully unassigns orders even when trip route differs from order route", async () => {
    const trip = {
      _id: "trip-1",
      tripCode: "TRIP-0001",
      type: "delivery",
      status: "planned",
      routeId: "route-trip-changed",
      warehouseId: "warehouse-1",
    };
    const order = {
      _id: "order-1",
      orderCode: "ORD-0001",
      status: "stored",
      tripId: "trip-1",
      routeId: "route-order-original",
      warehouseId: "warehouse-1",
    };
    mocks.findByIds.mockResolvedValue([order]);
    mocks.getTripById.mockResolvedValue(trip);
    mocks.updateById.mockResolvedValue({ ...order, tripId: null });

    const result = await orderService.unassignOrdersFromTrip({
      orderIds: ["order-1"],
    });

    expect(result).toEqual({ unassignedCount: 1 });
    expect(mocks.updateById).toHaveBeenCalledWith(
      "order-1",
      { tripId: null },
      transaction,
      { tripId: "trip-1", status: "stored", deletedAt: null },
    );
    expect(mocks.syncTripTotalOrder).toHaveBeenCalledWith(
      "trip-1",
      transaction,
    );
    expect(transaction.commitTransaction).toHaveBeenCalled();
  });

  it("successfully unassigns pickup orders with null trip routeId", async () => {
    const trip = {
      _id: "trip-pickup",
      tripCode: "TRIP-PICKUP-1",
      type: "pickup",
      status: "planned",
      routeId: null,
      warehouseId: "warehouse-1",
    };
    const order = {
      _id: "order-pickup-1",
      orderCode: "ORD-0002",
      status: "driver_assigned",
      tripId: "trip-pickup",
      routeId: "route-order",
      warehouseId: null,
    };
    mocks.findByIds.mockResolvedValue([order]);
    mocks.getTripById.mockResolvedValue(trip);
    mocks.updateById.mockResolvedValue({
      ...order,
      tripId: null,
      status: "created",
    });

    const result = await orderService.unassignOrdersFromTrip({
      orderIds: ["order-pickup-1"],
    });

    expect(result).toEqual({ unassignedCount: 1 });
    expect(mocks.updateById).toHaveBeenCalledWith(
      "order-pickup-1",
      { tripId: null, status: "created", warehouseId: "warehouse-1" },
      transaction,
      { tripId: "trip-pickup", status: "driver_assigned", deletedAt: null },
    );
    expect(mocks.syncTripTotalOrder).toHaveBeenCalledWith(
      "trip-pickup",
      transaction,
    );
    expect(transaction.commitTransaction).toHaveBeenCalled();
  });
});

describe("orderService.getTripLoadMetrics", () => {
  it("calculates total weight and volume in cm³ excluding specified orders", async () => {
    mocks.findLoadsByTripId.mockResolvedValue([
      { _id: "order-1", weight: 15, volume: 1000000, quantity: 2 },
      { _id: "order-2", weight: 25, volume: 2000000, quantity: 1 },
      { _id: "order-3", weight: 10, volume: 500000, quantity: 3 },
    ]);

    const result = await orderService.getTripLoadMetrics("trip-1", ["order-2"]);

    expect(result).toEqual({
      totalWeight: 60,
      totalVolumeCm3: 3500000,
      count: 2,
    });
    expect(mocks.findLoadsByTripId).toHaveBeenCalledWith("trip-1", null);
  });

  it("returns zero metrics when tripId is empty", async () => {
    const result = await orderService.getTripLoadMetrics(null);

    expect(result).toEqual({
      totalWeight: 0,
      totalVolumeCm3: 0,
      count: 0,
    });
    expect(mocks.findLoadsByTripId).not.toHaveBeenCalled();
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

describe("orderService.getPublicTrackingByCode", () => {
  it("returns public order tracking fields and chronological tracking logs", async () => {
    const deliveredAt = new Date("2026-01-01T00:00:00.000Z");
    const createdAt = new Date("2025-12-31T00:00:00.000Z");
    const logs = [{ status: "created" }];
    mocks.findByCode.mockResolvedValue({
      ...existingOrder,
      status: "delivered",
      weight: 2,
      volume: 1000000,
      type: "standard",
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
      volume: 1000000,
      type: "standard",
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

    expect(mocks.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        type: "ORDER_UPDATE",
      }),
    );
    expect(mocks.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        type: "FEEDBACK_REQUEST",
        data: expect.objectContaining({ orderId: "order-1" }),
      }),
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

  describe("Trip Completion and Cancellation Order Management", () => {
    it("counts unfinished orders by calling repository", async () => {
      mocks.countUnfinishedOrdersByTrip.mockResolvedValue(2);
      const count = await orderService.countUnfinishedOrdersByTrip(
        { _id: "trip-1", type: "delivery" },
        transaction,
      );
      expect(count).toBe(2);
      expect(mocks.countUnfinishedOrdersByTrip).toHaveBeenCalledWith(
        "trip-1",
        "delivery",
        transaction,
      );
    });

    it("reconciles failed delivery orders back to stored on trip completion", async () => {
      mocks.findRawByFilter.mockResolvedValue([
        { _id: "order-failed-1", status: "failed" },
        { _id: "order-returned-1", status: "returned" },
      ]);

      await orderService.handleOrdersOnTripCompletion(
        { _id: "trip-1", type: "delivery" },
        transaction,
        { userId: "user-admin" },
      );

      expect(mocks.updateById).toHaveBeenCalledWith(
        "order-failed-1",
        { tripId: null, status: "stored" },
        transaction,
      );
      expect(mocks.updateById).toHaveBeenCalledWith(
        "order-returned-1",
        { tripId: null, status: "returned" },
        transaction,
      );
      expect(mocks.createTrackingLog).toHaveBeenCalledTimes(2);
    });

    it("reconciles failed pickup orders back to created on trip completion", async () => {
      mocks.findRawByFilter.mockResolvedValue([
        { _id: "order-failed-pickup", status: "failed" },
      ]);

      await orderService.handleOrdersOnTripCompletion(
        { _id: "trip-1", type: "pickup" },
        transaction,
        { userId: "user-admin" },
      );

      expect(mocks.updateById).toHaveBeenCalledWith(
        "order-failed-pickup",
        { tripId: null, status: "created" },
        transaction,
      );
      expect(mocks.createTrackingLog).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: "order-failed-pickup",
          status: "created",
        }),
        transaction,
      );
    });

    it("resets orders to warehouse/created on trip cancellation", async () => {
      mocks.findRawByFilter.mockResolvedValue([
        { _id: "order-1", status: "transporting" },
      ]);

      await orderService.handleOrdersOnTripCancellation(
        { _id: "trip-1", type: "delivery" },
        transaction,
        { userId: "user-admin" },
      );

      expect(mocks.updateById).toHaveBeenCalledWith(
        "order-1",
        { tripId: null, status: "stored" },
        transaction,
      );
      expect(mocks.createTrackingLog).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: "order-1",
          status: "stored",
          notes: expect.stringContaining("bị hủy"),
        }),
        transaction,
      );
    });
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
    expect(mocks.updateById).toHaveBeenCalledWith(
      "order-1",
      expect.objectContaining({
        shippingFeePaidAmount: 2500,
        shippingFeePaid: true,
        paymentStatus: "completed",
        paymentMethod: "bank",
      }),
      transaction,
    );
    expect(mocks.updateById).toHaveBeenCalledWith(
      "order-2",
      expect.objectContaining({
        shippingFeePaidAmount: 500,
        shippingFeePaid: false,
        paymentStatus: "pending",
      }),
      transaction,
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

    expect(mocks.updateById).toHaveBeenCalledWith(
      "order-2",
      expect.objectContaining({
        shippingFeePaidAmount: 1500,
        shippingFeePaid: true,
        paymentStatus: "completed",
      }),
      transaction,
    );
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
