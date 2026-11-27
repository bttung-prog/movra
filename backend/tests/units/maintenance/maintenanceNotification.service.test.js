import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findActiveDispatchers: vi.fn(),
  findActiveAccountants: vi.fn(),
  createManyNotifications: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("../../../src/modules/dispatcher/dispatcher.repository.js", () => ({
  default: {
    findActiveByWarehouseId: mocks.findActiveDispatchers,
  },
}));

vi.mock("../../../src/modules/accountant/accountant.repository.js", () => ({
  default: {
    findActiveUserIds: mocks.findActiveAccountants,
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

import { MAINTENANCE_NOTIFICATION_EVENTS } from "../../../src/constants/maintenanceNotification.js";
import maintenanceNotificationService from "../../../src/modules/maintenance/maintenanceNotification.service.js";

const vehicle = {
  _id: "vehicle-1",
  plateNumber: "51A-12345",
  warehouseId: "warehouse-1",
  currentOdometer: 10000,
  status: "available",
};
const schedule = {
  _id: "schedule-1",
  taskName: "Thay dầu",
  nextDueDate: new Date("2030-05-10T00:00:00.000Z"),
  nextDueKm: 10500,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findActiveDispatchers.mockResolvedValue([
    { userId: { _id: "dispatcher-user-1" } },
  ]);
  mocks.findActiveAccountants.mockResolvedValue(["accountant-user-1"]);
  mocks.createManyNotifications.mockResolvedValue([{ _id: "notification-1" }]);
});

describe("maintenanceNotificationService", () => {
  it("notifies warehouse dispatchers about a due date and not accountants", async () => {
    await maintenanceNotificationService.notifyMaintenanceScheduleDue({
      schedule,
      vehicle,
      phase: {
        key: "due_7d",
        event: MAINTENANCE_NOTIFICATION_EVENTS.MAINTENANCE_DUE_SOON,
      },
    });

    expect(mocks.findActiveDispatchers).toHaveBeenCalledWith("warehouse-1");
    expect(mocks.findActiveAccountants).not.toHaveBeenCalled();
    const dueDateKey = new Date("2030-05-10T00:00:00.000Z").getTime();
    const cycleKey = `date-${dueDateKey}`;
    expect(mocks.createManyNotifications).toHaveBeenCalledWith([
      expect.objectContaining({
        userId: "dispatcher-user-1",
        type: "MAINTENANCE",
        title: "Lịch bảo dưỡng sắp đến hạn",
        dedupeKey: `maintenance:schedule-1:due_7d:${cycleKey}:dispatcher-user-1`,
        data: expect.objectContaining({
          event: MAINTENANCE_NOTIFICATION_EVENTS.MAINTENANCE_DUE_SOON,
          eventKey: `maintenance:schedule-1:due_7d:${cycleKey}:dispatcher-user-1`,
          phase: "due_7d",
          vehicleId: "vehicle-1",
          scheduleId: "schedule-1",
          plateNumber: "51A-12345",
          taskName: "Thay dầu",
          dueKm: 10500,
          currentOdometer: 10000,
        }),
      }),
    ]);
  });

  it("uses a cycle-specific dedupe key for future maintenance cycles", async () => {
    const phase = {
      key: "due_7d",
      event: MAINTENANCE_NOTIFICATION_EVENTS.MAINTENANCE_DUE_SOON,
    };

    await maintenanceNotificationService.notifyMaintenanceScheduleDue({
      schedule,
      vehicle,
      phase,
    });
    await maintenanceNotificationService.notifyMaintenanceScheduleDue({
      schedule: {
        ...schedule,
        nextDueDate: new Date("2030-11-10T00:00:00.000Z"),
      },
      vehicle,
      phase,
    });

    const firstKey =
      mocks.createManyNotifications.mock.calls[0][0][0].dedupeKey;
    const secondKey =
      mocks.createManyNotifications.mock.calls[1][0][0].dedupeKey;
    expect(firstKey).not.toBe(secondKey);
  });

  it("notifies dispatchers and accountants when a log is completed", async () => {
    await maintenanceNotificationService.notifyMaintenanceCompleted({
      vehicle: { ...vehicle, status: "maintenance" },
      log: {
        _id: "log-1",
        status: "completed",
        cost: 500000,
      },
    });

    const notifications = mocks.createManyNotifications.mock.calls[0][0];
    expect(notifications).toHaveLength(2);
    expect(notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: "dispatcher-user-1",
          type: "MAINTENANCE",
          data: expect.objectContaining({
            event: MAINTENANCE_NOTIFICATION_EVENTS.MAINTENANCE_COMPLETED,
            maintenanceLogId: "log-1",
            cost: 500000,
          }),
        }),
        expect.objectContaining({
          userId: "accountant-user-1",
          type: "MAINTENANCE",
          data: expect.objectContaining({
            event: MAINTENANCE_NOTIFICATION_EVENTS.MAINTENANCE_COMPLETED,
            maintenanceLogId: "log-1",
          }),
        }),
      ]),
    );
  });

  it("warns dispatchers about planned trips when maintenance starts", async () => {
    await maintenanceNotificationService.notifyMaintenanceStarted({
      vehicle,
      activeTrips: [
        { _id: "trip-1", tripCode: "TRIP-0001", status: "planned" },
      ],
    });

    expect(mocks.createManyNotifications).toHaveBeenCalledWith([
      expect.objectContaining({
        userId: "dispatcher-user-1",
        type: "MAINTENANCE",
        title: expect.stringContaining("Cảnh báo"),
        message: expect.stringContaining("TRIP-0001"),
        data: expect.objectContaining({
          event: MAINTENANCE_NOTIFICATION_EVENTS.MAINTENANCE_STARTED,
          tripId: "trip-1",
        }),
      }),
    ]);
  });

  it("swallows notification persistence failures", async () => {
    mocks.createManyNotifications.mockRejectedValue(new Error("database down"));

    await expect(
      maintenanceNotificationService.notifyMaintenanceStarted({
        vehicle,
      }),
    ).resolves.toBe(0);
    expect(mocks.loggerError).toHaveBeenCalled();
  });
});
