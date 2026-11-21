import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ORDER_STATUSES,
  TRACKING_STATUS_TRANSITIONS,
} from "../../../src/constants/orderStatuses.js";
import { ORDER_MESSAGES } from "../../../src/constants/messages.js";
import { TRIP_TYPES } from "../../../src/constants/tripTypes.js";
import { TRIP_STATUSES } from "../../../src/constants/tripStatuses.js";

const session = {
  startTransaction: vi.fn(),
  commitTransaction: vi.fn().mockResolvedValue(undefined),
  abortTransaction: vi.fn().mockResolvedValue(undefined),
  endSession: vi.fn(),
};

const mocks = vi.hoisted(() => ({
  startSession: vi.fn(),
  createTrackingLog: vi.fn(),
  findByOrderId: vi.fn(),
  findPublicByOrderId: vi.fn(),
  countByOrderId: vi.fn(),
  getLatestByOrderId: vi.fn(),
  findOrderById: vi.fn(),
  findOrderByCode: vi.fn(),
  updateOrderById: vi.fn(),
  getUserById: vi.fn(),
  getTripById: vi.fn(),
  validateOrder: vi.fn((order) => order),
  checkOrderOwnership: vi.fn(),
  assertOrderWarehouseAccess: vi.fn(),
}));

vi.mock("mongoose", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: { ...actual.default, startSession: mocks.startSession },
  };
});

vi.mock("../../../src/modules/order/orderTrackingLog.repository.js", () => ({
  default: {
    create: mocks.createTrackingLog,
    findByOrderId: mocks.findByOrderId,
    findPublicByOrderId: mocks.findPublicByOrderId,
    countByOrderId: mocks.countByOrderId,
    getLatestByOrderId: mocks.getLatestByOrderId,
  },
}));

vi.mock("../../../src/modules/order/order.repository.js", () => ({
  default: {
    findById: mocks.findOrderById,
    findByCode: mocks.findOrderByCode,
    updateById: mocks.updateOrderById,
  },
}));

vi.mock("../../../src/modules/order/order.access.js", () => ({
  default: {
    validateOrder: mocks.validateOrder,
    checkOrderOwnership: mocks.checkOrderOwnership,
    assertOrderWarehouseAccess: mocks.assertOrderWarehouseAccess,
  },
}));

vi.mock("../../../src/modules/user/user.service.js", () => ({
  default: {
    getById: mocks.getUserById,
  },
}));

vi.mock("../../../src/modules/trip/trip.service.js", () => ({
  default: {
    getById: mocks.getTripById,
  },
}));

import orderTrackingLogService from "../../../src/modules/order/orderTrackingLog.service.js";

describe("orderTrackingLog.service", () => {
  const baseOrder = {
    _id: "order-1",
    orderCode: "ORD-0001",
    status: ORDER_STATUSES.CREATED,
    weight: 5,
    volume: 1000,
    type: "standard",
    tripId: "trip-1",
    warehouseId: "wh-1",
    deletedAt: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.startSession.mockResolvedValue(session);
    mocks.findOrderById.mockResolvedValue({ ...baseOrder });
    mocks.updateOrderById.mockResolvedValue({ ...baseOrder });
    mocks.createTrackingLog.mockResolvedValue({ _id: "log-1" });
  });

  describe("create", () => {
    it("rejects when expectedStatus does not match order status", async () => {
      mocks.findOrderById.mockResolvedValue({
        ...baseOrder,
        status: ORDER_STATUSES.CREATED,
      });

      await expect(
        orderTrackingLogService.create({
          orderId: "order-1",
          status: ORDER_STATUSES.DRIVER_ASSIGNED,
          expectedStatus: ORDER_STATUSES.STORED,
        }),
      ).rejects.toThrow(ORDER_MESSAGES.ORDER_ASSIGNMENT_CHANGED);
    });

    it("rejects when expectedWarehouseId does not match current warehouse", async () => {
      mocks.findOrderById.mockResolvedValue({
        ...baseOrder,
        warehouseId: "wh-1",
      });

      await expect(
        orderTrackingLogService.create({
          orderId: "order-1",
          status: ORDER_STATUSES.DRIVER_ASSIGNED,
          expectedWarehouseId: "wh-2",
        }),
      ).rejects.toThrow(ORDER_MESSAGES.ORDER_ASSIGNMENT_CHANGED);
    });

    it("rejects when user sets status to stored directly without receipt", async () => {
      await expect(
        orderTrackingLogService.create({
          orderId: "order-1",
          status: ORDER_STATUSES.STORED,
          user: { role: "dispatcher" },
        }),
      ).rejects.toThrow(ORDER_MESSAGES.STORAGE_REQUIRES_RECEIPT);
    });

    it("rejects when user sets status to picked_up without pickup confirmation", async () => {
      await expect(
        orderTrackingLogService.create({
          orderId: "order-1",
          status: ORDER_STATUSES.PICKED_UP,
          user: { role: "driver" },
          allowPickupConfirmation: false,
        }),
      ).rejects.toThrow(ORDER_MESSAGES.PICKUP_CONFIRMATION_REQUIRED);
    });

    it("rejects when tripId mismatches assigned tripId", async () => {
      mocks.findOrderById.mockResolvedValue({
        ...baseOrder,
        tripId: "trip-1",
      });

      await expect(
        orderTrackingLogService.create({
          orderId: "order-1",
          tripId: "trip-diff",
          status: ORDER_STATUSES.DRIVER_ASSIGNED,
        }),
      ).rejects.toThrow(ORDER_MESSAGES.ORDER_ALREADY_ASSIGNED);
    });

    it("rejects invalid status transition for user", async () => {
      mocks.findOrderById.mockResolvedValue({
        ...baseOrder,
        status: ORDER_STATUSES.CREATED,
      });

      await expect(
        orderTrackingLogService.create({
          orderId: "order-1",
          status: ORDER_STATUSES.DELIVERED,
          user: { role: "driver" },
        }),
      ).rejects.toThrow(
        ORDER_MESSAGES.INVALID_TRACKING_STATUS_TRANSITION(
          ORDER_STATUSES.CREATED,
          ORDER_STATUSES.DELIVERED,
        ),
      );
    });

    it("creates tracking log and updates order status successfully", async () => {
      mocks.findOrderById.mockResolvedValue({
        ...baseOrder,
        status: ORDER_STATUSES.DRIVER_ASSIGNED,
      });

      const result = await orderTrackingLogService.create({
        orderId: "order-1",
        status: ORDER_STATUSES.PICKUP_SCHEDULED,
        user: { role: "driver" },
        changedBy: "user-1",
      });

      expect(mocks.getUserById).toHaveBeenCalledWith("user-1");
      expect(mocks.createTrackingLog).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: "order-1",
          status: ORDER_STATUSES.PICKUP_SCHEDULED,
          changedBy: "user-1",
        }),
        session,
      );
      expect(mocks.updateOrderById).toHaveBeenCalled();
      expect(session.commitTransaction).toHaveBeenCalled();
      expect(result).toEqual({ _id: "log-1" });
    });

    it("rolls back transaction when update fails", async () => {
      mocks.findOrderById.mockResolvedValue({
        ...baseOrder,
        status: ORDER_STATUSES.DRIVER_ASSIGNED,
      });
      mocks.updateOrderById.mockResolvedValue(null);

      await expect(
        orderTrackingLogService.create({
          orderId: "order-1",
          status: ORDER_STATUSES.PICKUP_SCHEDULED,
          user: { role: "driver" },
        }),
      ).rejects.toThrow(ORDER_MESSAGES.ORDER_ASSIGNMENT_CHANGED);

      expect(session.abortTransaction).toHaveBeenCalled();
    });
  });

  describe("confirmPickup", () => {
    it("rejects when order has no trip or trip is not PICKUP type", async () => {
      mocks.findOrderById.mockResolvedValue({
        ...baseOrder,
        tripId: { _id: "trip-1", type: TRIP_TYPES.DELIVERY },
      });

      await expect(
        orderTrackingLogService.confirmPickup({
          orderId: "order-1",
          outcome: ORDER_STATUSES.PICKED_UP,
          user: { role: "driver" },
        }),
      ).rejects.toThrow(ORDER_MESSAGES.PICKUP_TRIP_REQUIRED);
    });

    it("rejects when trip is not in_progress", async () => {
      mocks.findOrderById.mockResolvedValue({
        ...baseOrder,
        tripId: {
          _id: "trip-1",
          type: TRIP_TYPES.PICKUP,
          status: TRIP_STATUSES.PLANNED,
        },
      });

      await expect(
        orderTrackingLogService.confirmPickup({
          orderId: "order-1",
          outcome: ORDER_STATUSES.PICKED_UP,
          user: { role: "driver" },
        }),
      ).rejects.toThrow(ORDER_MESSAGES.PICKUP_TRIP_NOT_IN_PROGRESS);
    });

    it("rejects when order status cannot be confirmed for pickup", async () => {
      mocks.findOrderById.mockResolvedValue({
        ...baseOrder,
        status: ORDER_STATUSES.STORED,
        tripId: {
          _id: "trip-1",
          type: TRIP_TYPES.PICKUP,
          status: TRIP_STATUSES.IN_PROGRESS,
        },
      });

      await expect(
        orderTrackingLogService.confirmPickup({
          orderId: "order-1",
          outcome: ORDER_STATUSES.PICKED_UP,
          user: { role: "driver" },
        }),
      ).rejects.toThrow(
        ORDER_MESSAGES.PICKUP_ORDER_STATUS_INVALID(ORDER_STATUSES.STORED),
      );
    });

    it("advances order to picked_up on successful outcome", async () => {
      mocks.findOrderById.mockResolvedValue({
        ...baseOrder,
        status: ORDER_STATUSES.DRIVER_ASSIGNED,
        tripId: {
          _id: "trip-1",
          type: TRIP_TYPES.PICKUP,
          status: TRIP_STATUSES.IN_PROGRESS,
        },
      });

      const result = await orderTrackingLogService.confirmPickup({
        orderId: "order-1",
        outcome: ORDER_STATUSES.PICKED_UP,
        notes: "All items intact",
        changedBy: "user-1",
        user: { role: "driver" },
      });

      expect(mocks.createTrackingLog).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: "order-1",
          status: ORDER_STATUSES.PICKED_UP,
          notes: "All items intact",
        }),
        session,
      );
      expect(result).toEqual({ _id: "log-1" });
    });
  });

  describe("getByOrderId", () => {
    it("returns paginated tracking logs", async () => {
      mocks.findByOrderId.mockResolvedValue([{ _id: "log-1" }]);
      mocks.countByOrderId.mockResolvedValue(1);

      const result = await orderTrackingLogService.getByOrderId({
        orderId: "order-1",
        page: 1,
        limit: 10,
      });

      expect(result).toEqual({
        data: [{ _id: "log-1" }],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      });
    });
  });

  describe("getLatestByOrderId", () => {
    it("throws 404 when tracking log is not found", async () => {
      mocks.getLatestByOrderId.mockResolvedValue(null);

      await expect(
        orderTrackingLogService.getLatestByOrderId({ orderId: "order-1" }),
      ).rejects.toThrow(ORDER_MESSAGES.TRACKING_NOT_FOUND);
    });

    it("returns latest tracking log when found", async () => {
      mocks.getLatestByOrderId.mockResolvedValue({ _id: "log-latest" });

      const result = await orderTrackingLogService.getLatestByOrderId({
        orderId: "order-1",
      });

      expect(result).toEqual({ _id: "log-latest" });
    });
  });

  describe("getPublicByCode", () => {
    it("returns public tracking info and logs", async () => {
      mocks.findOrderByCode.mockResolvedValue({
        _id: "order-1",
        orderCode: "ORD-0001",
        status: ORDER_STATUSES.DELIVERED,
        weight: 5,
        volume: 1000,
        type: "standard",
        deliveredAt: new Date("2026-11-20T10:00:00Z"),
        createdAt: new Date("2026-11-19T10:00:00Z"),
      });
      mocks.findPublicByOrderId.mockResolvedValue([
        { status: ORDER_STATUSES.CREATED, createdAt: new Date() },
      ]);

      const result = await orderTrackingLogService.getPublicByCode("ORD-0001");

      expect(result).toEqual({
        orderCode: "ORD-0001",
        status: ORDER_STATUSES.DELIVERED,
        weight: 5,
        volume: 1000,
        type: "standard",
        deliveredAt: new Date("2026-11-20T10:00:00Z"),
        createdAt: new Date("2026-11-19T10:00:00Z"),
        trackingLogs: [
          { status: ORDER_STATUSES.CREATED, createdAt: expect.any(Date) },
        ],
      });
    });
  });
});
