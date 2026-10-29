import { describe, expect, it } from "vitest";

import WAREHOUSE_STATUSES from "../../../src/constants/warehouseStatuses.js";
import warehouseValidator from "../../../src/modules/warehouse/warehouse.validator.js";

const warehouseId = "507f1f77bcf86cd799439011";
const managerId = "507f1f77bcf86cd799439012";

describe("warehouseValidator.createSchema", () => {
  it("accepts valid data and trims warehouse name and address", () => {
    const { error, value } = warehouseValidator.createSchema.validate({
      warehouseName: "  Main warehouse ",
      warehouseAddress: "  123 Example Street ",
      latitude: 10.78,
      longitude: 106.69,
      managerId,
      status: WAREHOUSE_STATUSES.ACTIVE,
    });

    expect(error).toBeUndefined();
    expect(value).toMatchObject({
      warehouseName: "Main warehouse",
      warehouseAddress: "123 Example Street",
      latitude: 10.78,
      longitude: 106.69,
      managerId,
      status: WAREHOUSE_STATUSES.ACTIVE,
    });
  });

  it("allows an omitted or null manager", () => {
    expect(
      warehouseValidator.createSchema.validate({
        warehouseName: "Main",
        warehouseAddress: "Address",
      }).error,
    ).toBeUndefined();
    expect(
      warehouseValidator.createSchema.validate({
        warehouseName: "Main",
        warehouseAddress: "Address",
        managerId: null,
      }).error,
    ).toBeUndefined();
  });

  it.each([
    ["missing name", { warehouseAddress: "Address" }],
    ["blank name", { warehouseName: "  ", warehouseAddress: "Address" }],
    ["missing address", { warehouseName: "Main" }],
    [
      "invalid manager ID",
      {
        warehouseName: "Main",
        warehouseAddress: "Address",
        managerId: "manager-1",
      },
    ],
    [
      "unsupported status",
      { warehouseName: "Main", warehouseAddress: "Address", status: "closed" },
    ],
  ])("rejects %s", (_case, override) => {
    expect(
      warehouseValidator.createSchema.validate(override).error,
    ).toBeDefined();
  });
});

describe("warehouseValidator update and manager schemas", () => {
  it("requires at least one update field", () => {
    expect(
      warehouseValidator.updateSchema.validate({}).error?.details[0].type,
    ).toBe("object.min");
  });

  it("accepts valid partial updates and nullable manager assignments", () => {
    expect(
      warehouseValidator.updateSchema.validate({
        warehouseName: "  Updated name ",
        managerId: null,
      }).value,
    ).toMatchObject({ warehouseName: "Updated name", managerId: null });
    expect(
      warehouseValidator.updateManagerSchema.validate({ managerId }).error,
    ).toBeUndefined();
    expect(
      warehouseValidator.updateManagerSchema.validate({ managerId: null })
        .error,
    ).toBeUndefined();
  });

  it("rejects malformed manager IDs", () => {
    expect(
      warehouseValidator.updateSchema.validate({ managerId: "manager-1" })
        .error,
    ).toBeDefined();
    expect(
      warehouseValidator.updateManagerSchema.validate({ managerId: "bad-id" })
        .error,
    ).toBeDefined();
    expect(
      warehouseValidator.updateManagerSchema.validate({}).error,
    ).toBeDefined();
  });

  it("requires coordinate pairs and validates their geographic range", () => {
    expect(
      warehouseValidator.createSchema.validate({
        warehouseName: "Main",
        warehouseAddress: "Address",
        latitude: 10.78,
      }).error,
    ).toBeDefined();
    expect(
      warehouseValidator.updateSchema.validate({ longitude: 106.69 }).error,
    ).toBeDefined();
    expect(
      warehouseValidator.createSchema.validate({
        warehouseName: "Main",
        warehouseAddress: "Address",
        latitude: 91,
        longitude: 106.69,
      }).error,
    ).toBeDefined();
  });
});

describe("warehouseValidator status, parameter, and query schemas", () => {
  it("accepts supported status changes and rejects unsupported statuses", () => {
    for (const status of Object.values(WAREHOUSE_STATUSES)) {
      expect(
        warehouseValidator.changeStatusSchema.validate({ status }).error,
      ).toBeUndefined();
    }
    expect(
      warehouseValidator.changeStatusSchema.validate({ status: "closed" })
        .error,
    ).toBeDefined();
  });

  it("validates warehouse IDs in route parameters", () => {
    expect(
      warehouseValidator.paramSchema.validate({ warehouseId }).error,
    ).toBeUndefined();
    expect(
      warehouseValidator.paramSchema.validate({ warehouseId: "warehouse-1" })
        .error,
    ).toBeDefined();
  });

  it("trims search and validates query pagination and status", () => {
    const { error, value } = warehouseValidator.querySchema.validate({
      search: "  Central ",
      page: 2,
      limit: 25,
      status: WAREHOUSE_STATUSES.MAINTENANCE,
    });

    expect(error).toBeUndefined();
    expect(value).toMatchObject({
      search: "Central",
      page: 2,
      limit: 25,
      status: WAREHOUSE_STATUSES.MAINTENANCE,
    });
    expect(
      warehouseValidator.querySchema.validate({ page: 0 }).error,
    ).toBeDefined();
    expect(
      warehouseValidator.querySchema.validate({ limit: 101 }).error,
    ).toBeDefined();
    expect(
      warehouseValidator.querySchema.validate({ status: "closed" }).error,
    ).toBeDefined();
  });
});
