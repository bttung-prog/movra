import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSchedule: vi.fn(),
  findAllSchedules: vi.fn(),
  countAllSchedules: vi.fn(),
  findScheduleById: vi.fn(),
  findSchedulesByVehicleId: vi.fn(),
  countSchedulesByVehicleId: vi.fn(),
  getUpcomingMaintenances: vi.fn(),
  updateSchedule: vi.fn(),
  deleteSchedule: vi.fn(),
  restoreSchedule: vi.fn(),
  createLog: vi.fn(),
  findLogs: vi.fn(),
  countAllLogs: vi.fn(),
  findLogById: vi.fn(),
  findLatestLogByVehicle: vi.fn(),
  totalCost: vi.fn(),
  totalCostByVehicle: vi.fn(),
  getVehicleById: vi.fn(),
  getVehicleIdsByWarehouseId: vi.fn(),
  changeVehicleStatus: vi.fn(),
  updateOdometer: vi.fn(),
  getDriverByUserId: vi.fn(),
}));

vi.mock("../../../src/modules/maintenance/maintenance.repository.js", () => ({
  default: {
    createSchedule: mocks.createSchedule,
    findAllSchedules: mocks.findAllSchedules,
    countAllSchedules: mocks.countAllSchedules,
    findScheduleById: mocks.findScheduleById,
    findSchedulesByVehicleId: mocks.findSchedulesByVehicleId,
    countSchedulesByVehicleId: mocks.countSchedulesByVehicleId,
    getUpcomingMaintenances: mocks.getUpcomingMaintenances,
    updateSchedule: mocks.updateSchedule,
    deleteSchedule: mocks.deleteSchedule,
    restoreSchedule: mocks.restoreSchedule,
    createLog: mocks.createLog,
    findLogs: mocks.findLogs,
    countAllLogs: mocks.countAllLogs,
    findLogById: mocks.findLogById,
    findLatestLogByVehicle: mocks.findLatestLogByVehicle,
    totalCost: mocks.totalCost,
    totalCostByVehicle: mocks.totalCostByVehicle,
  },
}));

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

import {
  COMMON_MESSAGES,
  DRIVER_MESSAGES,
  MAINTENANCE_MESSAGES,
} from "../../../src/constants/messages.js";
import ROLES from "../../../src/constants/roles.js";
import {
  MAINTENANCE_STATUSES,
  MAINTENANCE_TYPES,
} from "../../../src/constants/maintenanceStatuses.js";
import maintenanceService from "../../../src/modules/maintenance/maintenance.service.js";

const vehicleId = "507f1f77bcf86cd799439011";
const scheduleId = "507f1f77bcf86cd799439012";
const logId = "507f1f77bcf86cd799439013";
const warehouseId = "warehouse-1";
const vehicle = {
  _id: vehicleId,
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
beforeEach(() => {
  vi.clearAllMocks();
  mocks.createSchedule.mockResolvedValue(schedule);
  mocks.findAllSchedules.mockResolvedValue([schedule]);
  mocks.countAllSchedules.mockResolvedValue(11);
  mocks.findScheduleById.mockResolvedValue(schedule);
  mocks.findSchedulesByVehicleId.mockResolvedValue([schedule]);
  mocks.countSchedulesByVehicleId.mockResolvedValue(1);
  mocks.getUpcomingMaintenances.mockResolvedValue([schedule]);
  mocks.updateSchedule.mockResolvedValue(schedule);
  mocks.deleteSchedule.mockResolvedValue({ ...schedule, isActive: false });
  mocks.restoreSchedule.mockResolvedValue(schedule);
  mocks.createLog.mockResolvedValue(log);
  mocks.findLogs.mockResolvedValue([log]);
  mocks.countAllLogs.mockResolvedValue(11);
  mocks.findLogById.mockResolvedValue(log);
  mocks.findLatestLogByVehicle.mockResolvedValue(log);
  mocks.totalCost.mockResolvedValue([{ totalCost: 1500 }]);
  mocks.totalCostByVehicle.mockResolvedValue([{ totalCost: 500 }]);
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
});

describe("maintenanceService.createSchedule", () => {
  it("calculates the next kilometer threshold from the current odometer", async () => {
    await maintenanceService.createSchedule({
      vehicleId,
      taskName: "Oil change",
      frequencyMonths: 0,
      frequencyKm: 5000,
    });

    expect(mocks.getVehicleById).toHaveBeenCalledWith(vehicleId, null);
    expect(mocks.createSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        vehicleId,
        taskName: "Oil change",
        frequencyMonths: 0,
        frequencyKm: 5000,
        nextDueDate: null,
        nextDueKm: 6000,
      }),
    );
  });

  it("rejects missing fields or zero frequency before creating a schedule", async () => {
    await expect(
      maintenanceService.createSchedule({
        vehicleId,
        taskName: "Oil change",
        frequencyMonths: 0,
        frequencyKm: 0,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: MAINTENANCE_MESSAGES.FREQUENCY_MUST_BE_GREATER_THAN_ZERO,
    });

    await expect(
      maintenanceService.createSchedule({
        vehicleId,
        taskName: "Oil change",
        frequencyMonths: null,
        frequencyKm: 5000,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: COMMON_MESSAGES.ALL_FIELDS_REQUIRED,
    });
    expect(mocks.createSchedule).not.toHaveBeenCalled();
  });
});

describe("maintenanceService schedule queries and updates", () => {
  it("paginates schedules and scopes dispatcher queries to warehouse vehicles", async () => {
    const result = await maintenanceService.getAllSchedules({
      filter: { isActive: true },
      page: 2,
      limit: 5,
      user: { role: ROLES.DISPATCHER, warehouseId },
    });

    const filter = {
      $and: [
        { deletedAt: null, isActive: true },
        { vehicleId: { $in: [vehicleId] } },
      ],
    };
    expect(mocks.getVehicleIdsByWarehouseId).toHaveBeenCalledWith(warehouseId);
    expect(mocks.findAllSchedules).toHaveBeenCalledWith({
      filter,
      skip: 5,
      limit: 5,
    });
    expect(mocks.countAllSchedules).toHaveBeenCalledWith(filter);
    expect(result.pagination).toEqual({
      page: 2,
      limit: 5,
      total: 11,
      totalPages: 3,
    });
  });

  it("rejects updates that disable both maintenance frequencies", async () => {
    await expect(
      maintenanceService.updateSchedule(scheduleId, {
        frequencyMonths: 0,
        frequencyKm: 0,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: MAINTENANCE_MESSAGES.FREQUENCY_MUST_BE_GREATER_THAN_ZERO,
    });
    expect(mocks.updateSchedule).not.toHaveBeenCalled();
  });

  it("restores only deleted schedules", async () => {
    mocks.findScheduleById.mockResolvedValueOnce({
      ...schedule,
      deletedAt: null,
    });
    await expect(
      maintenanceService.restoreSchedule(scheduleId),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: MAINTENANCE_MESSAGES.NOT_DELETED,
    });

    mocks.findScheduleById.mockResolvedValueOnce({
      ...schedule,
      deletedAt: new Date(),
    });
    await maintenanceService.restoreSchedule(scheduleId);
    expect(mocks.restoreSchedule).toHaveBeenCalledWith(scheduleId);
  });
});

describe("maintenanceService.createLog", () => {
  it("creates a scheduled log for a schedule belonging to the vehicle", async () => {
    await maintenanceService.createLog({
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
      maintenanceService.createLog({
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

    mocks.findScheduleById.mockResolvedValueOnce({
      ...schedule,
      vehicleId: "another-vehicle",
    });
    await expect(
      maintenanceService.createLog({
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
});

describe("maintenanceService log access and cost queries", () => {
  it("requires a log ID and returns a matching log", async () => {
    await expect(maintenanceService.getLogById(logId)).resolves.toBe(log);

    await expect(maintenanceService.getLogById(null)).rejects.toMatchObject({
      statusCode: 400,
      message: MAINTENANCE_MESSAGES.LOG_ID_REQUIRED,
    });
  });

  it("filters logs to a driver's assigned vehicle and calculates cost", async () => {
    const driver = { role: ROLES.DRIVER, userId: "driver-user" };
    const result = await maintenanceService.getLogs({
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
      maintenanceService.getTotalCost({
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

  it("rejects cost queries with missing dates or invalid vehicle IDs", async () => {
    await expect(
      maintenanceService.getTotalCost({ startDate: "2026-01-01" }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: MAINTENANCE_MESSAGES.DATE_RANGE_REQUIRED,
    });
    await expect(
      maintenanceService.getTotalCostByVehicle({
        vehicleId: "vehicle-1",
        startDate: "2026-01-01",
        endDate: "2026-01-31",
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: MAINTENANCE_MESSAGES.INVALID_VEHICLE_ID,
    });
  });
});

describe("maintenanceService.createLogEvent", () => {
  it("rejects invalid status transitions before starting a transaction", async () => {
    await expect(
      maintenanceService.createLogEvent(logId, {
        status: MAINTENANCE_STATUSES.SCHEDULED,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: MAINTENANCE_MESSAGES.INVALID_LOG_STATUS_TRANSITION,
    });
    expect(mocks.createLog).not.toHaveBeenCalled();
  });

  it("reports missing driver profiles and vehicle assignment mismatches", async () => {
    mocks.getDriverByUserId.mockResolvedValueOnce(null);
    await expect(
      maintenanceService.getScheduleById(scheduleId, true, {
        role: ROLES.DRIVER,
        userId: "driver-user",
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: DRIVER_MESSAGES.NOT_FOUND,
    });

    mocks.getDriverByUserId.mockResolvedValueOnce({
      currentVehicleId: "another-vehicle",
    });
    await expect(
      maintenanceService.getLogById(logId, {
        role: ROLES.DRIVER,
        userId: "driver-user",
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: MAINTENANCE_MESSAGES.UPDATE_LOG_OWN_VEHICLE_ONLY,
    });
  });
});
