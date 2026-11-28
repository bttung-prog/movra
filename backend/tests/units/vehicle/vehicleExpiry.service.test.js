import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findExpiryCandidates: vi.fn(),
  findActiveAdmins: vi.fn(),
  notifyVehicleDocumentExpiry: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("../../../src/modules/vehicle/vehicle.repository.js", () => ({
  default: { findExpiryCandidates: mocks.findExpiryCandidates },
}));

vi.mock("../../../src/modules/user/user.repository.js", () => ({
  default: { findActiveUserIdsByRole: mocks.findActiveAdmins },
}));

vi.mock("../../../src/modules/vehicle/vehicleNotification.service.js", () => ({
  default: { notifyVehicleDocumentExpiry: mocks.notifyVehicleDocumentExpiry },
}));

vi.mock("../../../src/configs/logger.js", () => ({
  default: { error: mocks.loggerError },
}));

import { buildVehicleExpiryPhases } from "../../../src/modules/vehicle/vehicleExpiry.service.js";
import vehicleExpiryService from "../../../src/modules/vehicle/vehicleExpiry.service.js";

const now = new Date("2030-05-01T00:00:00.000Z");
const vehicle = {
  _id: "vehicle-1",
  plateNumber: "51A-12345",
  warehouseId: "warehouse-1",
  status: "available",
  registrationExpiryDate: new Date("2030-05-21T00:00:00.000Z"),
  insuranceExpiryDate: new Date("2030-05-06T00:00:00.000Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findExpiryCandidates.mockResolvedValue([]);
  mocks.findActiveAdmins.mockResolvedValue(["admin-1"]);
  mocks.notifyVehicleDocumentExpiry.mockResolvedValue(1);
});

describe("vehicleExpiryService.buildVehicleExpiryPhases", () => {
  it("returns separate registration and insurance phases", () => {
    const phases = buildVehicleExpiryPhases({ vehicle, now });

    expect(phases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          documentType: "registration",
          phase: "30d",
          daysRemaining: 20,
        }),
        expect.objectContaining({
          documentType: "insurance",
          phase: "7d",
          daysRemaining: 5,
        }),
      ]),
    );
  });

  it("returns expired phase when the date has passed", () => {
    const phases = buildVehicleExpiryPhases({
      vehicle: {
        ...vehicle,
        registrationExpiryDate: new Date("2030-04-30T00:00:00.000Z"),
      },
      now,
    });

    expect(phases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          documentType: "registration",
          phase: "expired",
        }),
      ]),
    );
  });
});

describe("vehicleExpiryService.processVehicleExpiryReminders", () => {
  it("sends each document phase to admins", async () => {
    mocks.findExpiryCandidates.mockResolvedValue([vehicle]);

    const result = await vehicleExpiryService.processVehicleExpiryReminders({
      now,
    });

    expect(mocks.findActiveAdmins).toHaveBeenCalledWith("admin");
    expect(mocks.notifyVehicleDocumentExpiry).toHaveBeenCalledTimes(2);
    expect(mocks.notifyVehicleDocumentExpiry).toHaveBeenCalledWith(
      expect.objectContaining({
        vehicle,
        documentType: "registration",
        phase: "30d",
        adminUserIds: ["admin-1"],
      }),
    );
    expect(result).toEqual({
      scannedCount: 1,
      notificationCount: 2,
      skippedCount: 0,
    });
  });

  it("skips retired vehicles but still notifies admins for an unassigned vehicle", async () => {
    mocks.findExpiryCandidates.mockResolvedValue([
      { ...vehicle, _id: "retired-1", status: "retired" },
      { ...vehicle, _id: "no-warehouse", warehouseId: null },
    ]);

    const result = await vehicleExpiryService.processVehicleExpiryReminders({
      now,
    });

    expect(mocks.notifyVehicleDocumentExpiry).toHaveBeenCalledTimes(2);
    expect(mocks.notifyVehicleDocumentExpiry).toHaveBeenCalledWith(
      expect.objectContaining({
        vehicle: expect.objectContaining({ _id: "no-warehouse" }),
      }),
    );
    expect(result).toEqual({
      scannedCount: 1,
      notificationCount: 2,
      skippedCount: 1,
    });
  });
});
