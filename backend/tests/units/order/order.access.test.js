import { beforeEach, describe, expect, it, vi } from "vitest";

import { ROLES } from "../../../src/constants/roles.js";
import {
  ORDER_MESSAGES,
  WAREHOUSE_MESSAGES,
} from "../../../src/constants/messages.js";

const mocks = vi.hoisted(() => ({
  getTripById: vi.fn(),
}));

vi.mock("../../../src/modules/trip/trip.service.js", () => ({
  default: {
    getById: mocks.getTripById,
  },
}));

import orderAccess from "../../../src/modules/order/order.access.js";

describe("orderAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getActorId", () => {
    it("returns userId if present", () => {
      expect(
        orderAccess.getActorId({ userId: "user-123", _id: "obj-123" }),
      ).toBe("user-123");
    });

    it("returns _id if userId not present", () => {
      expect(orderAccess.getActorId({ _id: "obj-123" })).toBe("obj-123");
    });

    it("returns null if user is undefined", () => {
      expect(orderAccess.getActorId(null)).toBeNull();
    });
  });

  describe("validateOrder", () => {
    it("throws 404 if order does not exist", () => {
      expect(() => orderAccess.validateOrder(null)).toThrow(
        ORDER_MESSAGES.NOT_FOUND,
      );
    });

    it("throws 400 if order is already deleted and requireNotDeleted is true", () => {
      expect(() =>
        orderAccess.validateOrder(
          { _id: "order-1", deletedAt: new Date() },
          true,
        ),
      ).toThrow(ORDER_MESSAGES.ALREADY_DELETED);
    });

    it("returns order if order is deleted but requireNotDeleted is false", () => {
      const order = { _id: "order-1", deletedAt: new Date() };
      expect(orderAccess.validateOrder(order, false)).toBe(order);
    });

    it("returns order if order is active", () => {
      const order = { _id: "order-1", deletedAt: null };
      expect(orderAccess.validateOrder(order, true)).toBe(order);
    });
  });

  describe("checkOrderOwnership", () => {
    it("allows non-customer role without checking customerId", () => {
      expect(() =>
        orderAccess.checkOrderOwnership(
          { customerId: "cust-1" },
          { role: ROLES.ADMIN },
        ),
      ).not.toThrow();
    });

    it("throws 403 if customerId does not match user.customerId", () => {
      expect(() =>
        orderAccess.checkOrderOwnership(
          { customerId: "cust-1" },
          { role: ROLES.CUSTOMER, customerId: "cust-2" },
        ),
      ).toThrow(ORDER_MESSAGES.ACCESS_DENIED);
    });

    it("allows customer when user.customerId matches order customerId", () => {
      expect(() =>
        orderAccess.checkOrderOwnership(
          { customerId: { _id: "cust-1" } },
          { role: ROLES.CUSTOMER, customerId: "cust-1" },
        ),
      ).not.toThrow();
    });
  });

  describe("assertDriverAssignedToTrip", () => {
    it("does nothing for non-driver roles", () => {
      expect(() =>
        orderAccess.assertDriverAssignedToTrip({}, { role: ROLES.DISPATCHER }),
      ).not.toThrow();
    });

    it("throws 403 if driver is not assigned to trip", () => {
      expect(() =>
        orderAccess.assertDriverAssignedToTrip(
          { driverId: "driver-1" },
          { role: ROLES.DRIVER, driverId: "driver-2" },
        ),
      ).toThrow(ORDER_MESSAGES.NOT_DRIVER_OF_TRIP);
    });

    it("passes when driver matches by driverId", () => {
      expect(() =>
        orderAccess.assertDriverAssignedToTrip(
          { driverId: { _id: "driver-1" } },
          { role: ROLES.DRIVER, driverId: "driver-1" },
        ),
      ).not.toThrow();
    });

    it("passes when driver matches by userId", () => {
      expect(() =>
        orderAccess.assertDriverAssignedToTrip(
          { driverId: { userId: "user-1" } },
          { role: ROLES.DRIVER, userId: "user-1" },
        ),
      ).not.toThrow();
    });
  });

  describe("assertOrderWarehouseAccess", () => {
    it("does nothing for non-driver and non-dispatcher roles", async () => {
      await expect(
        orderAccess.assertOrderWarehouseAccess({}, { role: ROLES.ADMIN }),
      ).resolves.toBeUndefined();
    });

    it("throws 403 for driver if order has no tripId", async () => {
      await expect(
        orderAccess.assertOrderWarehouseAccess({}, { role: ROLES.DRIVER }),
      ).rejects.toThrow(ORDER_MESSAGES.NOT_DRIVER_OF_TRIP);
    });

    it("verifies driver assigned trip by fetching trip when needed", async () => {
      mocks.getTripById.mockResolvedValue({
        _id: "trip-1",
        driverId: "driver-1",
      });

      await expect(
        orderAccess.assertOrderWarehouseAccess(
          { tripId: "trip-1" },
          { role: ROLES.DRIVER, driverId: "driver-1" },
        ),
      ).resolves.toBeUndefined();

      expect(mocks.getTripById).toHaveBeenCalledWith("trip-1", false, {
        role: ROLES.DRIVER,
        driverId: "driver-1",
      });
    });

    it("throws 403 for dispatcher when warehouse does not match origin or dest", async () => {
      await expect(
        orderAccess.assertOrderWarehouseAccess(
          { warehouseId: "wh-1", destinationWarehouseId: "wh-2" },
          { role: ROLES.DISPATCHER, warehouseId: "wh-3" },
        ),
      ).rejects.toThrow(WAREHOUSE_MESSAGES.ACCESS_DENIED);
    });

    it("allows dispatcher when warehouse matches origin", async () => {
      await expect(
        orderAccess.assertOrderWarehouseAccess(
          { warehouseId: "wh-1", destinationWarehouseId: "wh-2" },
          { role: ROLES.DISPATCHER, warehouseId: "wh-1" },
        ),
      ).resolves.toBeUndefined();
    });

    it("skips the trip lookup when a preloaded trip map is provided", async () => {
      const tripsById = new Map([
        ["trip-1", { _id: "trip-1", driverId: "driver-1" }],
      ]);

      await expect(
        orderAccess.assertOrderWarehouseAccess(
          { tripId: "trip-1", warehouseId: "wh-1" },
          { role: ROLES.DISPATCHER, warehouseId: "wh-1" },
          { tripsById },
        ),
      ).resolves.toBeUndefined();

      expect(mocks.getTripById).not.toHaveBeenCalled();
    });

    it("allows dispatcher when warehouse matches destination", async () => {
      await expect(
        orderAccess.assertOrderWarehouseAccess(
          { warehouseId: "wh-1", destinationWarehouseId: "wh-2" },
          { role: ROLES.DISPATCHER, warehouseId: "wh-2" },
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe("scopeOrderFilter", () => {
    it("returns cleanFilter unchanged if user is not dispatcher", async () => {
      const filter = { status: "pending", warehouseScope: "all" };
      const result = await orderAccess.scopeOrderFilter(filter, {
        role: ROLES.ADMIN,
      });
      expect(result).toEqual({ status: "pending" });
    });

    it("throws 403 if dispatcher has no warehouseId", async () => {
      await expect(
        orderAccess.scopeOrderFilter({}, { role: ROLES.DISPATCHER }),
      ).rejects.toThrow(WAREHOUSE_MESSAGES.DISPATCHER_NOT_ASSIGNED);
    });

    it("throws 403 if destinationWarehouseId mismatch", async () => {
      await expect(
        orderAccess.scopeOrderFilter(
          { destinationWarehouseId: "wh-2" },
          { role: ROLES.DISPATCHER, warehouseId: "wh-1" },
        ),
      ).rejects.toThrow(WAREHOUSE_MESSAGES.ACCESS_DENIED);
    });

    it("throws 403 if warehouseId mismatch", async () => {
      await expect(
        orderAccess.scopeOrderFilter(
          { warehouseId: "wh-2" },
          { role: ROLES.DISPATCHER, warehouseId: "wh-1" },
        ),
      ).rejects.toThrow(WAREHOUSE_MESSAGES.ACCESS_DENIED);
    });

    it("applies $or when warehouseScope is all", async () => {
      const result = await orderAccess.scopeOrderFilter(
        { warehouseScope: "all", status: "pending" },
        { role: ROLES.DISPATCHER, warehouseId: "wh-1" },
      );
      expect(result).toEqual({
        $and: [
          { status: "pending" },
          {
            $or: [{ warehouseId: "wh-1" }, { destinationWarehouseId: "wh-1" }],
          },
        ],
      });
    });

    it("applies destinationWarehouseId when warehouseScope is destination", async () => {
      const result = await orderAccess.scopeOrderFilter(
        { warehouseScope: "destination", status: "pending" },
        { role: ROLES.DISPATCHER, warehouseId: "wh-1" },
      );
      expect(result).toEqual({
        status: "pending",
        destinationWarehouseId: "wh-1",
      });
    });

    it("defaults to warehouseId when warehouseScope is not specified", async () => {
      const result = await orderAccess.scopeOrderFilter(
        { status: "pending" },
        { role: ROLES.DISPATCHER, warehouseId: "wh-1" },
      );
      expect(result).toEqual({
        status: "pending",
        warehouseId: "wh-1",
      });
    });
  });
});
