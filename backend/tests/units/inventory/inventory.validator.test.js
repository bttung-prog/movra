import { describe, expect, it } from "vitest";

import inventoryValidator from "../../../src/modules/inventory/inventory.validator.js";

describe("inventoryValidator.updateLocationSchema", () => {
  it("accepts and trims a non-empty location", () => {
    const { error, value } = inventoryValidator.updateLocationSchema.validate({
      location: "  A-01-02  ",
    });

    expect(error).toBeUndefined();
    expect(value.location).toBe("A-01-02");
  });

  it.each([
    ["missing location", {}],
    ["blank location", { location: "   " }],
    ["location over 100 characters", { location: "a".repeat(101) }],
  ])("rejects %s", (_case, payload) => {
    expect(
      inventoryValidator.updateLocationSchema.validate(payload).error,
    ).toBeDefined();
  });
});

describe("inventoryValidator.updateConditionSchema", () => {
  it.each(["good", "damaged"])("accepts condition %s", (condition) => {
    expect(
      inventoryValidator.updateConditionSchema.validate({ condition }).error,
    ).toBeUndefined();
  });

  it.each([{}, { condition: "poor" }])(
    "rejects invalid condition %#",
    (payload) => {
      expect(
        inventoryValidator.updateConditionSchema.validate(payload).error,
      ).toBeDefined();
    },
  );
});

describe("inventoryValidator ID parameter schemas", () => {
  it.each([
    ["inventoryId", inventoryValidator.inventoryIdParamSchema],
    ["orderId", inventoryValidator.orderIdParamSchema],
  ])("accepts a valid %s", (field, schema) => {
    expect(
      schema.validate({ [field]: "507f1f77bcf86cd799439011" }).error,
    ).toBeUndefined();
  });

  it.each([
    ["inventoryId", inventoryValidator.inventoryIdParamSchema],
    ["orderId", inventoryValidator.orderIdParamSchema],
  ])("rejects an invalid %s", (field, schema) => {
    expect(
      schema.validate({ [field]: "not-an-object-id" }).error,
    ).toBeDefined();
  });
});

describe("inventoryValidator.querySchema", () => {
  it("accepts valid filters and trims text search fields", () => {
    const { error, value } = inventoryValidator.querySchema.validate({
      page: 2,
      limit: 25,
      warehouseId: "507f1f77bcf86cd799439011",
      orderId: "507f1f77bcf86cd799439012",
      goodsCategoryId: "507f1f77bcf86cd799439013",
      status: "in_stock",
      condition: "damaged",
      location: "  A-01  ",
      search: "  fragile  ",
      sortBy: "quantity",
      sortOrder: "asc",
    });

    expect(error).toBeUndefined();
    expect(value).toMatchObject({ location: "A-01", search: "fragile" });
  });

  it.each([
    ["page below one", { page: 0 }],
    ["fractional page", { page: 1.5 }],
    ["limit below one", { limit: 0 }],
    ["limit above 100", { limit: 101 }],
    ["invalid warehouse ID", { warehouseId: "warehouse-1" }],
    ["invalid order ID", { orderId: "order-1" }],
    ["invalid goods category ID", { goodsCategoryId: "category-1" }],
    ["unsupported status", { status: "reserved" }],
    ["unsupported condition", { condition: "excellent" }],
    ["unsupported sort field", { sortBy: "warehouseId" }],
    ["unsupported sort order", { sortOrder: "ascending" }],
    ["search text over 100 characters", { search: "a".repeat(101) }],
  ])("rejects %s", (_case, query) => {
    expect(inventoryValidator.querySchema.validate(query).error).toBeDefined();
  });
});
