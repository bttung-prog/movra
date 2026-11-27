import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findReminderCandidates: vi.fn(),
  notifyScheduleDue: vi.fn(),
}));

vi.mock(
  "../../../src/modules/maintenance/maintenanceSchedule.repository.js",
  () => ({
    default: {
      findReminderCandidates: mocks.findReminderCandidates,
    },
  }),
);

vi.mock(
  "../../../src/modules/maintenance/maintenanceNotification.service.js",
  () => ({
    default: {
      notifyMaintenanceScheduleDue: mocks.notifyScheduleDue,
    },
  }),
);

import { MAINTENANCE_NOTIFICATION_EVENTS } from "../../../src/constants/maintenanceNotification.js";
import { buildMaintenancePhases } from "../../../src/modules/maintenance/maintenanceReminder.service.js";
import maintenanceReminderService from "../../../src/modules/maintenance/maintenanceReminder.service.js";

const now = new Date("2030-05-01T00:00:00.000Z");
const vehicle = {
  _id: "vehicle-1",
  plateNumber: "51A-12345",
  currentOdometer: 10000,
  status: "available",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findReminderCandidates.mockResolvedValue([]);
  mocks.notifyScheduleDue.mockResolvedValue(1);
});

describe("maintenanceReminderService.buildMaintenancePhases", () => {
  it("returns due_7d for a schedule due within seven days", () => {
    const phases = buildMaintenancePhases({
      schedule: { nextDueDate: new Date("2030-05-08T00:00:00.000Z") },
      vehicle,
      now,
    });

    expect(phases).toEqual([
      {
        key: "due_7d",
        event: MAINTENANCE_NOTIFICATION_EVENTS.MAINTENANCE_DUE_SOON,
      },
    ]);
  });

  it("returns due_1d and overdue phases", () => {
    const dueTomorrow = buildMaintenancePhases({
      schedule: { nextDueDate: new Date("2030-05-02T00:00:00.000Z") },
      vehicle,
      now,
    });
    const overdue = buildMaintenancePhases({
      schedule: { nextDueDate: new Date("2030-04-30T00:00:00.000Z") },
      vehicle,
      now,
    });

    expect(dueTomorrow[0].key).toBe("due_1d");
    expect(overdue[0].key).toBe("overdue");
    expect(overdue[0].event).toBe(
      MAINTENANCE_NOTIFICATION_EVENTS.MAINTENANCE_OVERDUE,
    );
  });

  it("returns km phases based on the current odometer", () => {
    const dueKm = buildMaintenancePhases({
      schedule: { nextDueKm: 10500 },
      vehicle,
      now,
    });
    const overdueKm = buildMaintenancePhases({
      schedule: { nextDueKm: 9999 },
      vehicle,
      now,
    });

    expect(dueKm[0].key).toBe("due_km_500");
    expect(overdueKm[0].key).toBe("overdue_km");
  });
});

describe("maintenanceReminderService.processMaintenanceReminders", () => {
  it("sends each phase for active schedules", async () => {
    mocks.findReminderCandidates.mockResolvedValue([
      {
        _id: "schedule-1",
        taskName: "Thay dầu",
        nextDueDate: new Date("2030-05-08T00:00:00.000Z"),
        nextDueKm: 10500,
        vehicleId: vehicle,
      },
    ]);

    const result = await maintenanceReminderService.processMaintenanceReminders(
      { now },
    );

    expect(mocks.notifyScheduleDue).toHaveBeenCalledTimes(2);
    expect(mocks.notifyScheduleDue).toHaveBeenCalledWith(
      expect.objectContaining({
        schedule: expect.objectContaining({ _id: "schedule-1" }),
        vehicle,
        phase: expect.objectContaining({ key: "due_7d" }),
      }),
    );
    expect(mocks.notifyScheduleDue).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: expect.objectContaining({ key: "due_km_500" }),
      }),
    );
    expect(result).toEqual({
      scannedCount: 1,
      notificationCount: 2,
      skippedCount: 0,
    });
  });

  it("skips retired vehicles without sending notifications", async () => {
    mocks.findReminderCandidates.mockResolvedValue([
      {
        _id: "schedule-2",
        nextDueDate: new Date("2030-05-08T00:00:00.000Z"),
        vehicleId: { ...vehicle, status: "retired" },
      },
    ]);

    const result = await maintenanceReminderService.processMaintenanceReminders(
      { now },
    );

    expect(mocks.notifyScheduleDue).not.toHaveBeenCalled();
    expect(result).toEqual({
      scannedCount: 0,
      notificationCount: 0,
      skippedCount: 1,
    });
  });
});
