import { describe, expect, it } from "vitest";

import receiptValidator from "../../../src/modules/receipt/receipt.validator.js";

const orderId = "507f1f77bcf86cd799439011";
const warehouseId = "507f1f77bcf86cd799439012";
const goodsCategoryId = "507f1f77bcf86cd799439013";
const receiptId = "507f1f77bcf86cd799439014";

describe("receiptValidator.createReceiptSchema", () => {
  it("accepts a valid receipt and applies condition and location defaults", () => {
    const { error, value } = receiptValidator.createReceiptSchema.validate({
      orderId,
      warehouseId,
      quantity: 2,
    });

    expect(error).toBeUndefined();
    expect(value).toMatchObject({
      condition: "good",
      location: "RECEIVING_AREA",
      note: "",
    });
  });

  it("accepts optional references, supported conditions, and trims location", () => {
    const { error, value } = receiptValidator.createReceiptSchema.validate({
      orderId,
      warehouseId,
      goodsCategoryId,
      receivedBy: receiptId,
      quantity: 1,
      condition: "damaged",
      location: "  A-01 ",
      receivedAt: "2026-01-01T00:00:00.000Z",
      note: "Inspection",
    });

    expect(error).toBeUndefined();
    expect(value).toMatchObject({
      goodsCategoryId,
      receivedBy: receiptId,
      condition: "damaged",
      location: "A-01",
    });
  });

  it.each([
    ["invalid order ID", { orderId: "order-1" }],
    ["missing warehouse", { warehouseId: undefined }],
    ["invalid goods category ID", { goodsCategoryId: "category-1" }],
    ["fractional quantity", { quantity: 1.5 }],
    ["zero quantity", { quantity: 0 }],
    ["unsupported condition", { condition: "unknown" }],
    ["invalid received date", { receivedAt: "not-a-date" }],
    ["note over 500 characters", { note: "x".repeat(501) }],
  ])("rejects %s", (_case, override) => {
    expect(
      receiptValidator.createReceiptSchema.validate({
        orderId,
        warehouseId,
        quantity: 1,
        ...override,
      }).error,
    ).toBeDefined();
  });
});

describe("receiptValidator update schemas", () => {
  it("requires at least one valid update field", () => {
    expect(
      receiptValidator.updateReceiptSchema.validate({}).error?.details[0].type,
    ).toBe("object.min");
    expect(
      receiptValidator.updateReceiptSchema.validate({
        condition: "damaged",
        note: "Checked",
      }).error,
    ).toBeUndefined();
    expect(
      receiptValidator.updateReceiptSchema.validate({ status: "completed" })
        .error,
    ).toBeDefined();
  });

  it("accepts cancellation notes while enforcing their maximum length", () => {
    expect(
      receiptValidator.cancelReceiptSchema.validate({ note: "" }).error,
    ).toBeUndefined();
    expect(
      receiptValidator.cancelReceiptSchema.validate({
        note: "x".repeat(501),
      }).error,
    ).toBeDefined();
  });
});

describe("receiptValidator parameter and query schemas", () => {
  it("validates receipt, order, and code parameters", () => {
    expect(
      receiptValidator.paramReceiptIdSchema.validate({
        receiptId,
      }).error,
    ).toBeUndefined();
    expect(
      receiptValidator.paramOrderIdSchema.validate({ orderId }).error,
    ).toBeUndefined();
    expect(
      receiptValidator.paramReceiptCodeSchema.validate({
        receiptCode: " RC-0001 ",
      }).value.receiptCode,
    ).toBe("RC-0001");
    expect(
      receiptValidator.paramReceiptIdSchema.validate({
        receiptId: "receipt-1",
      }).error,
    ).toBeDefined();
    expect(
      receiptValidator.paramReceiptCodeSchema.validate({ receiptCode: " " })
        .error,
    ).toBeDefined();
  });

  it("accepts valid receipt filters and sorting options", () => {
    const { error, value } = receiptValidator.queryReceiptSchema.validate({
      page: 2,
      limit: 25,
      receiptCode: "  RC-1 ",
      warehouseId,
      orderId,
      goodsCategoryId,
      receivedBy: receiptId,
      status: "completed",
      condition: "good",
      fromDate: "2026-01-01",
      toDate: "2026-01-31",
      sortBy: "receivedAt",
      sortOrder: "asc",
    });

    expect(error).toBeUndefined();
    expect(value).toMatchObject({
      page: 2,
      limit: 25,
      receiptCode: "RC-1",
      status: "completed",
      sortBy: "receivedAt",
      sortOrder: "asc",
    });
  });

  it.each([
    ["fractional page", { page: 1.5 }],
    ["excessive limit", { limit: 101 }],
    ["invalid warehouse ID", { warehouseId: "warehouse-1" }],
    ["unsupported status", { status: "pending" }],
    ["unsupported condition", { condition: "unknown" }],
    ["unsupported sort field", { sortBy: "note" }],
    ["unsupported sort order", { sortOrder: "up" }],
    ["malformed date", { fromDate: "yesterday" }],
  ])("rejects %s", (_case, query) => {
    expect(
      receiptValidator.queryReceiptSchema.validate(query).error,
    ).toBeDefined();
  });
});
