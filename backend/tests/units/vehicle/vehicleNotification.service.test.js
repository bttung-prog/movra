import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createManyNotifications: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("../../../src/modules/notification/notification.service.js", () => ({
  default: { createMany: mocks.createManyNotifications },
}));

vi.mock("../../../src/configs/logger.js", () => ({
  default: { error: mocks.loggerError },
}));

import { VEHICLE_NOTIFICATION_EVENTS } from "../../../src/constants/vehicleNotification.js";
import vehicleNotificationService from "../../../src/modules/vehicle/vehicleNotification.service.js";

const vehicle = {
  _id: "vehicle-1",
  plateNumber: "51A-12345",
  vehicleTypeId: { name: "Xe tải" },
  warehouseId: "warehouse-1",
  status: "available",
};
const expiryDate = new Date("2030-05-10T00:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createManyNotifications.mockResolvedValue([{ _id: "notification-1" }]);
});

describe("vehicleNotificationService", () => {
  it("notifies admins about an expiring registration", async () => {
    await vehicleNotificationService.notifyVehicleDocumentExpiry({
      vehicle,
      documentType: "registration",
      expiryDate,
      phase: "30d",
      daysRemaining: 30,
      adminUserIds: ["admin-1"],
    });

    const notifications = mocks.createManyNotifications.mock.calls[0][0];
    expect(notifications).toHaveLength(1);
    expect(notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: "admin-1",
          type: "VEHICLE",
          title: "Đăng kiểm xe sắp hết hạn",
          data: expect.objectContaining({
            event: VEHICLE_NOTIFICATION_EVENTS.VEHICLE_REGISTRATION_EXPIRING,
            documentType: "registration",
            vehicleId: "vehicle-1",
            plateNumber: "51A-12345",
            vehicleType: "Xe tải",
            daysRemaining: 30,
            phase: "30d",
          }),
        }),
      ]),
    );
    expect(notifications[0].dedupeKey).toContain(
      "vehicle:vehicle-1:registration:30d:",
    );
  });

  it("uses an expired event and skips retired vehicles", async () => {
    await vehicleNotificationService.notifyVehicleDocumentExpiry({
      vehicle,
      documentType: "insurance",
      expiryDate,
      phase: "expired",
      adminUserIds: ["admin-1"],
    });
    await vehicleNotificationService.notifyVehicleDocumentExpiry({
      vehicle: { ...vehicle, status: "retired" },
      documentType: "registration",
      expiryDate,
      phase: "expired",
      adminUserIds: ["admin-1"],
    });

    expect(mocks.createManyNotifications).toHaveBeenCalledTimes(1);
    expect(mocks.createManyNotifications.mock.calls[0][0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            event: VEHICLE_NOTIFICATION_EVENTS.VEHICLE_INSURANCE_EXPIRED,
            documentType: "insurance",
          }),
        }),
      ]),
    );
  });

  it("swallows notification persistence failures", async () => {
    mocks.createManyNotifications.mockRejectedValue(new Error("database down"));

    await expect(
      vehicleNotificationService.notifyVehicleDocumentExpiry({
        vehicle,
        documentType: "registration",
        expiryDate,
        phase: "7d",
        adminUserIds: ["admin-1"],
      }),
    ).resolves.toBe(0);
    expect(mocks.loggerError).toHaveBeenCalled();
  });
});
