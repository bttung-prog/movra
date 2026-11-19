import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  startSession: vi.fn(),
  // vehicleUsageLogRepository
  logCreate: vi.fn(),
  logFind: vi.fn(),
  logCount: vi.fn(),
  logCountOpenByVehicleId: vi.fn(),
  logFindById: vi.fn(),
  logFindByVehicleId: vi.fn(),
  logCountByVehicleId: vi.fn(),
  logFindByDriverId: vi.fn(),
  logCountByDriverId: vi.fn(),
  logFindByTripId: vi.fn(),
  logAggregateStats: vi.fn(),
  logUpdateById: vi.fn(),
  logDeleteById: vi.fn(),
  logRestoreById: vi.fn(),
  // vehicleRepository
  vehicleRepoUpdateById: vi.fn(),
  // vehicleService
  vehicleGetById: vi.fn(),
  vehicleGetIdsByWarehouseId: vi.fn(),
  // driverService
  driverGetById: vi.fn(),
  driverGetByUserId: vi.fn(),
  driverGetIdsByWarehouseId: vi.fn(),
  // tripService
  tripGetById: vi.fn(),
  tripGetIdsByWarehouseId: vi.fn(),
}));

vi.mock("mongoose", () => ({
  default: {
    startSession: mocks.startSession,
  },
}));

vi.mock("../../../src/modules/vehicle/vehicleUsageLog.repository.js", () => ({
  default: {
    create: mocks.logCreate,
    find: mocks.logFind,
    count: mocks.logCount,
    countOpenByVehicleId: mocks.logCountOpenByVehicleId,
    findById: mocks.logFindById,
    findByVehicleId: mocks.logFindByVehicleId,
    countByVehicleId: mocks.logCountByVehicleId,
    findByDriverId: mocks.logFindByDriverId,
    countByDriverId: mocks.logCountByDriverId,
    findByTripId: mocks.logFindByTripId,
    aggregateStats: mocks.logAggregateStats,
    updateById: mocks.logUpdateById,
    deleteById: mocks.logDeleteById,
    restoreById: mocks.logRestoreById,
  },
}));

vi.mock("../../../src/modules/vehicle/vehicle.repository.js", () => ({
  default: {
    updateById: mocks.vehicleRepoUpdateById,
  },
}));

vi.mock("../../../src/modules/vehicle/vehicle.service.js", () => ({
  default: {
    getById: mocks.vehicleGetById,
    getIdsByWarehouseId: mocks.vehicleGetIdsByWarehouseId,
  },
}));

vi.mock("../../../src/modules/driver/driver.service.js", () => ({
  default: {
    getById: mocks.driverGetById,
    getByUserId: mocks.driverGetByUserId,
    getIdsByWarehouseId: mocks.driverGetIdsByWarehouseId,
  },
}));

vi.mock("../../../src/modules/trip/trip.service.js", () => ({
  default: {
    getById: mocks.tripGetById,
    getIdsByWarehouseId: mocks.tripGetIdsByWarehouseId,
  },
}));

import { VEHICLE_MESSAGES } from "../../../src/constants/messages.js";
import { VEHICLE_STATUSES } from "../../../src/constants/vehicleStatuses.js";
import { ROLES } from "../../../src/constants/roles.js";
import vehicleUsageLogService from "../../../src/modules/vehicle/vehicleUsageLog.service.js";

const vehicleId = "vehicle-1";
const driverId = "driver-1";
const tripId = "trip-1";
const logId = "log-1";
const warehouseId = "warehouse-1";

let mockSession;

beforeEach(() => {
  vi.clearAllMocks();

  mockSession = {
    startTransaction: vi.fn(),
    commitTransaction: vi.fn(),
    abortTransaction: vi.fn(),
    endSession: vi.fn(),
  };
  mocks.startSession.mockResolvedValue(mockSession);

  mocks.vehicleGetById.mockResolvedValue({
    _id: vehicleId,
    currentOdometer: 1000,
    status: VEHICLE_STATUSES.AVAILABLE,
    warehouseId,
  });

  mocks.driverGetById.mockResolvedValue({
    _id: driverId,
    warehouseId,
  });

  mocks.tripGetById.mockResolvedValue({
    _id: tripId,
    vehicleId: { _id: vehicleId },
    driverId: { _id: driverId },
  });

  mocks.logCountOpenByVehicleId.mockResolvedValue(0);

  mocks.logCreate.mockResolvedValue({
    _id: logId,
    vehicleId,
    driverId,
    tripId,
    startOdo: 1000,
  });

  mocks.logFindById.mockResolvedValue({
    _id: logId,
    vehicleId: { _id: vehicleId },
    driverId: { _id: driverId },
    tripId: { _id: tripId },
    startOdo: 1000,
    startTime: new Date("2025-01-01T08:00:00Z"),
    endOdo: null,
    endTime: null,
    deletedAt: null,
  });
});

describe("vehicleUsageLogService", () => {
  describe("create", () => {
    it("successfully creates usage log and sets vehicle status to in_use", async () => {
      const payload = {
        vehicleId,
        driverId,
        tripId,
        startOdo: 1050,
      };

      const result = await vehicleUsageLogService.create(payload);

      expect(result).toEqual({
        _id: logId,
        vehicleId,
        driverId,
        tripId,
        startOdo: 1000,
      });
      expect(mocks.logCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          vehicleId,
          driverId,
          tripId,
          startOdo: 1050,
        }),
        mockSession,
      );
      expect(mocks.vehicleRepoUpdateById).toHaveBeenCalledWith(
        vehicleId,
        { status: VEHICLE_STATUSES.IN_USE },
        mockSession,
      );
      expect(mockSession.commitTransaction).toHaveBeenCalled();
    });

    it("rejects when vehicle does not match trip vehicle", async () => {
      mocks.tripGetById.mockResolvedValue({
        _id: tripId,
        vehicleId: { _id: "other-vehicle" },
        driverId: { _id: driverId },
      });

      await expect(
        vehicleUsageLogService.create({
          vehicleId,
          driverId,
          tripId,
          startOdo: 1000,
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: VEHICLE_MESSAGES.VEHICLE_NOT_MATCH_TRIP,
      });
    });

    it("rejects when driver does not match trip driver", async () => {
      mocks.tripGetById.mockResolvedValue({
        _id: tripId,
        vehicleId: { _id: vehicleId },
        driverId: { _id: "other-driver" },
      });

      await expect(
        vehicleUsageLogService.create({
          vehicleId,
          driverId,
          tripId,
          startOdo: 1000,
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: VEHICLE_MESSAGES.DRIVER_NOT_MATCH_TRIP,
      });
    });

    it("rejects when vehicle is already in_use", async () => {
      mocks.vehicleGetById.mockResolvedValue({
        _id: vehicleId,
        status: VEHICLE_STATUSES.IN_USE,
        currentOdometer: 1000,
      });

      await expect(
        vehicleUsageLogService.create({
          vehicleId,
          driverId,
          tripId,
          startOdo: 1000,
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: VEHICLE_MESSAGES.VEHICLE_IN_USE,
      });
    });

    it("rejects when startOdo is less than vehicle current odometer", async () => {
      await expect(
        vehicleUsageLogService.create({
          vehicleId,
          driverId,
          tripId,
          startOdo: 900,
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
      });
    });
  });

  describe("checkOut", () => {
    it("successfully checks out log, updates vehicle odometer and sets status to available", async () => {
      mocks.logUpdateById.mockResolvedValue({
        _id: logId,
        endOdo: 1200,
      });

      const result = await vehicleUsageLogService.checkOut({
        logId,
        endOdo: 1200,
        endTime: new Date("2025-01-01T10:00:00Z"),
      });

      expect(result).toEqual({ _id: logId, endOdo: 1200 });
      expect(mocks.vehicleRepoUpdateById).toHaveBeenCalledWith(
        vehicleId,
        { $max: { currentOdometer: 1200 } },
        mockSession,
      );
      expect(mocks.vehicleRepoUpdateById).toHaveBeenCalledWith(
        vehicleId,
        { status: VEHICLE_STATUSES.AVAILABLE },
        mockSession,
      );
    });

    it("rejects when log is already checked out", async () => {
      mocks.logFindById.mockResolvedValue({
        _id: logId,
        startOdo: 1000,
        endOdo: 1100,
        deletedAt: null,
      });

      await expect(
        vehicleUsageLogService.checkOut({
          logId,
          endOdo: 1200,
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: VEHICLE_MESSAGES.LOG_ALREADY_CHECKED_OUT,
      });
    });

    it("rejects when endOdo is less than startOdo", async () => {
      await expect(
        vehicleUsageLogService.checkOut({
          logId,
          endOdo: 900,
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("rejects when driver attempts to check out another driver's log", async () => {
      mocks.driverGetByUserId.mockResolvedValue({
        _id: "other-driver-id",
      });

      await expect(
        vehicleUsageLogService.checkOut({
          logId,
          endOdo: 1200,
          user: { role: ROLES.DRIVER, _id: "user-driver-id" },
        }),
      ).rejects.toMatchObject({
        statusCode: 403,
        message: VEHICLE_MESSAGES.LOG_ACCESS_DENIED,
      });
    });
  });

  describe("getById", () => {
    it("returns log by id", async () => {
      const result = await vehicleUsageLogService.getById(logId);
      expect(result._id).toBe(logId);
      expect(mocks.logFindById).toHaveBeenCalledWith(logId);
    });

    it("throws 404 when log not found", async () => {
      mocks.logFindById.mockResolvedValue(null);

      await expect(
        vehicleUsageLogService.getById("non-existent"),
      ).rejects.toMatchObject({
        statusCode: 404,
        message: VEHICLE_MESSAGES.LOG_NOT_FOUND,
      });
    });
  });

  describe("deleteById", () => {
    it("deletes log when not already deleted", async () => {
      mocks.logDeleteById.mockResolvedValue({
        _id: logId,
        deletedAt: new Date(),
      });

      const result = await vehicleUsageLogService.deleteById(logId);
      expect(result).toBeDefined();
      expect(mocks.logDeleteById).toHaveBeenCalledWith(logId);
    });

    it("throws 404 when log is already deleted (filtered by getById)", async () => {
      mocks.logFindById.mockResolvedValue({
        _id: logId,
        deletedAt: new Date(),
      });

      await expect(
        vehicleUsageLogService.deleteById(logId),
      ).rejects.toMatchObject({
        statusCode: 404, // getById filters out deletedAt !== null with 404
      });
    });
  });
});
