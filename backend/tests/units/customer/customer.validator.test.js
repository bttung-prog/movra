import { describe, expect, it } from "vitest";

import customerValidator from "../../../src/modules/customer/customer.validator.js";

const customerId = "507f1f77bcf86cd799439011";

describe("customerValidator.getAllSchema", () => {
  it("applies pagination defaults and trims search", () => {
    const { error, value } = customerValidator.getAllSchema.validate({
      search: "  Nguyen  ",
    });

    expect(error).toBeUndefined();
    expect(value).toMatchObject({ page: 1, limit: 10, search: "Nguyen" });
  });

  it.each([
    ["fractional page", { page: 1.5 }],
    ["zero page", { page: 0 }],
    ["zero limit", { limit: 0 }],
    ["limit over maximum", { limit: 101 }],
    ["non-string search", { search: 12 }],
  ])("rejects %s", (_case, query) => {
    expect(customerValidator.getAllSchema.validate(query).error).toBeDefined();
  });
});

describe("customerValidator.getByIdSchema", () => {
  it("accepts a valid customer ID and rejects missing or malformed IDs", () => {
    expect(
      customerValidator.getByIdSchema.validate({ customerId }).error,
    ).toBeUndefined();
    expect(
      customerValidator.getByIdSchema.validate({ customerId: "customer-1" })
        .error,
    ).toBeDefined();
    expect(customerValidator.getByIdSchema.validate({}).error).toBeDefined();
  });
});

describe("customerValidator.adminUpdateSchema", () => {
  it("accepts one or more valid admin updates", () => {
    const { error, value } = customerValidator.adminUpdateSchema.validate({
      gender: "other",
      totalSpent: 2500,
      loyaltyPoints: 12,
      lastPurchaseDate: "2026-01-01",
    });

    expect(error).toBeUndefined();
    expect(value.gender).toBe("other");
    expect(value.loyaltyPoints).toBe(12);
  });

  it("requires at least one field and rejects invalid values", () => {
    expect(
      customerValidator.adminUpdateSchema.validate({}).error?.details[0].type,
    ).toBe("object.min");

    for (const update of [
      { gender: "unknown" },
      { totalSpent: -1 },
      { loyaltyPoints: 1.5 },
      { loyaltyPoints: -1 },
      { lastPurchaseDate: "not-a-date" },
    ]) {
      expect(
        customerValidator.adminUpdateSchema.validate(update).error,
      ).toBeDefined();
    }
  });
});

describe("customerValidator.updateMyProfileSchema", () => {
  it("requires a supported gender", () => {
    for (const gender of ["male", "female", "other"]) {
      expect(
        customerValidator.updateMyProfileSchema.validate({ gender }).error,
      ).toBeUndefined();
    }

    expect(
      customerValidator.updateMyProfileSchema.validate({ gender: "unknown" })
        .error,
    ).toBeDefined();
    expect(
      customerValidator.updateMyProfileSchema.validate({}).error,
    ).toBeDefined();
  });
});
