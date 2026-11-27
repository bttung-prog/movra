import { beforeEach, describe, expect, it, vi } from "vitest";

const transaction = {
  startTransaction: vi.fn(),
  commitTransaction: vi.fn().mockResolvedValue(undefined),
  abortTransaction: vi.fn().mockResolvedValue(undefined),
  endSession: vi.fn(),
  withTransaction: vi.fn().mockImplementation((cb) => cb()),
};

const mocks = vi.hoisted(() => ({
  startSession: vi.fn(),
  createAssignment: vi.fn(),
  findByTripId: vi.fn(),
  countByTripId: vi.fn(),
  findAssignmentById: vi.fn(),
  findTripById: vi.fn(),
  updateTripById: vi.fn(),
  createAuditLog: vi.fn(),
  lockScheduleResources: vi.fn(),
  findOverlappingTrip: vi.fn(),
  assertTripWarehouseAccess: vi.fn(),
  validateRouteOriginWarehouse: vi.fn(),
  getDriverById: vi.fn(),
  ensureLicenseIsValid: vi.fn(),
  getVehicleById: vi.fn(),
  assignVehicleToWarehouse: vi.fn(),
  getUserById: vi.fn(),
  getRouteById: vi.fn(),
  notifyTripReassigned: vi.fn(),
}));

vi.mock("mongoose", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: { ...actual.default, startSession: mocks.startSession },
  };
});

vi.mock("../../../src/modules/trip/tripAssignment.repository.js", () => ({
  default: {
    create: mocks.createAssignment,
    findByTripId: mocks.findByTripId,
    countByTripId: mocks.countByTripId,
    findById: mocks.findAssignmentById,
  },
}));

vi.mock("../../../src/modules/trip/trip.repository.js", () => ({
  default: {
    findById: mocks.findTripById,
    updateById: mocks.updateTripById,
    lockScheduleResources: mocks.lockScheduleResources,
    findOverlappingTrip: mocks.findOverlappingTrip,
  },
}));

vi.mock("../../../src/modules/trip/tripAuditLog.repository.js", () => ({
  default: {
    create: mocks.createAuditLog,
  },
}));

vi.mock("../../../src/modules/trip/tripNotification.service.js", () => ({
  default: {
    notifyTripReassigned: mocks.notifyTripReassigned,
  },
}));

vi.mock("../../../src/modules/trip/trip.access.js", () => ({
  default: {
    assertTripWarehouseAccess: mocks.assertTripWarehouseAccess,
    validateRouteOriginWarehouse: mocks.validateRouteOriginWarehouse,
  },
}));

vi.mock("../../../src/modules/driver/driver.service.js", () => ({
  default: {
    getById: mocks.getDriverById,
    ensureLicenseIsValid: mocks.ensureLicenseIsValid,
  },
}));

vi.mock("../../../src/modules/vehicle/vehicle.service.js", () => ({
  default: {
    getById: mocks.getVehicleById,
    assignToWarehouse: mocks.assignVehicleToWarehouse,
  },
}));

vi.mock("../../../src/modules/user/user.service.js", () => ({
  default: {
    getById: mocks.getUserById,
  },
}));

vi.mock("../../../src/modules/route/route.service.js", () => ({
  default: {
    getById: mocks.getRouteById,
  },
}));

import { TRIP_MESSAGES } from "../../../src/constants/messages.js";
import { TRIP_STATUSES } from "../../../src/constants/tripStatuses.js";
import { USER_STATUSES } from "../../../src/constants/userStatuses.js";
import { VEHICLE_STATUSES } from "../../../src/constants/vehicleStatuses.js";
import tripAssignmentService from "../../../src/modules/trip/tripAssignment.service.js";

const warehouseId = "507f191e810c19729de860ea";
const driverId = "507f191e810c19729de860eb";
const newDriverId = "507f191e810c19729de860ec";
const vehicleId = "507f191e810c19729de860ed";
const newVehicleId = "507f191e810c19729de860ee";
const routeId = "507f191e810c19729de860ef";

const baseTrip = {
  _id: "trip-1",
  tripCode: "TRIP-0001",
  status: TRIP_STATUSES.PLANNED,
  deletedAt: null,
  driverId: { _id: driverId, warehouseId },
  vehicleId: { _id: vehicleId, warehouseId },
  routeId: { _id: routeId, originWarehouseId: warehouseId },
  warehouseId,
  plannedStart: new Date("2030-05-01T08:00:00.000Z"),
  plannedEnd: new Date("2030-05-01T12:00:00.000Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.startSession.mockResolvedValue(transaction);
  mocks.findTripById.mockResolvedValue(baseTrip);
  mocks.updateTripById.mockResolvedValue({
    ...baseTrip,
    driverId: newDriverId,
    vehicleId: newVehicleId,
  });
  mocks.createAssignment.mockResolvedValue({ _id: "assignment-1" });
  mocks.lockScheduleResources.mockResolvedValue(true);
  mocks.findOverlappingTrip.mockResolvedValue(null);
  mocks.getDriverById.mockResolvedValue({
    _id: newDriverId,
    status: USER_STATUSES.ACTIVE,
    warehouseId,
    licenseExpiryDate: new Date("2035-01-01"),
  });
  mocks.getVehicleById.mockResolvedValue({
    _id: newVehicleId,
    status: VEHICLE_STATUSES.AVAILABLE,
    warehouseId,
  });
  mocks.getRouteById.mockResolvedValue({
    _id: routeId,
    originWarehouseId: warehouseId,
  });
  mocks.getUserById.mockResolvedValue({
    _id: "user-1",
    status: USER_STATUSES.ACTIVE,
  });
});

describe("tripAssignmentService.reassign", () => {
  it("throws 404 if trip not found", async () => {
    mocks.findTripById.mockResolvedValue(null);

    await expect(
      tripAssignmentService.reassign("missing-trip", {
        newDriverId,
        reason: "Driver sick",
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: TRIP_MESSAGES.NOT_FOUND,
    });
  });

  it("throws 400 if trip is already deleted", async () => {
    mocks.findTripById.mockResolvedValue({
      ...baseTrip,
      deletedAt: new Date(),
    });

    await expect(
      tripAssignmentService.reassign("trip-1", {
        newDriverId,
        reason: "Driver sick",
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: TRIP_MESSAGES.ALREADY_DELETED,
    });
  });

  it("throws 400 if trip is COMPLETED or CANCELLED", async () => {
    mocks.findTripById.mockResolvedValue({
      ...baseTrip,
      status: TRIP_STATUSES.COMPLETED,
    });

    await expect(
      tripAssignmentService.reassign("trip-1", {
        newDriverId,
        reason: "Driver sick",
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: TRIP_MESSAGES.CANNOT_REASSIGN_STATUS(TRIP_STATUSES.COMPLETED),
    });
  });

  it("throws 400 if trip is IN_PROGRESS", async () => {
    mocks.findTripById.mockResolvedValue({
      ...baseTrip,
      status: TRIP_STATUSES.IN_PROGRESS,
    });

    await expect(
      tripAssignmentService.reassign("trip-1", {
        newDriverId,
        reason: "Driver sick",
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: TRIP_MESSAGES.CANNOT_REASSIGN_IN_PROGRESS,
    });
  });

  it("throws 400 if neither newDriverId nor newVehicleId is provided", async () => {
    await expect(
      tripAssignmentService.reassign("trip-1", {
        reason: "Driver sick",
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: TRIP_MESSAGES.REASSIGN_PARAMS_REQUIRED,
    });
  });

  it("throws 400 if new driver is not active", async () => {
    mocks.getDriverById.mockResolvedValue({
      _id: newDriverId,
      status: USER_STATUSES.INACTIVE,
      warehouseId,
      licenseExpiryDate: new Date("2035-01-01"),
    });

    await expect(
      tripAssignmentService.reassign("trip-1", {
        newDriverId,
        reason: "Driver change",
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: TRIP_MESSAGES.NEW_DRIVER_NOT_ACTIVE,
    });
  });

  it("throws 400 if new driver warehouse does not match trip warehouse", async () => {
    mocks.getDriverById.mockResolvedValue({
      _id: newDriverId,
      status: USER_STATUSES.ACTIVE,
      warehouseId: "other-warehouse",
      licenseExpiryDate: new Date("2035-01-01"),
    });

    await expect(
      tripAssignmentService.reassign("trip-1", {
        newDriverId,
        reason: "Driver change",
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: TRIP_MESSAGES.DRIVER_WAREHOUSE_MISMATCH,
    });
  });

  it("throws 400 if new vehicle warehouse does not match trip warehouse", async () => {
    mocks.getVehicleById.mockResolvedValue({
      _id: newVehicleId,
      status: VEHICLE_STATUSES.AVAILABLE,
      warehouseId: "other-warehouse",
    });

    await expect(
      tripAssignmentService.reassign("trip-1", {
        newVehicleId,
        reason: "Vehicle change",
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: TRIP_MESSAGES.VEHICLE_WAREHOUSE_MISMATCH,
    });
  });

  it("throws 400 if new vehicle is in MAINTENANCE", async () => {
    mocks.getVehicleById.mockResolvedValue({
      _id: newVehicleId,
      status: VEHICLE_STATUSES.MAINTENANCE,
      warehouseId,
    });

    await expect(
      tripAssignmentService.reassign("trip-1", {
        newVehicleId,
        reason: "Vehicle change",
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: TRIP_MESSAGES.NEW_VEHICLE_NOT_AVAILABLE(
        VEHICLE_STATUSES.MAINTENANCE,
      ),
    });
  });

  it("successfully reassigns driver and vehicle with transaction and audit log", async () => {
    const result = await tripAssignmentService.reassign(
      "trip-1",
      {
        newDriverId,
        newVehicleId,
        reason: "Optimization",
        changedBy: "user-1",
      },
      { userId: "user-1" },
    );

    expect(mocks.createAssignment).toHaveBeenCalledWith(
      expect.objectContaining({
        tripId: "trip-1",
        oldDriverId: driverId,
        newDriverId,
        oldVehicleId: vehicleId,
        newVehicleId,
        reason: "Optimization",
        changedBy: "user-1",
      }),
      transaction,
    );
    expect(mocks.updateTripById).toHaveBeenCalledWith(
      "trip-1",
      { driverId: newDriverId, vehicleId: newVehicleId },
      transaction,
    );
    expect(mocks.assignVehicleToWarehouse).toHaveBeenCalledWith(
      newVehicleId,
      warehouseId,
      transaction,
    );
    expect(mocks.createAuditLog).toHaveBeenCalled();
    expect(result).toHaveProperty("trip");
    expect(result).toHaveProperty("assignment");
  });
});

describe("tripAssignmentService.getAssignmentsByTripId", () => {
  it("returns paginated assignments for a trip", async () => {
    const assignments = [{ _id: "assignment-1" }, { _id: "assignment-2" }];
    mocks.findByTripId.mockResolvedValue(assignments);
    mocks.countByTripId.mockResolvedValue(2);

    const result = await tripAssignmentService.getAssignmentsByTripId(
      "trip-1",
      { page: 1, limit: 10 },
      { userId: "user-1" },
    );

    expect(mocks.findByTripId).toHaveBeenCalledWith("trip-1", {
      skip: 0,
      limit: 10,
    });
    expect(result).toEqual({
      data: assignments,
      pagination: {
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
      },
    });
  });
});
