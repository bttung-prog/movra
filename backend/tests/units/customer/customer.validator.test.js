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
  it("accepts B2B company profile and credit updates", () => {
    const { error, value } = customerValidator.adminUpdateSchema.validate({
      companyName: "  Movra Logistics JSC ",
      taxCode: "0312345678-001",
      companyAddress: "12 Nguyen Hue",
      contactPerson: "Nguyen Van A",
      contactPhone: "0901234567",
      creditLimit: 50000000,
      defaultPaymentTerms: "net_30",
      contractDiscountRate: 7.5,
      totalSpent: 2500,
      lastPurchaseDate: "2026-01-01",
      creditNote: "Approved by CFO",
    });

    expect(error).toBeUndefined();
    expect(value.companyName).toBe("Movra Logistics JSC");
    expect(value.taxCode).toBe("0312345678-001");
    expect(value.defaultPaymentTerms).toBe("net_30");
    expect(value.creditLimit).toBe(50000000);
    expect(value.creditNote).toBe("Approved by CFO");
  });

  it("requires at least one field and rejects invalid values", () => {
    expect(
      customerValidator.adminUpdateSchema.validate({}).error?.details[0].type,
    ).toBe("object.min");

    for (const update of [
      { gender: "other" },
      { loyaltyPoints: 10 },
      { totalSpent: -1 },
      { creditLimit: -1 },
      { creditLimit: 1.5 },
      { defaultPaymentTerms: "net_60" },
      { contractDiscountRate: 101 },
      { taxCode: "123" },
      { contactPhone: "not-a-phone" },
      { creditNote: "N".repeat(501) },
      { lastPurchaseDate: "not-a-date" },
    ]) {
      expect(
        customerValidator.adminUpdateSchema.validate(update).error,
      ).toBeDefined();
    }
  });
});

describe("customerValidator.updateMyProfileSchema", () => {
  it("accepts partial B2B company profile updates", () => {
    const { error, value } = customerValidator.updateMyProfileSchema.validate({
      companyName: "  Movra Logistics JSC ",
      contactPerson: "Nguyen Van A",
    });

    expect(error).toBeUndefined();
    expect(value.companyName).toBe("Movra Logistics JSC");
    expect(value.contactPerson).toBe("Nguyen Van A");
  });

  it("rejects empty updates, deprecated fields, and credit fields set by customers", () => {
    expect(
      customerValidator.updateMyProfileSchema.validate({}).error?.details[0]
        .type,
    ).toBe("object.min");

    for (const update of [
      { gender: "male" },
      { creditLimit: 1000000 },
      { defaultPaymentTerms: "net_30" },
      { taxCode: "abc" },
      { companyName: "A" },
    ]) {
      expect(
        customerValidator.updateMyProfileSchema.validate(update).error,
      ).toBeDefined();
    }
  });
});

describe("customerValidator.creditHistoryQuerySchema", () => {
  it("applies pagination defaults and rejects invalid values", () => {
    const { error, value } =
      customerValidator.creditHistoryQuerySchema.validate({});

    expect(error).toBeUndefined();
    expect(value).toMatchObject({ page: 1, limit: 20 });

    for (const query of [{ page: 0 }, { limit: 0 }, { limit: 101 }]) {
      expect(
        customerValidator.creditHistoryQuerySchema.validate(query).error,
      ).toBeDefined();
    }
  });
});
