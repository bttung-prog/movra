import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSchedule: vi.fn(),
  findSchedules: vi.fn(),
  countSchedules: vi.fn(),
  findScheduleById: vi.fn(),
  findSchedulesByVehicleId: vi.fn(),
  countSchedulesByVehicleId: vi.fn(),
  findUpcoming: vi.fn(),
  updateSchedule: vi.fn(),
  deleteSchedule: vi.fn(),
  restoreSchedule: vi.fn(),
  getVehicleById: vi.fn(),
  getVehicleIdsByWarehouseId: vi.fn(),
  getDriverByUserId: vi.fn(),
}));

vi.mock(
  "../../../src/modules/maintenance/maintenanceSchedule.repository.js",
  () => ({
    default: {
      create: mocks.createSchedule,
      find: mocks.findSchedules,
      count: mocks.countSchedules,
      findById: mocks.findScheduleById,
      findByVehicleId: mocks.findSchedulesByVehicleId,
      countByVehicleId: mocks.countSchedulesByVehicleId,
      findUpcoming: mocks.findUpcoming,
      updateById: mocks.updateSchedule,
      deleteById: mocks.deleteSchedule,
      restoreById: mocks.restoreSchedule,
    },
  }),
);

vi.mock("../../../src/modules/vehicle/vehicle.service.js", () => ({
  default: {
    getById: mocks.getVehicleById,
    getIdsByWarehouseId: mocks.getVehicleIdsByWarehouseId,
  },
}));

vi.mock("../../../src/modules/driver/driver.service.js", () => ({
  default: { getByUserId: mocks.getDriverByUserId },
}));

import { ApiError } from "../../../src/utils/ApiError.js";
import {
  DRIVER_MESSAGES,
  MAINTENANCE_MESSAGES,
} from "../../../src/constants/messages.js";
import { ROLES } from "../../../src/constants/roles.js";
import maintenanceScheduleService from "../../../src/modules/maintenance/maintenanceSchedule.service.js";

const vehicleId = "507f1f77bcf86cd799439011";
const scheduleId = "507f1f77bcf86cd799439012";
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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createSchedule.mockResolvedValue(schedule);
  mocks.findSchedules.mockResolvedValue([schedule]);
  mocks.countSchedules.mockResolvedValue(11);
  mocks.findScheduleById.mockResolvedValue(schedule);
  mocks.findSchedulesByVehicleId.mockResolvedValue([schedule]);
  mocks.countSchedulesByVehicleId.mockResolvedValue(1);
  mocks.findUpcoming.mockResolvedValue([schedule]);
  mocks.updateSchedule.mockResolvedValue(schedule);
  mocks.deleteSchedule.mockResolvedValue({ ...schedule, isActive: false });
  mocks.restoreSchedule.mockResolvedValue(schedule);
  mocks.getVehicleById.mockResolvedValue(vehicle);
  mocks.getVehicleIdsByWarehouseId.mockResolvedValue([vehicleId]);
  mocks.getDriverByUserId.mockResolvedValue({
    _id: "driver-1",
    currentVehicleId: vehicleId,
  });
});

describe("maintenanceScheduleService.create", () => {
  it("calculates the next kilometer threshold from the current odometer", async () => {
    await maintenanceScheduleService.create({
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

  it("rejects zero frequency before creating a schedule", async () => {
    await expect(
      maintenanceScheduleService.create({
        vehicleId,
        taskName: "Oil change",
        frequencyMonths: 0,
        frequencyKm: 0,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: MAINTENANCE_MESSAGES.FREQUENCY_MUST_BE_GREATER_THAN_ZERO,
    });
    expect(mocks.createSchedule).not.toHaveBeenCalled();
  });
});

describe("maintenanceScheduleService schedule queries and updates", () => {
  it("paginates schedules and scopes dispatcher queries to warehouse vehicles", async () => {
    const result = await maintenanceScheduleService.getAll({
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
    expect(mocks.findSchedules).toHaveBeenCalledWith({
      filter,
      skip: 5,
      limit: 5,
    });
    expect(mocks.countSchedules).toHaveBeenCalledWith(filter);
    expect(result.pagination).toEqual({
      page: 2,
      limit: 5,
      total: 11,
      totalPages: 3,
    });
  });

  it("rejects updates that disable both maintenance frequencies", async () => {
    await expect(
      maintenanceScheduleService.updateById(scheduleId, {
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
      maintenanceScheduleService.restoreById(scheduleId),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: MAINTENANCE_MESSAGES.NOT_DELETED,
    });

    mocks.findScheduleById.mockResolvedValueOnce({
      ...schedule,
      deletedAt: new Date(),
    });
    await maintenanceScheduleService.restoreById(scheduleId);
    expect(mocks.restoreSchedule).toHaveBeenCalledWith(scheduleId);
  });
});

describe("maintenanceScheduleService.getById access", () => {
  it("reports missing driver profiles", async () => {
    mocks.getDriverByUserId.mockRejectedValueOnce(
      new ApiError(404, DRIVER_MESSAGES.NOT_FOUND),
    );

    await expect(
      maintenanceScheduleService.getById(scheduleId, true, {
        role: ROLES.DRIVER,
        userId: "driver-user",
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: DRIVER_MESSAGES.NOT_FOUND,
    });
  });
});
