import { beforeEach, describe, expect, it, vi } from "vitest";

import { ORDER_STATUSES } from "../../../src/constants/orderStatuses.js";
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
  findLoadsByTripId: vi.fn(),
  findByIds: vi.fn(),
  findByTripId: vi.fn(),
  countByTripId: vi.fn(),
  countRouteMismatchesByTripId: vi.fn(),
  countUnfinishedOrdersByTrip: vi.fn(),
  findRawByFilter: vi.fn(),
  updateById: vi.fn(),
  updateMany: vi.fn(),
  bulkWrite: vi.fn(),
  createTrackingLog: vi.fn(),
  insertManyTrackingLogs: vi.fn(),
  getTripById: vi.fn(),
  getTripByIds: vi.fn(),
  assertTripAccess: vi.fn(),
  syncTotalOrder: vi.fn(),
  syncTotalOrders: vi.fn(),
  assertDriverAssignedToTrip: vi.fn(),
  assertOrderWarehouseAccess: vi.fn(),
}));

vi.mock("mongoose", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: { ...actual.default, startSession: mocks.startSession },
  };
});

vi.mock("../../../src/modules/order/order.repository.js", () => ({
  default: {
    findLoadsByTripId: mocks.findLoadsByTripId,
    findByIds: mocks.findByIds,
    findByTripId: mocks.findByTripId,
    countByTripId: mocks.countByTripId,
    countRouteMismatchesByTripId: mocks.countRouteMismatchesByTripId,
    countUnfinishedOrdersByTrip: mocks.countUnfinishedOrdersByTrip,
    findRawByFilter: mocks.findRawByFilter,
    updateById: mocks.updateById,
    updateMany: mocks.updateMany,
    bulkWrite: mocks.bulkWrite,
  },
}));

vi.mock("../../../src/modules/order/orderTrackingLog.repository.js", () => ({
  default: {
    create: mocks.createTrackingLog,
    insertMany: mocks.insertManyTrackingLogs,
  },
}));

vi.mock("../../../src/modules/order/order.access.js", () => ({
  default: {
    assertDriverAssignedToTrip: mocks.assertDriverAssignedToTrip,
    assertOrderWarehouseAccess: mocks.assertOrderWarehouseAccess,
  },
}));

vi.mock("../../../src/modules/trip/trip.service.js", () => ({
  default: {
    getById: mocks.getTripById,
    getByIds: mocks.getTripByIds,
    assertTripAccess: mocks.assertTripAccess,
    syncTotalOrder: mocks.syncTotalOrder,
    syncTotalOrders: mocks.syncTotalOrders,
  },
}));

import orderAssignmentService from "../../../src/modules/order/orderAssignment.service.js";

describe("orderAssignment.service", () => {
  const baseTrip = {
    _id: "trip-1",
    tripCode: "TRIP-001",
    status: TRIP_STATUSES.PLANNED,
    type: TRIP_TYPES.PICKUP,
    warehouseId: "wh-1",
    vehicleId: {
      _id: "veh-1",
      capacityWeight: 100,
      capacityVolume: 10,
    },
  };

  const baseOrder = {
    _id: "order-1",
    orderCode: "ORD-0001",
    status: ORDER_STATUSES.CREATED,
    weight: 10,
    volume: 500000,
    quantity: 1,
    tripId: null,
    warehouseId: "wh-1",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.startSession.mockResolvedValue(session);
    mocks.getTripById.mockResolvedValue({ ...baseTrip });
    mocks.findByIds.mockResolvedValue([{ ...baseOrder }]);
    mocks.updateMany.mockResolvedValue({ modifiedCount: 1 });
    mocks.updateById.mockResolvedValue({ ...baseOrder });
    mocks.bulkWrite.mockImplementation(async (operations = []) => ({
      matchedCount: operations.length,
      modifiedCount: operations.length,
    }));
    mocks.createTrackingLog.mockResolvedValue({ _id: "log-1" });
    mocks.insertManyTrackingLogs.mockResolvedValue([]);
    mocks.getTripByIds.mockResolvedValue([{ ...baseTrip }]);
    mocks.assertTripAccess.mockResolvedValue(undefined);
    mocks.syncTotalOrder.mockResolvedValue(undefined);
    mocks.syncTotalOrders.mockResolvedValue(undefined);
  });

  describe("getTripLoadMetrics", () => {
    it("returns zero metrics when tripId is empty", async () => {
      const result = await orderAssignmentService.getTripLoadMetrics(null);
      expect(result).toEqual({ totalWeight: 0, totalVolumeCm3: 0, count: 0 });
    });

    it("aggregates weight and volume excluding specified orders", async () => {
      mocks.findLoadsByTripId.mockResolvedValue([
        { _id: "o-1", weight: 5, volume: 100, quantity: 2 },
        { _id: "o-2", weight: 3, volume: 50, quantity: 1 },
      ]);

      const result = await orderAssignmentService.getTripLoadMetrics("trip-1", [
        "o-2",
      ]);

      expect(result).toEqual({
        totalWeight: 10,
        totalVolumeCm3: 200,
        count: 1,
      });
    });
  });

  describe("assertTripCapacity", () => {
    it("skips checks if vehicle has no capacity limit", async () => {
      await expect(
        orderAssignmentService.assertTripCapacity({ vehicleId: null }, [
          { weight: 9999 },
        ]),
      ).resolves.toBeUndefined();
    });

    it("throws 400 when weight exceeds vehicle capacity", async () => {
      mocks.findLoadsByTripId.mockResolvedValue([]);

      await expect(
        orderAssignmentService.assertTripCapacity(baseTrip, [{ weight: 150 }]),
      ).rejects.toThrow(ORDER_MESSAGES.EXCEED_VEHICLE_WEIGHT(150, 100));
    });

    it("throws 400 when volume exceeds vehicle capacity", async () => {
      mocks.findLoadsByTripId.mockResolvedValue([]);

      // 100 m3 = 100,000,000 cm3
      await expect(
        orderAssignmentService.assertTripCapacity(baseTrip, [
          { weight: 10, volume: 100000000 },
        ]),
      ).rejects.toThrow(ORDER_MESSAGES.EXCEED_VEHICLE_VOLUME(100, 10));
    });

    it("passes when within limits", async () => {
      mocks.findLoadsByTripId.mockResolvedValue([]);

      await expect(
        orderAssignmentService.assertTripCapacity(baseTrip, [
          { weight: 10, volume: 1000 },
        ]),
      ).resolves.toBeUndefined();
    });
  });

  describe("getByTripId", () => {
    it("returns paginated orders for a trip", async () => {
      mocks.findByTripId.mockResolvedValue([{ _id: "order-1" }]);
      mocks.countByTripId.mockResolvedValue(1);

      const result = await orderAssignmentService.getByTripId({
        tripId: "trip-1",
        page: 1,
        limit: 10,
      });

      expect(mocks.assertDriverAssignedToTrip).toHaveBeenCalled();
      expect(result).toEqual({
        data: [{ _id: "order-1" }],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      });
    });
  });

  describe("assignOrdersToTrip", () => {
    it("throws 400 if trip is not planned", async () => {
      mocks.getTripById.mockResolvedValue({
        ...baseTrip,
        status: TRIP_STATUSES.IN_PROGRESS,
      });

      await expect(
        orderAssignmentService.assignOrdersToTrip({
          tripId: "trip-1",
          orderIds: ["order-1"],
        }),
      ).rejects.toThrow(ORDER_MESSAGES.TRIP_NOT_PLANNED);
    });

    it("throws 404 if orders are not found", async () => {
      mocks.findByIds.mockResolvedValue([]);

      await expect(
        orderAssignmentService.assignOrdersToTrip({
          tripId: "trip-1",
          orderIds: ["order-1"],
        }),
      ).rejects.toThrow(ORDER_MESSAGES.ORDERS_NOT_FOUND);
    });

    it("throws 400 if order status is not assignable to trip type", async () => {
      mocks.findByIds.mockResolvedValue([
        { ...baseOrder, status: ORDER_STATUSES.DELIVERED },
      ]);

      await expect(
        orderAssignmentService.assignOrdersToTrip({
          tripId: "trip-1",
          orderIds: ["order-1"],
        }),
      ).rejects.toThrow(ORDER_MESSAGES.ORDER_TRIP_TYPE_MISMATCH);
    });

    it("throws 409 if order is already assigned to a different trip", async () => {
      mocks.findByIds.mockResolvedValue([
        { ...baseOrder, tripId: "trip-other" },
      ]);

      await expect(
        orderAssignmentService.assignOrdersToTrip({
          tripId: "trip-1",
          orderIds: ["order-1"],
        }),
      ).rejects.toThrow(ORDER_MESSAGES.ORDER_ALREADY_ASSIGNED);
    });

    it("successfully assigns orders to trip and records tracking log", async () => {
      mocks.findLoadsByTripId.mockResolvedValue([]);

      const result = await orderAssignmentService.assignOrdersToTrip({
        tripId: "trip-1",
        orderIds: ["order-1"],
      });

      expect(result).toEqual({ assignedCount: 1, tripId: "trip-1" });
      expect(mocks.updateMany).toHaveBeenCalled();
      expect(mocks.insertManyTrackingLogs).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            orderId: "order-1",
            tripId: "trip-1",
            status: ORDER_STATUSES.DRIVER_ASSIGNED,
          }),
        ],
        session,
      );
      expect(mocks.syncTotalOrder).toHaveBeenCalledWith("trip-1", session);
      expect(session.commitTransaction).toHaveBeenCalled();
    });

    it("batches tracking logs for multiple assigned orders", async () => {
      mocks.findLoadsByTripId.mockResolvedValue([]);
      mocks.findByIds.mockResolvedValue([
        { ...baseOrder, _id: "order-1" },
        { ...baseOrder, _id: "order-2" },
        { ...baseOrder, _id: "order-3" },
      ]);
      mocks.updateMany.mockResolvedValue({ modifiedCount: 3 });

      const result = await orderAssignmentService.assignOrdersToTrip({
        tripId: "trip-1",
        orderIds: ["order-1", "order-2", "order-3"],
      });

      expect(result).toEqual({ assignedCount: 3, tripId: "trip-1" });
      expect(mocks.insertManyTrackingLogs).toHaveBeenCalledTimes(1);
      const [logs] = mocks.insertManyTrackingLogs.mock.calls[0];
      expect(logs).toHaveLength(3);
    });
  });

  describe("unassignOrdersFromTrip", () => {
    it("throws 404 if orders not found", async () => {
      mocks.findByIds.mockResolvedValue([]);

      await expect(
        orderAssignmentService.unassignOrdersFromTrip({
          orderIds: ["order-1"],
        }),
      ).rejects.toThrow(ORDER_MESSAGES.ORDERS_NOT_FOUND);
    });

    it("throws 400 if order is not assigned to a trip", async () => {
      mocks.findByIds.mockResolvedValue([{ ...baseOrder, tripId: null }]);

      await expect(
        orderAssignmentService.unassignOrdersFromTrip({
          orderIds: ["order-1"],
        }),
      ).rejects.toThrow(ORDER_MESSAGES.ORDER_NOT_ASSIGNED);
    });

    it("throws 400 if trip is in progress and cannot be unassigned", async () => {
      mocks.findByIds.mockResolvedValue([
        { ...baseOrder, tripId: "trip-1", status: ORDER_STATUSES.PICKED_UP },
      ]);
      mocks.getTripByIds.mockResolvedValue([
        { ...baseTrip, status: TRIP_STATUSES.IN_PROGRESS },
      ]);

      await expect(
        orderAssignmentService.unassignOrdersFromTrip({
          orderIds: ["order-1"],
        }),
      ).rejects.toThrow(ORDER_MESSAGES.TRIP_NOT_PLANNED);
    });

    it("successfully unassigns orders from planned trip", async () => {
      mocks.findByIds.mockResolvedValue([
        {
          ...baseOrder,
          tripId: "trip-1",
          status: ORDER_STATUSES.DRIVER_ASSIGNED,
        },
      ]);

      const result = await orderAssignmentService.unassignOrdersFromTrip({
        orderIds: ["order-1"],
      });

      expect(result).toEqual({ unassignedCount: 1 });
      expect(mocks.getTripByIds).toHaveBeenCalledTimes(2);
      expect(mocks.assertTripAccess).toHaveBeenCalledTimes(2);
      expect(mocks.updateById).not.toHaveBeenCalled();

      const [bulkOps] = mocks.bulkWrite.mock.calls[0];
      expect(bulkOps).toHaveLength(1);
      expect(bulkOps[0].updateOne.filter).toEqual(
        expect.objectContaining({
          _id: "order-1",
          tripId: "trip-1",
          status: ORDER_STATUSES.DRIVER_ASSIGNED,
        }),
      );
      expect(bulkOps[0].updateOne.update.$set).toEqual(
        expect.objectContaining({
          tripId: null,
          status: ORDER_STATUSES.CREATED,
        }),
      );

      expect(mocks.syncTotalOrders).toHaveBeenCalledWith(["trip-1"], session);
      expect(session.commitTransaction).toHaveBeenCalled();
    });

    it("releases multiple orders in one batch write", async () => {
      mocks.findByIds.mockResolvedValue([
        {
          ...baseOrder,
          _id: "order-1",
          tripId: "trip-1",
          status: ORDER_STATUSES.DRIVER_ASSIGNED,
        },
        {
          ...baseOrder,
          _id: "order-2",
          tripId: "trip-1",
          status: ORDER_STATUSES.DRIVER_ASSIGNED,
        },
        {
          ...baseOrder,
          _id: "order-3",
          tripId: "trip-1",
          status: ORDER_STATUSES.PICKUP_SCHEDULED,
        },
      ]);

      const result = await orderAssignmentService.unassignOrdersFromTrip({
        orderIds: ["order-1", "order-2", "order-3"],
      });

      expect(result).toEqual({ unassignedCount: 3 });
      expect(mocks.getTripByIds).toHaveBeenCalledTimes(2);
      expect(mocks.assertTripAccess).toHaveBeenCalledTimes(2);

      const [bulkOps] = mocks.bulkWrite.mock.calls[0];
      expect(bulkOps).toHaveLength(3);
      expect(mocks.syncTotalOrders).toHaveBeenCalledTimes(1);
      expect(mocks.syncTotalOrders).toHaveBeenCalledWith(["trip-1"], session);
    });
  });

  describe("handleOrdersOnTripCompletion", () => {
    it("reverts failed pickup orders to created status", async () => {
      mocks.findRawByFilter.mockResolvedValue([
        { _id: "order-1", status: ORDER_STATUSES.FAILED },
      ]);

      await orderAssignmentService.handleOrdersOnTripCompletion(
        { _id: "trip-1", type: TRIP_TYPES.PICKUP },
        session,
      );

      expect(mocks.updateMany).toHaveBeenCalledWith(
        { _id: { $in: ["order-1"] }, tripId: "trip-1" },
        { tripId: null, status: ORDER_STATUSES.CREATED },
        session,
      );
      expect(mocks.insertManyTrackingLogs).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            orderId: "order-1",
            status: ORDER_STATUSES.CREATED,
          }),
        ],
        session,
      );
    });

    it("stores failed delivery orders back to warehouse as stored", async () => {
      mocks.findRawByFilter.mockResolvedValue([
        { _id: "order-1", status: ORDER_STATUSES.FAILED },
      ]);

      await orderAssignmentService.handleOrdersOnTripCompletion(
        { _id: "trip-1", type: TRIP_TYPES.DELIVERY },
        session,
      );

      expect(mocks.updateMany).toHaveBeenCalledWith(
        { _id: { $in: ["order-1"] }, tripId: "trip-1" },
        { tripId: null, status: ORDER_STATUSES.STORED },
        session,
      );
      expect(mocks.insertManyTrackingLogs).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            orderId: "order-1",
            status: ORDER_STATUSES.STORED,
          }),
        ],
        session,
      );
    });

    it("groups delivery failures and writes tracking logs in one batch", async () => {
      mocks.findRawByFilter.mockResolvedValue([
        { _id: "order-1", status: ORDER_STATUSES.FAILED },
        { _id: "order-2", status: ORDER_STATUSES.RETURNED },
        { _id: "order-3", status: ORDER_STATUSES.FAILED },
      ]);

      await orderAssignmentService.handleOrdersOnTripCompletion(
        { _id: "trip-1", type: TRIP_TYPES.DELIVERY },
        session,
      );

      expect(mocks.updateMany).toHaveBeenCalledTimes(2);
      expect(mocks.updateMany).toHaveBeenCalledWith(
        { _id: { $in: ["order-1", "order-3"] }, tripId: "trip-1" },
        { tripId: null, status: ORDER_STATUSES.STORED },
        session,
      );
      expect(mocks.updateMany).toHaveBeenCalledWith(
        { _id: { $in: ["order-2"] }, tripId: "trip-1" },
        { tripId: null, status: ORDER_STATUSES.RETURNED },
        session,
      );

      const [logs] = mocks.insertManyTrackingLogs.mock.calls[0];
      expect(logs).toHaveLength(3);
    });
  });

  describe("handleOrdersOnTripCancellation", () => {
    it("removes orders from cancelled pickup trip and resets to created", async () => {
      mocks.findRawByFilter.mockResolvedValue([{ _id: "order-1" }]);

      await orderAssignmentService.handleOrdersOnTripCancellation(
        { _id: "trip-1", type: TRIP_TYPES.PICKUP },
        session,
      );

      expect(mocks.updateMany).toHaveBeenCalledWith(
        { _id: { $in: ["order-1"] }, tripId: "trip-1" },
        { tripId: null, status: ORDER_STATUSES.CREATED },
        session,
      );
      expect(mocks.insertManyTrackingLogs).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            orderId: "order-1",
            status: ORDER_STATUSES.CREATED,
          }),
        ],
        session,
      );
    });
  });
});
