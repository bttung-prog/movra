import { describe, expect, it } from "vitest";

import issueValidator from "../../../src/modules/issue/issue.validator.js";

const orderId = "507f1f77bcf86cd799439011";
const warehouseId = "507f1f77bcf86cd799439012";
const tripId = "507f1f77bcf86cd799439013";
const goodsCategoryId = "507f1f77bcf86cd799439014";

describe("issueValidator.createIssueSchema", () => {
  it("accepts valid issue data and applies note default", () => {
    const { error, value } = issueValidator.createIssueSchema.validate({
      orderId,
      warehouseId,
      tripId,
      quantity: 2,
    });

    expect(error).toBeUndefined();
    expect(value.note).toBe("");
  });

  it("accepts optional references and a note", () => {
    const { error, value } = issueValidator.createIssueSchema.validate({
      orderId,
      warehouseId,
      tripId,
      goodsCategoryId,
      issuedBy: goodsCategoryId,
      quantity: 2,
      note: "Delivery issue",
    });

    expect(error).toBeUndefined();
    expect(value).toMatchObject({ goodsCategoryId, issuedBy: goodsCategoryId });
  });

  it.each([
    ["invalid order ID", { orderId: "order-1" }],
    ["invalid warehouse ID", { warehouseId: "warehouse-1" }],
    ["invalid trip ID", { tripId: "trip-1" }],
    ["invalid category ID", { goodsCategoryId: "category-1" }],
    ["missing quantity", { quantity: undefined }],
    ["fractional quantity", { quantity: 1.5 }],
    ["zero quantity", { quantity: 0 }],
    ["note over 500 characters", { note: "x".repeat(501) }],
  ])("rejects %s", (_case, override) => {
    expect(
      issueValidator.createIssueSchema.validate({
        orderId,
        warehouseId,
        tripId,
        quantity: 2,
        ...override,
      }).error,
    ).toBeDefined();
  });
});

describe("issueValidator note and cancellation schemas", () => {
  it("requires an update note", () => {
    expect(
      issueValidator.updateNoteSchema.validate({ note: "Updated" }).error,
    ).toBeUndefined();
    expect(issueValidator.updateNoteSchema.validate({}).error).toBeDefined();
    expect(
      issueValidator.updateNoteSchema.validate({ note: "x".repeat(501) }).error,
    ).toBeDefined();
  });

  it("allows an optional cancellation note with a maximum length", () => {
    expect(issueValidator.cancelIssueSchema.validate({}).error).toBeUndefined();
    expect(
      issueValidator.cancelIssueSchema.validate({ note: "x".repeat(501) })
        .error,
    ).toBeDefined();
  });
});

describe("issueValidator parameter and query schemas", () => {
  it("validates issue, order, trip, and issue code parameters", () => {
    expect(
      issueValidator.paramIssueIdSchema.validate({
        issueId: goodsCategoryId,
      }).error,
    ).toBeUndefined();
    expect(
      issueValidator.paramOrderIdSchema.validate({ orderId }).error,
    ).toBeUndefined();
    expect(
      issueValidator.paramTripIdSchema.validate({ tripId }).error,
    ).toBeUndefined();
    expect(
      issueValidator.paramIssueCodeSchema.validate({
        issueCode: " IS-0001 ",
      }).value.issueCode,
    ).toBe("IS-0001");
    expect(
      issueValidator.paramIssueIdSchema.validate({ issueId: "bad-id" }).error,
    ).toBeDefined();
    expect(
      issueValidator.paramIssueCodeSchema.validate({ issueCode: " " }).error,
    ).toBeDefined();
  });

  it("validates trip issue pagination", () => {
    expect(
      issueValidator.queryTripIssueSchema.validate({ page: 2, limit: 20 })
        .error,
    ).toBeUndefined();
    expect(
      issueValidator.queryTripIssueSchema.validate({ limit: 101 }).error,
    ).toBeDefined();
  });

  it("accepts valid issue filters and sorting options", () => {
    const { error, value } = issueValidator.queryIssueSchema.validate({
      page: 2,
      limit: 20,
      issueCode: "  IS-1 ",
      warehouseId,
      orderId,
      goodsCategoryId,
      tripId,
      issuedBy: goodsCategoryId,
      status: "completed",
      fromDate: "2026-01-01",
      toDate: "2026-01-31",
      sortBy: "issuedAt",
      sortOrder: "desc",
    });

    expect(error).toBeUndefined();
    expect(value).toMatchObject({
      page: 2,
      limit: 20,
      issueCode: "IS-1",
      status: "completed",
      sortBy: "issuedAt",
      sortOrder: "desc",
    });
  });

  it.each([
    ["fractional page", { page: 1.5 }],
    ["excessive limit", { limit: 101 }],
    ["invalid warehouse ID", { warehouseId: "warehouse-1" }],
    ["invalid status", { status: "in_progress" }],
    ["invalid sort field", { sortBy: "note" }],
    ["invalid sort order", { sortOrder: "up" }],
    ["malformed date", { fromDate: "today" }],
  ])("rejects %s", (_case, query) => {
    expect(issueValidator.queryIssueSchema.validate(query).error).toBeDefined();
  });
});
