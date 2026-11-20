import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  startSession: vi.fn(),
  createLog: vi.fn(),
  findLogs: vi.fn(),
  countLogs: vi.fn(),
  findLogById: vi.fn(),
  findLatestByVehicle: vi.fn(),
  totalCost: vi.fn(),
  totalCostByVehicle: vi.fn(),
  getScheduleById: vi.fn(),
  processMaintenanceComplete: vi.fn(),
  getVehicleById: vi.fn(),
  getVehicleIdsByWarehouseId: vi.fn(),
  changeVehicleStatus: vi.fn(),
  updateOdometer: vi.fn(),
  getDriverByUserId: vi.fn(),
  tripFindActiveByVehicleId: vi.fn(),
  dispatcherGetActiveByWarehouseId: vi.fn(),
  notificationCreate: vi.fn(),
}));

vi.mock("mongoose", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: {
      ...actual.default,
      startSession: mocks.startSession,
    },
  };
});

vi.mock(
  "../../../src/modules/maintenance/maintenanceLog.repository.js",
  () => ({
    default: {
      create: mocks.createLog,
      findAll: mocks.findLogs,
      countAll: mocks.countLogs,
      findById: mocks.findLogById,
      findLatestByVehicle: mocks.findLatestByVehicle,
      totalCost: mocks.totalCost,
      totalCostByVehicle: mocks.totalCostByVehicle,
    },
  }),
);

vi.mock(
  "../../../src/modules/maintenance/maintenanceSchedule.service.js",
  () => ({
    default: {
      getById: mocks.getScheduleById,
      processMaintenanceComplete: mocks.processMaintenanceComplete,
    },
  }),
);

vi.mock("../../../src/modules/vehicle/vehicle.service.js", () => ({
  default: {
    getById: mocks.getVehicleById,
    getIdsByWarehouseId: mocks.getVehicleIdsByWarehouseId,
    changeStatus: mocks.changeVehicleStatus,
    updateOdometer: mocks.updateOdometer,
  },
}));

vi.mock("../../../src/modules/driver/driver.service.js", () => ({
  default: { getByUserId: mocks.getDriverByUserId },
}));

vi.mock("../../../src/modules/trip/trip.service.js", () => ({
  default: {
    findActiveByVehicleId: mocks.tripFindActiveByVehicleId,
  },
}));

vi.mock("../../../src/modules/dispatcher/dispatcher.service.js", () => ({
  default: {
    getActiveByWarehouseId: mocks.dispatcherGetActiveByWarehouseId,
  },
}));

vi.mock("../../../src/modules/notification/notification.service.js", () => ({
  default: {
    create: mocks.notificationCreate,
  },
}));

import { ApiError } from "../../../src/utils/ApiError.js";
import {
  DRIVER_MESSAGES,
  MAINTENANCE_MESSAGES,
} from "../../../src/constants/messages.js";
import { ROLES } from "../../../src/constants/roles.js";
import {
  MAINTENANCE_STATUSES,
  MAINTENANCE_TYPES,
} from "../../../src/constants/maintenanceStatuses.js";
import { VEHICLE_STATUSES } from "../../../src/constants/vehicleStatuses.js";
import maintenanceLogService from "../../../src/modules/maintenance/maintenanceLog.service.js";

const vehicleId = "507f1f77bcf86cd799439011";
const scheduleId = "507f1f77bcf86cd799439012";
const logId = "507f1f77bcf86cd799439013";
const warehouseId = "warehouse-1";
const vehicle = {
  _id: vehicleId,
  plateNumber: "29A-12345",
  warehouseId,
  currentOdometer: 1000,
  status: "available",
};
const schedule = {
  _id: scheduleId,
  vehicleId,
  taskName: "Oil change",
  frequencyMonths: 6,
  frequencyKm: 5000,
  lastServiceDate: null,
  lastServiceKm: null,
  deletedAt: null,
};
const log = {
  _id: logId,
  vehicleId,
  scheduleId,
  type: MAINTENANCE_TYPES.ROUTINE,
  description: "Oil change",
  cost: 500,
  startDate: new Date("2026-01-01T00:00:00.000Z"),
  endDate: null,
  odometerReading: 1200,
  status: MAINTENANCE_STATUSES.SCHEDULED,
};

const session = {
  startTransaction: vi.fn(),
  commitTransaction: vi.fn(),
  abortTransaction: vi.fn(),
  endSession: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.startSession.mockResolvedValue(session);
  mocks.createLog.mockResolvedValue(log);
  mocks.findLogs.mockResolvedValue([log]);
  mocks.countLogs.mockResolvedValue(11);
  mocks.findLogById.mockResolvedValue(log);
  mocks.findLatestByVehicle.mockResolvedValue(log);
  mocks.totalCost.mockResolvedValue([{ totalCost: 1500 }]);
  mocks.totalCostByVehicle.mockResolvedValue([{ totalCost: 500 }]);
  mocks.getScheduleById.mockResolvedValue(schedule);
  mocks.processMaintenanceComplete.mockResolvedValue(schedule);
  mocks.getVehicleById.mockResolvedValue(vehicle);
  mocks.getVehicleIdsByWarehouseId.mockResolvedValue([vehicleId]);
  mocks.changeVehicleStatus.mockResolvedValue({
    ...vehicle,
    status: "maintenance",
  });
  mocks.updateOdometer.mockResolvedValue({ ...vehicle, currentOdometer: 1200 });
  mocks.getDriverByUserId.mockResolvedValue({
    _id: "driver-1",
    currentVehicleId: vehicleId,
  });
  mocks.tripFindActiveByVehicleId.mockResolvedValue([]);
  mocks.dispatcherGetActiveByWarehouseId.mockResolvedValue([
    { _id: "dispatcher-1", userId: "user-disp-1" },
  ]);
  mocks.notificationCreate.mockResolvedValue({ _id: "notif-1" });
});

describe("maintenanceLogService.create", () => {
  it("creates a scheduled log for a schedule belonging to the vehicle", async () => {
    await maintenanceLogService.create({
      vehicleId,
      scheduleId,
      type: MAINTENANCE_TYPES.REPAIR,
      description: "  Replace belt ",
      cost: 250,
      odometerReading: 1200,
    });

    expect(mocks.createLog).toHaveBeenCalledWith(
      expect.objectContaining({
        vehicleId,
        scheduleId,
        type: MAINTENANCE_TYPES.REPAIR,
        description: "  Replace belt ",
        cost: 250,
        odometerReading: 1200,
        status: MAINTENANCE_STATUSES.SCHEDULED,
        startDate: expect.any(Date),
      }),
    );
  });

  it("rejects retired vehicles and schedules for another vehicle", async () => {
    mocks.getVehicleById.mockResolvedValueOnce({
      ...vehicle,
      status: "retired",
    });
    await expect(
      maintenanceLogService.create({
        vehicleId,
        scheduleId,
        type: MAINTENANCE_TYPES.REPAIR,
        description: "Repair",
        cost: 250,
        odometerReading: 1200,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: MAINTENANCE_MESSAGES.VEHICLE_RETIRED,
    });

    mocks.getScheduleById.mockResolvedValueOnce({
      ...schedule,
      vehicleId: "another-vehicle",
    });
    await expect(
      maintenanceLogService.create({
        vehicleId,
        scheduleId,
        type: MAINTENANCE_TYPES.REPAIR,
        description: "Repair",
        cost: 250,
        odometerReading: 1200,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: MAINTENANCE_MESSAGES.SCHEDULE_NOT_BELONG_TO_VEHICLE,
    });
    expect(mocks.createLog).not.toHaveBeenCalled();
  });

  it("rejects creating maintenance log for a vehicle currently running a trip", async () => {
    mocks.tripFindActiveByVehicleId.mockResolvedValueOnce([
      { _id: "trip-active-1", tripCode: "TRIP-001", status: "in_progress" },
    ]);

    await expect(
      maintenanceLogService.create({
        vehicleId,
        scheduleId,
        type: MAINTENANCE_TYPES.REPAIR,
        description: "Repair",
        cost: 250,
        odometerReading: 1200,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: MAINTENANCE_MESSAGES.VEHICLE_IN_USE,
    });
    expect(mocks.createLog).not.toHaveBeenCalled();
  });
});

describe("maintenanceLogService log access and cost queries", () => {
  it("returns a matching log by ID", async () => {
    await expect(maintenanceLogService.getById(logId)).resolves.toBe(log);
  });

  it("filters logs to a driver's assigned vehicle and calculates cost", async () => {
    const driver = { role: ROLES.DRIVER, userId: "driver-user" };
    const result = await maintenanceLogService.getAll({
      filter: { status: MAINTENANCE_STATUSES.COMPLETED },
      page: 2,
      limit: 5,
      user: driver,
    });

    const filter = {
      $and: [
        { status: MAINTENANCE_STATUSES.COMPLETED },
        { vehicleId: { $in: [vehicleId] } },
      ],
    };
    expect(mocks.getDriverByUserId).toHaveBeenCalledWith("driver-user");
    expect(mocks.findLogs).toHaveBeenCalledWith({
      filter,
      skip: 5,
      limit: 5,
    });
    expect(result.pagination).toEqual({
      page: 2,
      limit: 5,
      total: 11,
      totalPages: 3,
    });

    await expect(
      maintenanceLogService.getTotalCost({
        startDate: "2026-01-01",
        endDate: "2026-01-31",
        user: { role: ROLES.DISPATCHER, warehouseId },
      }),
    ).resolves.toEqual({ totalCost: 1500 });
    expect(mocks.totalCost).toHaveBeenCalledWith(
      new Date("2026-01-01"),
      new Date("2026-01-31"),
      [vehicleId],
    );
  });
});

describe("maintenanceLogService.createEvent", () => {
  it("rejects invalid status transitions before starting a transaction", async () => {
    await expect(
      maintenanceLogService.createEvent(logId, {
        status: MAINTENANCE_STATUSES.SCHEDULED,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: MAINTENANCE_MESSAGES.INVALID_LOG_STATUS_TRANSITION,
    });
    expect(mocks.createLog).not.toHaveBeenCalled();
  });

  it("reports missing driver profiles and vehicle assignment mismatches", async () => {
    mocks.getDriverByUserId.mockRejectedValueOnce(
      new ApiError(404, DRIVER_MESSAGES.NOT_FOUND),
    );
    await expect(
      maintenanceLogService.getById(logId, {
        role: ROLES.DRIVER,
        userId: "driver-user",
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: DRIVER_MESSAGES.NOT_FOUND,
    });

    mocks.getDriverByUserId.mockResolvedValueOnce({
      currentVehicleId: "another-vehicle",
    });
    await expect(
      maintenanceLogService.getById(logId, {
        role: ROLES.DRIVER,
        userId: "driver-user",
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: MAINTENANCE_MESSAGES.UPDATE_LOG_OWN_VEHICLE_ONLY,
    });
  });

  it("transitions to in_progress, changes vehicle status to maintenance and warns dispatchers of planned trips", async () => {
    mocks.tripFindActiveByVehicleId.mockResolvedValueOnce([
      { _id: "trip-2", tripCode: "TRIP-PLANNED-1", status: "planned" },
    ]);
    mocks.createLog.mockResolvedValueOnce({
      ...log,
      status: MAINTENANCE_STATUSES.IN_PROGRESS,
    });

    const result = await maintenanceLogService.createEvent(logId, {
      status: MAINTENANCE_STATUSES.IN_PROGRESS,
    });

    expect(mocks.changeVehicleStatus).toHaveBeenCalledWith(
      vehicleId,
      "maintenance",
      session,
    );
    expect(mocks.notificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-disp-1",
        title: expect.stringContaining("Cảnh báo"),
        message: expect.stringContaining("TRIP-PLANNED-1"),
        type: "SYSTEM",
      }),
    );
    expect(session.commitTransaction).toHaveBeenCalled();
    expect(result.status).toBe(MAINTENANCE_STATUSES.IN_PROGRESS);
  });

  it("rejects transition to in_progress if vehicle is in use or running a trip", async () => {
    mocks.tripFindActiveByVehicleId.mockResolvedValueOnce([
      { _id: "trip-1", tripCode: "TRIP-RUNNING-1", status: "in_progress" },
    ]);

    await expect(
      maintenanceLogService.createEvent(logId, {
        status: MAINTENANCE_STATUSES.IN_PROGRESS,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: MAINTENANCE_MESSAGES.VEHICLE_IN_USE,
    });

    expect(mocks.changeVehicleStatus).not.toHaveBeenCalled();
    expect(session.abortTransaction).toHaveBeenCalled();
  });

  it("syncs vehicle status back to available and notifies dispatchers upon completion", async () => {
    const inProgressLog = {
      ...log,
      status: MAINTENANCE_STATUSES.IN_PROGRESS,
    };
    mocks.findLogById.mockResolvedValueOnce(inProgressLog);
    mocks.findLatestByVehicle
      .mockResolvedValueOnce(inProgressLog)
      .mockResolvedValueOnce({
        ...log,
        status: MAINTENANCE_STATUSES.COMPLETED,
      });

    mocks.getVehicleById.mockResolvedValue({
      ...vehicle,
      status: VEHICLE_STATUSES.MAINTENANCE,
    });

    mocks.createLog.mockResolvedValueOnce({
      ...log,
      status: MAINTENANCE_STATUSES.COMPLETED,
      endDate: new Date(),
    });

    await maintenanceLogService.createEvent(logId, {
      status: MAINTENANCE_STATUSES.COMPLETED,
    });

    expect(mocks.changeVehicleStatus).toHaveBeenCalledWith(
      vehicleId,
      "available",
      session,
    );
    expect(mocks.notificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-disp-1",
        title: "Phương tiện hoàn tất bảo dưỡng",
        type: "SYSTEM",
      }),
    );
    expect(session.commitTransaction).toHaveBeenCalled();
  });
});
