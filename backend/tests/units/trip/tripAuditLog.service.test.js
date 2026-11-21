import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findTripById: vi.fn(),
  assertTripWarehouseAccess: vi.fn(),
  findByTripId: vi.fn(),
  countByTripId: vi.fn(),
}));

vi.mock("../../../src/modules/trip/trip.repository.js", () => ({
  default: {
    findById: mocks.findTripById,
  },
}));

vi.mock("../../../src/modules/trip/trip.access.js", () => ({
  default: {
    assertTripWarehouseAccess: mocks.assertTripWarehouseAccess,
  },
}));

vi.mock("../../../src/modules/trip/tripAuditLog.repository.js", () => ({
  default: {
    findByTripId: mocks.findByTripId,
    countByTripId: mocks.countByTripId,
  },
}));

import { TRIP_MESSAGES } from "../../../src/constants/messages.js";
import tripAuditLogService from "../../../src/modules/trip/tripAuditLog.service.js";

const plannedTrip = {
  _id: "trip-1",
  warehouseId: "warehouse-1",
  deletedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findTripById.mockResolvedValue(plannedTrip);
  mocks.findByTripId.mockResolvedValue([{ action: "created" }]);
  mocks.countByTripId.mockResolvedValue(1);
  mocks.assertTripWarehouseAccess.mockResolvedValue(undefined);
});

describe("tripAuditLogService.getAuditLogsByTripId", () => {
  it("throws 404 when trip is not found", async () => {
    mocks.findTripById.mockResolvedValue(null);

    await expect(
      tripAuditLogService.getAuditLogsByTripId("missing-trip"),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: TRIP_MESSAGES.NOT_FOUND,
    });
  });

  it("checks warehouse access for current user", async () => {
    const user = { userId: "user-1", role: "dispatcher" };
    await tripAuditLogService.getAuditLogsByTripId("trip-1", {}, user);

    expect(mocks.assertTripWarehouseAccess).toHaveBeenCalledWith(
      plannedTrip,
      user,
    );
  });

  it("returns paginated audit logs with correct skip/limit", async () => {
    mocks.findByTripId.mockResolvedValue([
      { action: "updated" },
      { action: "status_changed" },
    ]);
    mocks.countByTripId.mockResolvedValue(25);

    const result = await tripAuditLogService.getAuditLogsByTripId("trip-1", {
      page: 2,
      limit: 10,
    });

    expect(mocks.findByTripId).toHaveBeenCalledWith("trip-1", {
      skip: 10,
      limit: 10,
    });
    expect(result).toEqual({
      data: [{ action: "updated" }, { action: "status_changed" }],
      pagination: {
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3,
      },
    });
  });

  it("accepts user inside the options object", async () => {
    const user = { userId: "user-2", role: "dispatcher" };
    await tripAuditLogService.getAuditLogsByTripId("trip-1", {
      page: 1,
      limit: 5,
      user,
    });

    expect(mocks.assertTripWarehouseAccess).toHaveBeenCalledWith(
      plannedTrip,
      user,
    );
  });
});
