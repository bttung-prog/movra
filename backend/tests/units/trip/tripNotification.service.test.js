import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createManyNotifications: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("../../../src/modules/notification/notification.service.js", () => ({
  default: {
    createMany: mocks.createManyNotifications,
  },
}));

vi.mock("../../../src/configs/logger.js", () => ({
  default: { error: mocks.loggerError },
}));

import tripNotificationService from "../../../src/modules/trip/tripNotification.service.js";

const trip = {
  _id: "trip-1",
  tripCode: "TRIP-0001",
  vehicleId: { _id: "vehicle-1" },
  plannedStart: new Date("2030-05-01T08:00:00.000Z"),
};

const oldDriver = {
  _id: "driver-1",
  userId: { _id: "driver-user-1" },
};

const newDriver = {
  _id: "driver-2",
  userId: { _id: "driver-user-2" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createManyNotifications.mockResolvedValue([]);
});

describe("tripNotificationService.notifyTripAssigned", () => {
  it("notifies the assigned driver", async () => {
    await tripNotificationService.notifyTripAssigned({
      trip,
      driver: oldDriver,
      orderCount: 3,
    });

    expect(mocks.createManyNotifications).toHaveBeenCalledWith([
      expect.objectContaining({
        userId: "driver-user-1",
        type: "TRIP_UPDATE",
        data: expect.objectContaining({
          tripId: "trip-1",
          tripCode: "TRIP-0001",
          vehicleId: "vehicle-1",
          driverId: "driver-1",
          orderCount: 3,
          action: "assigned",
          event: "TRIP_ASSIGNED",
        }),
      }),
    ]);
  });
});

describe("tripNotificationService.notifyTripReassigned", () => {
  it("notifies both old and new drivers in one batch", async () => {
    await tripNotificationService.notifyTripReassigned({
      trip,
      oldDriver,
      newDriver,
      orderCount: 2,
    });

    const notifications = mocks.createManyNotifications.mock.calls[0][0];
    expect(notifications).toHaveLength(2);
    expect(notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: "driver-user-1",
          data: expect.objectContaining({ action: "removed" }),
        }),
        expect.objectContaining({
          userId: "driver-user-2",
          data: expect.objectContaining({ action: "assigned" }),
        }),
      ]),
    );
  });

  it("notifies the current driver when only the vehicle changes", async () => {
    await tripNotificationService.notifyTripReassigned({
      trip,
      oldDriver,
      newDriver: oldDriver,
      vehicleChanged: true,
    });

    expect(mocks.createManyNotifications).toHaveBeenCalledWith([
      expect.objectContaining({
        userId: "driver-user-1",
        data: expect.objectContaining({ action: "vehicle_changed" }),
      }),
    ]);
  });
});

describe("tripNotificationService.notifyTripOrdersUpdated", () => {
  it("notifies the current driver about assigned orders", async () => {
    await tripNotificationService.notifyTripOrdersUpdated({
      trip,
      driver: oldDriver,
      orderCount: 2,
      action: "assigned",
    });

    expect(mocks.createManyNotifications).toHaveBeenCalledWith([
      expect.objectContaining({
        userId: "driver-user-1",
        data: expect.objectContaining({
          action: "assigned",
          orderCount: 2,
          event: "TRIP_ORDERS_UPDATED",
        }),
      }),
    ]);
  });
});

describe("tripNotificationService guards", () => {
  it("does not notify the actor driver", async () => {
    await tripNotificationService.notifyTripAssigned({
      trip,
      driver: oldDriver,
      actor: { userId: "driver-user-1" },
    });

    expect(mocks.createManyNotifications).not.toHaveBeenCalled();
  });

  it("swallows notification persistence failures", async () => {
    mocks.createManyNotifications.mockRejectedValue(new Error("database down"));

    await expect(
      tripNotificationService.notifyTripAssigned({
        trip,
        driver: oldDriver,
      }),
    ).resolves.toEqual([]);

    expect(mocks.loggerError).toHaveBeenCalled();
  });
});
