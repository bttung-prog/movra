import { describe, expect, it } from "vitest";

import adminValidator from "../../../src/modules/admin/admin.validator.js";

const userId = "507f1f77bcf86cd799439011";

const validDriverData = {
  warehouseId: userId,
  idCardNumber: "123456789",
  dateOfBirth: "1990-01-01",
  gender: "other",
  address: "123 Main Street",
  licenseNumber: "DL-123",
  licenseType: "B",
  licenseExpiryDate: "2099-01-01",
};

describe("adminValidator.createUserSchema", () => {
  const validUser = {
    email: "user@example.com",
    password: "password123",
    phone: "0123456789",
    fullName: "Test User",
    role: "customer",
  };

  it("accepts a valid customer account and rejects missing required fields", () => {
    expect(
      adminValidator.createUserSchema.validate(validUser).error,
    ).toBeUndefined();
    expect(
      adminValidator.createUserSchema.validate({ ...validUser, phone: "123" })
        .error,
    ).toBeDefined();
    expect(
      adminValidator.createUserSchema.validate({ ...validUser, email: "bad" })
        .error,
    ).toBeDefined();
    expect(
      adminValidator.createUserSchema.validate({
        ...validUser,
        password: "123",
      }).error,
    ).toBeDefined();
  });

  it("requires the matching role data for staff accounts", () => {
    expect(
      adminValidator.createUserSchema.validate({
        ...validUser,
        role: "driver",
      }).error,
    ).toBeDefined();
    expect(
      adminValidator.createUserSchema.validate({
        ...validUser,
        role: "driver",
        driverData: validDriverData,
      }).error,
    ).toBeUndefined();
    expect(
      adminValidator.createUserSchema.validate({
        ...validUser,
        staffData: { warehouseId: userId },
      }).error,
    ).toBeDefined();
    expect(
      adminValidator.createUserSchema.validate({
        ...validUser,
        role: "warehouse_staff",
        staffData: { warehouseId: userId },
      }).error,
    ).toBeUndefined();
    expect(
      adminValidator.createUserSchema.validate({
        ...validUser,
        role: "dispatcher",
        dispatcherData: { warehouseId: userId },
      }).error,
    ).toBeUndefined();
  });
});

describe("adminValidator.updateUserSchema", () => {
  it("requires at least one editable field and prevents direct role or status edits", () => {
    expect(
      adminValidator.updateUserSchema.validate({}).error?.details[0].type,
    ).toBe("object.min");
    expect(
      adminValidator.updateUserSchema.validate({ fullName: "New Name" }).error,
    ).toBeUndefined();
    expect(
      adminValidator.updateUserSchema.validate({ role: "admin" }).error,
    ).toBeDefined();
    expect(
      adminValidator.updateUserSchema.validate({ status: "active" }).error,
    ).toBeDefined();
    expect(
      adminValidator.updateUserSchema.validate({ phone: "123" }).error,
    ).toBeDefined();
  });
});

describe("adminValidator.changeRoleUserSchema", () => {
  it("requires valid role data when changing to a driver role", () => {
    expect(
      adminValidator.changeRoleUserSchema.validate({ role: "driver" }).error,
    ).toBeDefined();
    expect(
      adminValidator.changeRoleUserSchema.validate({
        role: "driver",
        driverData: validDriverData,
      }).error,
    ).toBeUndefined();
  });

  it("rejects role-specific data that does not match the selected role", () => {
    expect(
      adminValidator.changeRoleUserSchema.validate({
        role: "customer",
        driverData: validDriverData,
      }).error,
    ).toBeDefined();
    expect(
      adminValidator.changeRoleUserSchema.validate({ role: "unknown" }).error,
    ).toBeDefined();
  });
});

describe("adminValidator status, password, ID, and query schemas", () => {
  it("only accepts supported account statuses", () => {
    for (const status of ["active", "inactive", "locked"]) {
      expect(
        adminValidator.changeStatusUserSchema.validate({ status }).error,
      ).toBeUndefined();
    }
    expect(
      adminValidator.changeStatusUserSchema.validate({ status: "deleted" })
        .error,
    ).toBeDefined();
  });

  it("validates reset passwords and MongoDB user IDs", () => {
    expect(
      adminValidator.resetPasswordSchema.validate({
        newPassword: "password123",
      }).error,
    ).toBeUndefined();
    expect(
      adminValidator.resetPasswordSchema.validate({ newPassword: "short" })
        .error,
    ).toBeDefined();
    expect(
      adminValidator.paramUserIdSchema.validate({ userId }).error,
    ).toBeUndefined();
    expect(
      adminValidator.paramUserIdSchema.validate({ userId: "not-an-id" }).error,
    ).toBeDefined();
  });

  it("applies pagination defaults and rejects invalid filters", () => {
    expect(adminValidator.queryUserSchema.validate({}).value).toMatchObject({
      page: 1,
      limit: 10,
    });
    expect(
      adminValidator.queryUserSchema.validate({
        page: "2",
        limit: "20",
        keyword: "  driver  ",
        role: "driver",
        status: "active",
      }).value,
    ).toMatchObject({
      page: 2,
      limit: 20,
      keyword: "driver",
      role: "driver",
      status: "active",
    });
    for (const query of [
      { page: 0 },
      { limit: 101 },
      { role: "unknown" },
      { status: "deleted" },
    ]) {
      expect(
        adminValidator.queryUserSchema.validate(query).error,
      ).toBeDefined();
    }
  });
});
