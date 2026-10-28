import { describe, expect, it } from "vitest";

import driverValidator from "../../../src/modules/driver/driver.validator.js";

const validDriverPayload = {
  userId: "507f1f77bcf86cd799439011",
  warehouseId: "507f1f77bcf86cd799439012",
  idCardNumber: "012345678901",
  dateOfBirth: "1990-01-01",
  gender: "female",
  address: "  123 Main Street  ",
  licenseNumber: "LIC-123456",
  licenseType: "B",
  licenseExpiryDate: "2035-01-01",
};

describe("driverValidator.createSchema", () => {
  it("accepts valid driver data and trims text fields", () => {
    const { error, value } =
      driverValidator.createSchema.validate(validDriverPayload);

    expect(error).toBeUndefined();
    expect(value.address).toBe("123 Main Street");
  });

  it.each([
    ["invalid user ID", { userId: "user-1" }],
    ["invalid warehouse ID", { warehouseId: "warehouse-1" }],
    ["unsupported gender", { gender: "unknown" }],
    ["unsupported license type", { licenseType: "Z" }],
    ["future date of birth", { dateOfBirth: "2035-01-01" }],
    ["expired license", { licenseExpiryDate: "2020-01-01" }],
  ])("rejects %s", (_case, override) => {
    const result = driverValidator.createSchema.validate({
      ...validDriverPayload,
      ...override,
    });

    expect(result.error).toBeDefined();
  });
});

describe("driverValidator.updateSchema", () => {
  it("requires at least one field to update", () => {
    const result = driverValidator.updateSchema.validate({});

    expect(result.error).toBeDefined();
    expect(result.error.details[0].type).toBe("object.min");
  });

  it("accepts clearing the current vehicle assignment", () => {
    const result = driverValidator.updateSchema.validate({
      currentVehicleId: null,
    });

    expect(result.error).toBeUndefined();
  });

  it.each([
    ["invalid warehouse ID", { warehouseId: "warehouse-1" }],
    ["invalid vehicle ID", { currentVehicleId: "vehicle-1" }],
    ["unsupported status", { status: "retired" }],
    ["expired license date", { licenseExpiryDate: "2020-01-01" }],
  ])("rejects %s", (_case, update) => {
    expect(driverValidator.updateSchema.validate(update).error).toBeDefined();
  });
});

describe("driverValidator.renewLicenseSchema", () => {
  it("requires a future expiry date", () => {
    expect(
      driverValidator.renewLicenseSchema.validate({
        newExpiryDate: "2035-01-01",
      }).error,
    ).toBeUndefined();
    expect(
      driverValidator.renewLicenseSchema.validate({
        newExpiryDate: "2020-01-01",
      }).error,
    ).toBeDefined();
  });
});

describe("driverValidator parameter and query schemas", () => {
  it("validates driver IDs and trims driver codes", () => {
    expect(
      driverValidator.driverIdParamSchema.validate({
        driverId: "507f1f77bcf86cd799439011",
      }).error,
    ).toBeUndefined();
    expect(
      driverValidator.driverIdParamSchema.validate({ driverId: "invalid" })
        .error,
    ).toBeDefined();

    const { error, value } = driverValidator.driverCodeParamSchema.validate({
      driverCode: "  DR-0001  ",
    });
    expect(error).toBeUndefined();
    expect(value.driverCode).toBe("DR-0001");
  });

  it("applies pagination defaults and rejects invalid filters", () => {
    const { error, value } = driverValidator.getAllSchema.validate({});

    expect(error).toBeUndefined();
    expect(value).toMatchObject({ page: 1, limit: 10 });
    expect(
      driverValidator.getAllSchema.validate({ limit: 101 }).error,
    ).toBeDefined();
    expect(
      driverValidator.getAllSchema.validate({ status: "retired" }).error,
    ).toBeDefined();
  });
});
