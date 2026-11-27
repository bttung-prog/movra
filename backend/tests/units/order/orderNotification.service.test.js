import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findCustomersByIds: vi.fn(),
  findActiveDispatchers: vi.fn(),
  createManyNotifications: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("../../../src/modules/customer/customer.repository.js", () => ({
  default: {
    findByIds: mocks.findCustomersByIds,
  },
}));

vi.mock("../../../src/modules/dispatcher/dispatcher.repository.js", () => ({
  default: {
    findActiveByWarehouseId: mocks.findActiveDispatchers,
  },
}));

vi.mock("../../../src/modules/notification/notification.service.js", () => ({
  default: {
    createMany: mocks.createManyNotifications,
  },
}));

vi.mock("../../../src/configs/logger.js", () => ({
  default: { error: mocks.loggerError },
}));

import { ORDER_STATUSES } from "../../../src/constants/orderStatuses.js";
import orderNotificationService from "../../../src/modules/order/orderNotification.service.js";

const baseOrder = {
  _id: "order-1",
  orderCode: "ORD-0001",
  customerId: "customer-1",
  warehouseId: "warehouse-1",
  tripId: "trip-1",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findCustomersByIds.mockResolvedValue([
    { _id: "customer-1", userId: { _id: "customer-user-1" } },
  ]);
  mocks.findActiveDispatchers.mockResolvedValue([
    { userId: { _id: "dispatcher-user-1" } },
  ]);
  mocks.createManyNotifications.mockResolvedValue([]);
});

describe("orderNotificationService.notifyOrderStatusChanged", () => {
  it("notifies the customer for a customer-facing status", async () => {
    await orderNotificationService.notifyOrderStatusChanged(
      baseOrder,
      ORDER_STATUSES.OUT_FOR_DELIVERY,
      ORDER_STATUSES.DELIVERY_SCHEDULED,
      null,
    );

    expect(mocks.createManyNotifications).toHaveBeenCalledWith([
      expect.objectContaining({
        userId: "customer-user-1",
        type: "ORDER_UPDATE",
        data: expect.objectContaining({
          orderId: "order-1",
          status: ORDER_STATUSES.DELIVERY_SCHEDULED,
          previousStatus: ORDER_STATUSES.OUT_FOR_DELIVERY,
        }),
      }),
    ]);
  });

  it("does not notify for delivered because markAsDelivered owns it", async () => {
    const result = await orderNotificationService.notifyOrderStatusChanged(
      baseOrder,
      ORDER_STATUSES.OUT_FOR_DELIVERY,
      ORDER_STATUSES.DELIVERED,
    );

    expect(result).toEqual([]);
    expect(mocks.createManyNotifications).not.toHaveBeenCalled();
  });

  it("notifies customer and responsible dispatcher for every failure", async () => {
    await orderNotificationService.notifyOrderStatusChanged(
      baseOrder,
      ORDER_STATUSES.OUT_FOR_DELIVERY,
      ORDER_STATUSES.FAILED,
      null,
      { notes: "Recipient unavailable", eventKey: "failure-log-1" },
    );

    const notifications = mocks.createManyNotifications.mock.calls[0][0];
    expect(notifications).toHaveLength(2);
    expect(notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: "customer-user-1" }),
        expect.objectContaining({ userId: "dispatcher-user-1" }),
      ]),
    );
    expect(notifications[0].data.eventKey).toContain("failure-log-1");

    await orderNotificationService.notifyOrderStatusChanged(
      baseOrder,
      ORDER_STATUSES.FAILED,
      ORDER_STATUSES.FAILED,
      null,
      { eventKey: "failure-log-2" },
    );

    expect(mocks.createManyNotifications).toHaveBeenCalledTimes(2);
  });

  it("sends a pickup failure event when the order status does not change", async () => {
    await orderNotificationService.notifyOrderStatusChanged(
      baseOrder,
      ORDER_STATUSES.PICKUP_SCHEDULED,
      ORDER_STATUSES.PICKUP_SCHEDULED,
      null,
      { event: "PICKUP_FAILED", eventKey: "tracking-log-1" },
    );

    const notifications = mocks.createManyNotifications.mock.calls[0][0];
    expect(notifications).toHaveLength(2);
    expect(notifications[0].data).toEqual(
      expect.objectContaining({
        event: "PICKUP_FAILED",
        status: ORDER_STATUSES.PICKUP_SCHEDULED,
      }),
    );
  });

  it("does not notify an actor dispatcher", async () => {
    await orderNotificationService.notifyOrderStatusChanged(
      baseOrder,
      ORDER_STATUSES.OUT_FOR_DELIVERY,
      ORDER_STATUSES.FAILED,
      { userId: "dispatcher-user-1" },
    );

    expect(mocks.createManyNotifications).toHaveBeenCalledWith([
      expect.objectContaining({ userId: "customer-user-1" }),
    ]);
  });

  it("swallows notification persistence failures", async () => {
    mocks.createManyNotifications.mockRejectedValue(new Error("database down"));

    await expect(
      orderNotificationService.notifyOrderStatusChanged(
        baseOrder,
        ORDER_STATUSES.OUT_FOR_DELIVERY,
        ORDER_STATUSES.FAILED,
      ),
    ).resolves.toEqual([]);

    expect(mocks.loggerError).toHaveBeenCalled();
  });
});

describe("orderNotificationService.notifyOrderStatusChangedBatch", () => {
  it("sends one dispatcher summary per warehouse for trip failures", async () => {
    const result = await orderNotificationService.notifyOrderStatusChangedBatch(
      {
        changes: [
          {
            order: { ...baseOrder, _id: "order-1" },
            oldStatus: ORDER_STATUSES.FAILED,
            newStatus: ORDER_STATUSES.STORED,
          },
          {
            order: { ...baseOrder, _id: "order-2" },
            oldStatus: ORDER_STATUSES.RETURNED,
            newStatus: ORDER_STATUSES.RETURNED,
          },
        ],
        summaryTrip: {
          _id: "trip-1",
          tripCode: "TRIP-0001",
          type: "delivery",
        },
      },
    );

    expect(result).toEqual([
      expect.objectContaining({
        userId: "dispatcher-user-1",
        data: expect.objectContaining({
          event: "TRIP_ORDER_FAILURES",
          failedCount: 1,
          returnedCount: 1,
        }),
      }),
    ]);
    expect(mocks.createManyNotifications).toHaveBeenCalledTimes(1);
  });
});

describe("orderNotificationService.notifyWarehouseHandoff", () => {
  it("notifies the old warehouse dispatcher after receipt", async () => {
    await orderNotificationService.notifyWarehouseHandoff({
      order: baseOrder,
      fromWarehouseId: "warehouse-1",
      toWarehouseId: "warehouse-2",
      receiptId: "receipt-1",
    });

    expect(mocks.findActiveDispatchers).toHaveBeenCalledWith("warehouse-1");
    expect(mocks.createManyNotifications).toHaveBeenCalledWith([
      expect.objectContaining({
        userId: "dispatcher-user-1",
        data: expect.objectContaining({
          event: "WAREHOUSE_HANDOFF",
          orderId: "order-1",
          fromWarehouseId: "warehouse-1",
          toWarehouseId: "warehouse-2",
          receiptId: "receipt-1",
        }),
      }),
    ]);
  });

  it("skips handoff when the warehouse does not change", async () => {
    const result = await orderNotificationService.notifyWarehouseHandoff({
      order: baseOrder,
      fromWarehouseId: "warehouse-1",
      toWarehouseId: "warehouse-1",
      receiptId: "receipt-1",
    });

    expect(result).toEqual([]);
    expect(mocks.findActiveDispatchers).not.toHaveBeenCalled();
  });
});
