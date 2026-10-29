import { describe, expect, it } from "vitest";

import {
  MAINTENANCE_STATUSES,
  MAINTENANCE_TYPES,
} from "../../../src/constants/maintenanceStatuses.js";
import maintenanceValidator from "../../../src/modules/maintenance/maintenance.validator.js";

const vehicleId = "507f1f77bcf86cd799439011";
const scheduleId = "507f1f77bcf86cd799439012";
const logId = "507f1f77bcf86cd799439013";

describe("maintenanceValidator schedule schemas", () => {
  it("accepts and trims a maintenance schedule", () => {
    const { error, value } = maintenanceValidator.createScheduleSchema.validate(
      {
        vehicleId,
        taskName: "  Oil change ",
        frequencyMonths: 6,
        frequencyKm: 10000,
      },
    );

    expect(error).toBeUndefined();
    expect(value.taskName).toBe("Oil change");
  });

  it.each([
    ["invalid vehicle ID", { vehicleId: "vehicle-1" }],
    ["missing task name", { taskName: undefined }],
    ["negative month frequency", { frequencyMonths: -1 }],
    ["negative distance frequency", { frequencyKm: -1 }],
  ])("rejects schedule with %s", (_case, override) => {
    expect(
      maintenanceValidator.createScheduleSchema.validate({
        vehicleId,
        taskName: "Oil change",
        frequencyMonths: 6,
        frequencyKm: 10000,
        ...override,
      }).error,
    ).toBeDefined();
  });

  it("requires at least one schedule update and validates optional fields", () => {
    expect(
      maintenanceValidator.updateScheduleSchema.validate({}).error?.details[0]
        .type,
    ).toBe("object.min");
    expect(
      maintenanceValidator.updateScheduleSchema.validate({
        taskName: "  Tire check  ",
        isActive: false,
      }).value,
    ).toMatchObject({ taskName: "Tire check", isActive: false });
    expect(
      maintenanceValidator.updateScheduleSchema.validate({
        frequencyKm: -1,
      }).error,
    ).toBeDefined();
  });
});

describe("maintenanceValidator maintenance log schemas", () => {
  const validLog = {
    vehicleId,
    scheduleId,
    type: MAINTENANCE_TYPES.ROUTINE,
    description: "  Scheduled service ",
    cost: 0,
    odometerReading: 1200,
    startDate: "2026-01-01",
    endDate: "2026-01-02",
  };

  it("accepts valid log data and defaults its status to scheduled", () => {
    const { error, value } =
      maintenanceValidator.createLogSchema.validate(validLog);

    expect(error).toBeUndefined();
    expect(value.description).toBe("Scheduled service");
    expect(value.status).toBe(MAINTENANCE_STATUSES.SCHEDULED);
  });

  it.each([
    ["invalid vehicle ID", { vehicleId: "vehicle-1" }],
    ["invalid schedule ID", { scheduleId: "schedule-1" }],
    ["unsupported maintenance type", { type: "unknown" }],
    ["negative cost", { cost: -1 }],
    ["negative odometer", { odometerReading: -1 }],
    ["end date before start date", { endDate: "2025-12-31" }],
  ])("rejects a log with %s", (_case, override) => {
    expect(
      maintenanceValidator.createLogSchema.validate({
        ...validLog,
        ...override,
      }).error,
    ).toBeDefined();
  });

  it("validates status events and non-negative optional values", () => {
    expect(
      maintenanceValidator.createLogEventSchema.validate({
        status: MAINTENANCE_STATUSES.IN_PROGRESS,
        cost: 250,
        odometerReading: 1200,
      }).error,
    ).toBeUndefined();
    expect(
      maintenanceValidator.createLogEventSchema.validate({
        status: "unknown",
      }).error,
    ).toBeDefined();
    expect(
      maintenanceValidator.createLogEventSchema.validate({
        status: MAINTENANCE_STATUSES.COMPLETED,
        cost: -1,
      }).error,
    ).toBeDefined();
  });
});

describe("maintenanceValidator date, pagination, and parameter schemas", () => {
  it("requires ordered date ranges", () => {
    expect(
      maintenanceValidator.getCostSchema.validate({
        startDate: "2026-01-01",
        endDate: "2026-01-31",
      }).error,
    ).toBeUndefined();
    expect(
      maintenanceValidator.getCostByVehicleSchema.validate({
        startDate: "2026-02-01",
        endDate: "2026-01-01",
      }).error,
    ).toBeDefined();
  });

  it("applies pagination defaults and validates schedule and log filters", () => {
    const schedules = maintenanceValidator.schedulePaginationSchema.validate({
      vehicleId,
      isActive: true,
    });
    expect(schedules.error).toBeUndefined();
    expect(schedules.value).toMatchObject({
      page: 1,
      limit: 10,
      isActive: true,
    });

    const logs = maintenanceValidator.logPaginationSchema.validate({
      status: MAINTENANCE_STATUSES.COMPLETED,
    });
    expect(logs.error).toBeUndefined();
    expect(logs.value).toMatchObject({ page: 1, limit: 10 });
    expect(
      maintenanceValidator.logPaginationSchema.validate({
        status: "unknown",
      }).error,
    ).toBeDefined();
    expect(
      maintenanceValidator.schedulePaginationSchema.validate({
        limit: 101,
      }).error,
    ).toBeDefined();
  });

  it("validates schedule, log, and vehicle route IDs", () => {
    expect(
      maintenanceValidator.scheduleIdParamSchema.validate({ scheduleId }).error,
    ).toBeUndefined();
    expect(
      maintenanceValidator.logIdParamSchema.validate({ logId }).error,
    ).toBeUndefined();
    expect(
      maintenanceValidator.vehicleIdParamSchema.validate({ vehicleId }).error,
    ).toBeUndefined();
    expect(
      maintenanceValidator.scheduleIdParamSchema.validate({
        scheduleId: "schedule-1",
      }).error,
    ).toBeDefined();
    expect(
      maintenanceValidator.logIdParamSchema.validate({}).error,
    ).toBeDefined();
  });
});
