import { describe, expect, it } from "vitest";

import routeValidator from "../../../src/modules/route/route.validator.js";

describe("routeValidator.createSchema", () => {
  it("accepts valid route data", () => {
    const result = routeValidator.createSchema.validate({
      originWarehouseId: "507f1f77bcf86cd799439011",
      destinationWarehouseId: "507f1f77bcf86cd799439012",
      distance: 120,
      expectedDuration: 8,
    });

    expect(result.error).toBeUndefined();
    expect(result.value).toMatchObject({
      originWarehouseId: "507f1f77bcf86cd799439011",
      destinationWarehouseId: "507f1f77bcf86cd799439012",
      distance: 120,
      expectedDuration: 8,
    });
  });

  it("requires valid IDs and positive numbers", () => {
    expect(
      routeValidator.createSchema.validate({
        originWarehouseId: "invalid-id",
        destinationWarehouseId: "507f1f77bcf86cd799439012",
        distance: 120,
        expectedDuration: 8,
      }).error,
    ).toBeDefined();

    expect(
      routeValidator.createSchema.validate({
        originWarehouseId: "507f1f77bcf86cd799439011",
        destinationWarehouseId: "507f1f77bcf86cd799439012",
        distance: 0,
        expectedDuration: 8,
      }).error,
    ).toBeDefined();
  });
});

describe("routeValidator.updateSchema", () => {
  it("requires at least one updatable field", () => {
    const result = routeValidator.updateSchema.validate({});

    expect(result.error).toBeDefined();
    expect(result.error.details[0].type).toBe("object.min");
  });

  it("accepts valid partial updates", () => {
    const result = routeValidator.updateSchema.validate({
      distance: 150,
    });

    expect(result.error).toBeUndefined();
    expect(result.value).toMatchObject({ distance: 150 });
  });
});

describe("routeValidator.querySchema", () => {
  it("applies page defaults and accepts valid filters", () => {
    const defaultResult = routeValidator.querySchema.validate({});
    expect(defaultResult.error).toBeUndefined();
    expect(defaultResult.value).toMatchObject({});

    const validResult = routeValidator.querySchema.validate({
      page: 2,
      limit: 25,
      originWarehouseId: "507f1f77bcf86cd799439011",
    });
    expect(validResult.error).toBeUndefined();
  });

  it("rejects invalid filters", () => {
    expect(
      routeValidator.querySchema.validate({ page: 0 }).error,
    ).toBeDefined();
    expect(
      routeValidator.querySchema.validate({ limit: 101 }).error,
    ).toBeDefined();
    expect(
      routeValidator.querySchema.validate({
        originWarehouseId: "bad-id",
      }).error,
    ).toBeDefined();
  });
});

describe("routeValidator.paramSchema", () => {
  it("requires a valid Mongo ObjectId in routeId", () => {
    expect(
      routeValidator.paramSchema.validate({
        routeId: "507f1f77bcf86cd799439011",
      }).error,
    ).toBeUndefined();

    expect(
      routeValidator.paramSchema.validate({ routeId: "invalid-id" }).error,
    ).toBeDefined();
  });
});
