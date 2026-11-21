import { beforeEach, describe, expect, it, vi } from "vitest";

const transaction = {
  commitTransaction: vi.fn(),
  abortTransaction: vi.fn(),
};

const mocks = vi.hoisted(() => ({
  startSession: vi.fn(),
  createTrackingLog: vi.fn(),
  findByTripId: vi.fn(),
  countByTripId: vi.fn(),
  getLatestByTripId: vi.fn(),
  findById: vi.fn(),
  findTripById: vi.fn(),
  updateTripById: vi.fn(),
  createAuditLog: vi.fn(),
  getDriverById: vi.fn(),
  ensureLicenseIsValid: vi.fn(),
  getVehicleById: vi.fn(),
  changeVehicleStatus: vi.fn(),
  createUsageLog: vi.fn(),
  updateUsageLogById: vi.fn(),
  getUsageLogsByTripId: vi.fn(),
  getUserById: vi.fn(),
  countUnfinishedOrdersByTrip: vi.fn(),
  handleOrdersOnTripCompletion: vi.fn(),
  handleOrdersOnTripCancellation: vi.fn(),
  assertTripWarehouseAccess: vi.fn(),
}));

vi.mock("mongoose", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: { ...actual.default, startSession: mocks.startSession },
  };
});

vi.mock("../../../src/modules/trip/tripTrackingLog.repository.js", () => ({
  default: {
    create: mocks.createTrackingLog,
    findByTripId: mocks.findByTripId,
    countByTripId: mocks.countByTripId,
    getLatestByTripId: mocks.getLatestByTripId,
    findById: mocks.findById,
  },
}));

vi.mock("../../../src/modules/trip/trip.repository.js", () => ({
  default: {
    findById: mocks.findTripById,
    updateById: mocks.updateTripById,
  },
}));

vi.mock("../../../src/modules/trip/tripAuditLog.repository.js", () => ({
  default: {
    create: mocks.createAuditLog,
  },
}));

vi.mock("../../../src/modules/trip/trip.access.js", () => ({
  default: {
    assertTripWarehouseAccess: mocks.assertTripWarehouseAccess,
    getActorId: (user) => user?.userId || user?._id || null,
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
    changeStatus: mocks.changeVehicleStatus,
  },
}));

vi.mock("../../../src/modules/vehicle/vehicleUsageLog.service.js", () => ({
  default: {
    getByTripId: mocks.getUsageLogsByTripId,
    create: mocks.createUsageLog,
    updateById: mocks.updateUsageLogById,
  },
}));

vi.mock("../../../src/modules/user/user.service.js", () => ({
  default: {
    getById: mocks.getUserById,
  },
}));

vi.mock("../../../src/modules/order/orderAssignment.service.js", () => ({
  default: {
    countUnfinishedOrdersByTrip: mocks.countUnfinishedOrdersByTrip,
    handleOrdersOnTripCompletion: mocks.handleOrdersOnTripCompletion,
    handleOrdersOnTripCancellation: mocks.handleOrdersOnTripCancellation,
  },
}));

import { ROLES } from "../../../src/constants/roles.js";
import { TRIP_MESSAGES } from "../../../src/constants/messages.js";
import tripTrackingLogService from "../../../src/modules/trip/tripTrackingLog.service.js";

const plannedTrip = {
  _id: "trip-1",
  tripCode: "TRIP-0001",
  vehicleId: "vehicle-1",
  driverId: { _id: "driver-1", warehouseId: "wh-1" },
  warehouseId: "wh-1",
  routeId: "route-1",
  status: "planned",
  plannedStart: new Date("2030-04-01T08:00:00.000Z"),
  plannedEnd: new Date("2030-04-01T12:00:00.000Z"),
  totalOrder: 0,
  deletedAt: null,
};

describe("tripTrackingLogService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.startSession.mockResolvedValue({
      startTransaction: vi.fn(),
      commitTransaction: transaction.commitTransaction,
      abortTransaction: transaction.abortTransaction,
      endSession: vi.fn(),
    });
    mocks.findTripById.mockResolvedValue(plannedTrip);
    mocks.assertTripWarehouseAccess.mockResolvedValue();
    mocks.getDriverById.mockResolvedValue({
      _id: "driver-1",
      userId: "user-driver-1",
      status: "active",
      licenseExpiryDate: new Date("2035-01-01"),
    });
    mocks.getVehicleById.mockResolvedValue({
      _id: "vehicle-1",
      status: "available",
      currentOdometer: 100,
    });
    mocks.getUsageLogsByTripId.mockResolvedValue([]);
    mocks.createUsageLog.mockResolvedValue({ _id: "usage-1" });
    mocks.updateTripById.mockResolvedValue(plannedTrip);
    mocks.createAuditLog.mockResolvedValue();
  });

  describe("addTrackingLog", () => {
    it("rejects tracking updates with status 'planned'", async () => {
      await expect(
        tripTrackingLogService.addTrackingLog("trip-1", { status: "planned" }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: TRIP_MESSAGES.CANNOT_LOG_PLANNED_STATUS,
      });
      expect(mocks.createTrackingLog).not.toHaveBeenCalled();
    });

    it("rejects tracking updates for a completed trip", async () => {
      mocks.findTripById.mockResolvedValue({
        ...plannedTrip,
        status: "completed",
      });

      await expect(
        tripTrackingLogService.addTrackingLog("trip-1", { status: "incident" }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: TRIP_MESSAGES.CANNOT_LOG_STATUS("completed"),
      });
      expect(mocks.createTrackingLog).not.toHaveBeenCalled();
    });

    it("rejects invalid tracking transition from planned to in_progress directly", async () => {
      await expect(
        tripTrackingLogService.addTrackingLog("trip-1", {
          status: "in_progress",
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: TRIP_MESSAGES.INVALID_TRACKING_STATUS_TRANSITION(
          "planned",
          "in_progress",
        ),
      });
      expect(mocks.createTrackingLog).not.toHaveBeenCalled();
    });

    it("rejects invalid backward tracking transition from in_progress to departed", async () => {
      mocks.findTripById.mockResolvedValue({
        ...plannedTrip,
        status: "in_progress",
      });
      mocks.getLatestByTripId.mockResolvedValue({
        status: "in_progress",
      });

      await expect(
        tripTrackingLogService.addTrackingLog("trip-1", { status: "departed" }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: TRIP_MESSAGES.INVALID_TRACKING_STATUS_TRANSITION(
          "in_progress",
          "departed",
        ),
      });
      expect(mocks.createTrackingLog).not.toHaveBeenCalled();
    });

    it("successfully logs departure and transitions planned trip to in_progress", async () => {
      mocks.findTripById.mockResolvedValue(plannedTrip);
      mocks.getLatestByTripId.mockResolvedValue(null);
      mocks.createTrackingLog.mockResolvedValue({
        _id: "log-1",
        status: "departed",
      });

      const result = await tripTrackingLogService.addTrackingLog("trip-1", {
        status: "departed",
        latitude: 10.762,
        longitude: 106.66,
        odometerReading: 120,
      });

      expect(result).toEqual({ _id: "log-1", status: "departed" });
      expect(mocks.createUsageLog).toHaveBeenCalled();
      expect(mocks.updateTripById).toHaveBeenCalledWith(
        "trip-1",
        expect.objectContaining({ status: "in_progress" }),
        expect.anything(),
      );
    });

    it("successfully logs intermediate tracking updates during in_progress trip", async () => {
      mocks.findTripById.mockResolvedValue({
        ...plannedTrip,
        status: "in_progress",
      });
      mocks.getLatestByTripId.mockResolvedValue({
        status: "departed",
      });
      mocks.createTrackingLog.mockResolvedValue({
        _id: "log-2",
        status: "in_progress",
      });

      const result = await tripTrackingLogService.addTrackingLog("trip-1", {
        status: "in_progress",
        latitude: 10.8,
        longitude: 106.7,
        speed: 45,
      });

      expect(result).toEqual({ _id: "log-2", status: "in_progress" });
      expect(mocks.updateTripById).not.toHaveBeenCalled();
    });

    it("rejects completion if trip has unfinished orders", async () => {
      mocks.findTripById.mockResolvedValue({
        ...plannedTrip,
        status: "in_progress",
      });
      mocks.getLatestByTripId.mockResolvedValue({
        status: "in_progress",
      });
      mocks.countUnfinishedOrdersByTrip.mockResolvedValue(2);

      await expect(
        tripTrackingLogService.addTrackingLog("trip-1", {
          status: "completed",
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: TRIP_MESSAGES.CANNOT_COMPLETE_ACTIVE_ORDERS(2),
      });

      expect(transaction.abortTransaction).toHaveBeenCalled();
    });

    it("completes trip successfully and reconciles orders when all orders are finished", async () => {
      mocks.findTripById.mockResolvedValue({
        ...plannedTrip,
        status: "in_progress",
      });
      mocks.getLatestByTripId.mockResolvedValue({
        status: "in_progress",
      });
      mocks.countUnfinishedOrdersByTrip.mockResolvedValue(0);
      mocks.getUsageLogsByTripId.mockResolvedValue([
        { _id: "usage-1", startOdo: 100, endOdo: null, notes: "departed" },
      ]);
      mocks.createTrackingLog.mockResolvedValue({
        _id: "log-complete",
        status: "completed",
      });

      const result = await tripTrackingLogService.addTrackingLog("trip-1", {
        status: "completed",
        odometerReading: 150,
      });

      expect(result).toEqual({ _id: "log-complete", status: "completed" });
      expect(mocks.handleOrdersOnTripCompletion).toHaveBeenCalled();
      expect(mocks.changeVehicleStatus).toHaveBeenCalledWith(
        "vehicle-1",
        "available",
        expect.anything(),
      );
      expect(mocks.updateTripById).toHaveBeenCalledWith(
        "trip-1",
        expect.objectContaining({ status: "completed" }),
        expect.anything(),
      );
    });

    it("cancels trip successfully and reconciles orders", async () => {
      mocks.findTripById.mockResolvedValue({
        ...plannedTrip,
        status: "in_progress",
      });
      mocks.getLatestByTripId.mockResolvedValue({
        status: "in_progress",
      });
      mocks.getUsageLogsByTripId.mockResolvedValue([
        { _id: "usage-1", startOdo: 100, endOdo: null, notes: "departed" },
      ]);
      mocks.createTrackingLog.mockResolvedValue({
        _id: "log-cancel",
        status: "cancelled",
      });

      const result = await tripTrackingLogService.addTrackingLog("trip-1", {
        status: "cancelled",
      });

      expect(result).toEqual({ _id: "log-cancel", status: "cancelled" });
      expect(mocks.handleOrdersOnTripCancellation).toHaveBeenCalled();
      expect(mocks.changeVehicleStatus).toHaveBeenCalledWith(
        "vehicle-1",
        "available",
        expect.anything(),
      );
      expect(mocks.updateTripById).toHaveBeenCalledWith(
        "trip-1",
        expect.objectContaining({ status: "cancelled" }),
        expect.anything(),
      );
    });
  });

  describe("getTrackingLogsByTripId", () => {
    it("returns paginated tracking logs", async () => {
      mocks.findByTripId.mockResolvedValue([{ status: "departed" }]);
      mocks.countByTripId.mockResolvedValue(1);

      const result = await tripTrackingLogService.getTrackingLogsByTripId(
        "trip-1",
        {
          page: 1,
          limit: 10,
        },
      );

      expect(result).toEqual({
        data: [{ status: "departed" }],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      });
    });
  });

  describe("getLatestTrackingLog", () => {
    it("throws 404 when tracking log not found", async () => {
      mocks.getLatestByTripId.mockResolvedValue(null);

      await expect(
        tripTrackingLogService.getLatestTrackingLog("trip-1"),
      ).rejects.toMatchObject({
        statusCode: 404,
        message: TRIP_MESSAGES.LOG_NOT_FOUND,
      });
    });

    it("returns latest tracking log when found", async () => {
      const log = { status: "in_progress", latitude: 10.5 };
      mocks.getLatestByTripId.mockResolvedValue(log);

      const result =
        await tripTrackingLogService.getLatestTrackingLog("trip-1");
      expect(result).toEqual(log);
    });
  });
});
