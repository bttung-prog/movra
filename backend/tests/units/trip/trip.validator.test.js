import { describe, expect, it } from "vitest";

import tripValidator from "../../../src/modules/trip/trip.validator.js";

const validTripPayload = {
  vehicleId: "507f1f77bcf86cd799439011",
  driverId: "507f1f77bcf86cd799439012",
  routeId: "507f1f77bcf86cd799439013",
  plannedStart: "2030-04-01T08:00:00.000Z",
  plannedEnd: "2030-04-01T12:00:00.000Z",
};

describe("tripValidator.createTripSchema", () => {
  it("accepts valid trip data and defaults the type", () => {
    const { error, value } =
      tripValidator.createTripSchema.validate(validTripPayload);

    expect(error).toBeUndefined();
    expect(value.type).toBe("delivery");
  });

  it("accepts pickup trips", () => {
    const result = tripValidator.createTripSchema.validate({
      ...validTripPayload,
      type: "pickup",
      routeId: undefined,
    });

    expect(result.error).toBeUndefined();
  });

  it.each([
    ["invalid vehicle ID", { vehicleId: "vehicle-1" }],
    ["unsupported trip type", { type: "express" }],
    ["end time before start time", { plannedEnd: "2030-04-01T07:00:00.000Z" }],
  ])("rejects %s", (_case, override) => {
    const result = tripValidator.createTripSchema.validate({
      ...validTripPayload,
      ...override,
    });

    expect(result.error).toBeDefined();
  });
});

describe("tripValidator.updateTripSchema", () => {
  it("requires at least one update field", () => {
    const result = tripValidator.updateTripSchema.validate({});

    expect(result.error).toBeDefined();
    expect(result.error.details[0].type).toBe("object.min");
  });

  it.each(["vehicleId", "driverId"])(
    "rejects %s because reassignment uses a dedicated endpoint",
    (field) => {
      const result = tripValidator.updateTripSchema.validate({
        [field]: "507f1f77bcf86cd799439011",
      });

      expect(result.error).toBeDefined();
    },
  );

  it("accepts an update to the planned schedule", () => {
    const result = tripValidator.updateTripSchema.validate({
      plannedEnd: "2030-04-01T13:00:00.000Z",
    });

    expect(result.error).toBeUndefined();
  });
});

describe("tripValidator.queryTripSchema", () => {
  it("applies pagination defaults", () => {
    const { error, value } = tripValidator.queryTripSchema.validate({});

    expect(error).toBeUndefined();
    expect(value).toMatchObject({ page: 1, limit: 10 });
  });

  it("rejects unknown status and an excessive page size", () => {
    expect(
      tripValidator.queryTripSchema.validate({ status: "finished" }).error,
    ).toBeDefined();
    expect(
      tripValidator.queryTripSchema.validate({ limit: 101 }).error,
    ).toBeDefined();
  });
});

describe("tripValidator.reassignSchema", () => {
  it("requires a new driver or vehicle and a reason", () => {
    expect(
      tripValidator.reassignSchema.validate({ reason: "Driver change" }).error,
    ).toBeDefined();
    expect(
      tripValidator.reassignSchema.validate({
        newDriverId: "507f1f77bcf86cd799439012",
      }).error,
    ).toBeDefined();
  });

  it("accepts a valid reassignment request", () => {
    const result = tripValidator.reassignSchema.validate({
      newDriverId: "507f1f77bcf86cd799439012",
      reason: "Driver unavailable",
    });

    expect(result.error).toBeUndefined();
  });
});

describe("tripValidator tracking and expense schemas", () => {
  it("validates required tracking coordinates and status", () => {
    expect(
      tripValidator.createTrackingLogSchema.validate({
        status: "departed",
        latitude: 10,
        longitude: 106,
      }).error,
    ).toBeUndefined();

    expect(
      tripValidator.createTrackingLogSchema.validate({
        status: "unknown",
        latitude: 91,
        longitude: 181,
      }).error,
    ).toBeDefined();
  });

  it("accepts valid expense details and rejects non-positive amounts", () => {
    expect(
      tripValidator.createExpenseSchema.validate({
        expenseType: "fuel",
        expenseAmount: 50000,
      }).error,
    ).toBeUndefined();

    expect(
      tripValidator.createExpenseSchema.validate({
        expenseType: "fuel",
        expenseAmount: 0,
      }).error,
    ).toBeDefined();
  });

  it("requires at least one field when updating an expense", () => {
    const result = tripValidator.updateExpenseSchema.validate({});

    expect(result.error).toBeDefined();
    expect(result.error.details[0].type).toBe("object.min");
  });
});
