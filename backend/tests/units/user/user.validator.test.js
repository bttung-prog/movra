import { describe, expect, it } from "vitest";

import userValidator from "../../../src/modules/user/user.validator.js";

describe("userValidator.updateMeSchema", () => {
  it("accepts valid profile updates", () => {
    expect(
      userValidator.updateMeSchema.validate({
        phone: "0123456789",
        fullName: "Updated Name",
      }).error,
    ).toBeUndefined();
  });

  it("requires at least one field and validates phone and name constraints", () => {
    expect(
      userValidator.updateMeSchema.validate({}).error?.details[0].type,
    ).toBe("object.min");
    expect(
      userValidator.updateMeSchema.validate({ phone: "123" }).error,
    ).toBeDefined();
    expect(
      userValidator.updateMeSchema.validate({ fullName: "AB" }).error,
    ).toBeDefined();
    expect(
      userValidator.updateMeSchema.validate({
        fullName: "A".repeat(101),
      }).error,
    ).toBeDefined();
  });
});

describe("userValidator.changePasswordSchema", () => {
  it("accepts passwords within the supported length", () => {
    expect(
      userValidator.changePasswordSchema.validate({
        oldPassword: "old-password",
        newPassword: "new-pass",
      }).error,
    ).toBeUndefined();
  });

  it("requires both passwords and enforces new password length", () => {
    for (const payload of [
      {},
      { oldPassword: "old-password" },
      { newPassword: "new-password" },
      { oldPassword: "old-password", newPassword: "12345" },
      { oldPassword: "old-password", newPassword: "x".repeat(25) },
    ]) {
      expect(
        userValidator.changePasswordSchema.validate(payload).error,
      ).toBeDefined();
    }
  });
});
