import { describe, expect, it } from "vitest";

import staffValidator from "../../../src/modules/staff/staff.validator.js";

describe("staffValidator.createSchema", () => {
  it("accepts valid userId and warehouseId values", () => {
    const value = {
      userId: "507f1f77bcf86cd799439011",
      warehouseId: "507f1f77bcf86cd799439012",
    };

    const { error } = staffValidator.createSchema.validate(value);
    expect(error).toBeUndefined();
  });

  it("rejects invalid object IDs", () => {
    const result = staffValidator.createSchema.validate({
      userId: "invalid",
      warehouseId: "507f1f77bcf86cd799439012",
    });

    expect(result.error.message).toContain(
      "User ID must be a valid MongoDB ObjectId",
    );
  });

  it("requires userId and warehouseId", () => {
    const result = staffValidator.createSchema.validate({ userId: "" });
    expect(result.error.message).toContain("User ID cannot be empty");
    expect(result.error).toBeTruthy();
  });
});

describe("staffValidator.updateSchema", () => {
  it("accepts a valid status update", () => {
    const { error } = staffValidator.updateSchema.validate({
      status: "active",
    });
    expect(error).toBeUndefined();
  });

  it("rejects unsupported status values", () => {
    const result = staffValidator.updateSchema.validate({ status: "pending" });
    expect(result.error.message).toContain(
      "Status must be either 'active' or 'inactive'",
    );
  });

  it("requires at least one field", () => {
    const result = staffValidator.updateSchema.validate({});
    expect(result.error.message).toContain("");
  });
});

describe("staffValidator.transferWarehouseSchema", () => {
  it("accepts a valid warehouseId", () => {
    const { error } = staffValidator.transferWarehouseSchema.validate({
      warehouseId: "507f1f77bcf86cd799439012",
    });
    expect(error).toBeUndefined();
  });

  it("rejects invalid warehouseId format", () => {
    const result = staffValidator.transferWarehouseSchema.validate({
      warehouseId: "bad-id",
    });
    expect(result.error.message).toContain(
      "Warehouse ID must be a valid MongoDB ObjectId",
    );
  });
});

describe("staffValidator.param schemas", () => {
  it("validates staffId and userId params", () => {
    expect(
      staffValidator.paramSchema.validate({
        staffId: "507f1f77bcf86cd799439013",
      }).error,
    ).toBeUndefined();
    expect(
      staffValidator.paramUserIdSchema.validate({
        userId: "507f1f77bcf86cd799439011",
      }).error,
    ).toBeUndefined();
  });

  it("rejects invalid params", () => {
    const staffResult = staffValidator.paramSchema.validate({
      staffId: "bad-staff-id",
    });
    expect(staffResult.error.message).toContain(
      "Staff ID must be a valid MongoDB ObjectId",
    );

    const userResult = staffValidator.paramUserIdSchema.validate({
      userId: "bad-user-id",
    });
    expect(userResult.error.message).toContain(
      "User ID must be a valid MongoDB ObjectId",
    );
  });
});

describe("staffValidator.querySchema", () => {
  it("accepts valid pagination and filters", () => {
    const { error } = staffValidator.querySchema.validate({
      page: 1,
      limit: 10,
      status: "active",
      warehouseId: "507f1f77bcf86cd799439012",
      userId: "507f1f77bcf86cd799439011",
      search: "ST-001",
    });
    expect(error).toBeUndefined();
  });

  it("rejects invalid pagination values", () => {
    const result = staffValidator.querySchema.validate({ page: 0, limit: 101 });
    expect(result.error.message).toContain(
      "Page must be greater than or equal to 1",
    );
  });

  it("accepts blank search string", () => {
    const { error } = staffValidator.querySchema.validate({ search: "" });
    expect(error).toBeUndefined();
  });
});
