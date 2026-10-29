import { describe, expect, it } from "vitest";

import dispatcherValidator from "../../../src/modules/dispatcher/dispatcher.validator.js";

const userId = "507f1f77bcf86cd799439011";
const warehouseId = "507f1f77bcf86cd799439012";
const dispatcherId = "507f1f77bcf86cd799439013";

describe("dispatcherValidator.createSchema", () => {
  it("accepts valid user and warehouse IDs", () => {
    expect(
      dispatcherValidator.createSchema.validate({ userId, warehouseId }).error,
    ).toBeUndefined();
  });

  it.each([
    ["missing user ID", { warehouseId }],
    ["malformed user ID", { userId: "user-1", warehouseId }],
    ["missing warehouse ID", { userId }],
    ["malformed warehouse ID", { userId, warehouseId: "warehouse-1" }],
  ])("rejects %s", (_case, payload) => {
    expect(
      dispatcherValidator.createSchema.validate(payload).error,
    ).toBeDefined();
  });
});

describe("dispatcherValidator update schemas", () => {
  it("requires at least one update field and accepts supported values", () => {
    expect(
      dispatcherValidator.updateSchema.validate({}).error?.details[0].type,
    ).toBe("object.min");
    expect(
      dispatcherValidator.updateSchema.validate({
        warehouseId,
        status: "suspended",
      }).error,
    ).toBeUndefined();
    expect(
      dispatcherValidator.transferWarehouseSchema.validate({ warehouseId })
        .error,
    ).toBeUndefined();
    expect(
      dispatcherValidator.updateStatusSchema.validate({ status: "inactive" })
        .error,
    ).toBeUndefined();
  });

  it("rejects malformed warehouse IDs and unsupported statuses", () => {
    expect(
      dispatcherValidator.updateSchema.validate({
        warehouseId: "warehouse-1",
      }).error,
    ).toBeDefined();
    expect(
      dispatcherValidator.updateSchema.validate({ status: "deleted" }).error,
    ).toBeDefined();
    expect(
      dispatcherValidator.transferWarehouseSchema.validate({
        warehouseId: "bad-id",
      }).error,
    ).toBeDefined();
    expect(
      dispatcherValidator.updateStatusSchema.validate({}).error,
    ).toBeDefined();
    expect(
      dispatcherValidator.updateStatusSchema.validate({ status: "deleted" })
        .error,
    ).toBeDefined();
  });
});

describe("dispatcherValidator parameter and query schemas", () => {
  it("validates dispatcher, user, and dispatcher code parameters", () => {
    expect(
      dispatcherValidator.paramSchema.validate({ dispatcherId }).error,
    ).toBeUndefined();
    expect(
      dispatcherValidator.paramUserIdSchema.validate({ userId }).error,
    ).toBeUndefined();
    expect(
      dispatcherValidator.paramCodeSchema.validate({
        dispatcherCode: "DIS-0001",
      }).error,
    ).toBeUndefined();
    expect(
      dispatcherValidator.paramSchema.validate({ dispatcherId: "bad-id" })
        .error,
    ).toBeDefined();
    expect(
      dispatcherValidator.paramCodeSchema.validate({ dispatcherCode: "" })
        .error,
    ).toBeDefined();
  });

  it("trims search, validates filters, and applies resource pagination defaults", () => {
    const { error, value } = dispatcherValidator.querySchema.validate({
      page: 2,
      limit: 20,
      status: "active",
      warehouseId,
      userId,
      search: "  DIS-1 ",
    });

    expect(error).toBeUndefined();
    expect(value).toMatchObject({
      page: 2,
      limit: 20,
      status: "active",
      warehouseId,
      userId,
      search: "DIS-1",
    });
    expect(
      dispatcherValidator.querySchema.validate({ limit: 101 }).error,
    ).toBeDefined();
    expect(
      dispatcherValidator.querySchema.validate({ status: "unknown" }).error,
    ).toBeDefined();

    const resources = dispatcherValidator.resourcesQuerySchema.validate({});
    expect(resources.error).toBeUndefined();
    expect(resources.value).toEqual({ page: 1, limit: 100 });
    expect(
      dispatcherValidator.resourcesQuerySchema.validate({ limit: 101 }).error,
    ).toBeDefined();
  });
});
