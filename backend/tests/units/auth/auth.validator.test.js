import { describe, expect, it } from "vitest";

import authValidator from "../../../src/modules/auth/auth.validator.js";

describe("authValidator.registerSchema", () => {
  it("accepts valid registration details", () => {
    const result = authValidator.registerSchema.validate({
      email: "customer@example.com",
      password: "secure123",
      phone: "0123456789",
      fullName: "Test Customer",
    });

    expect(result.error).toBeUndefined();
  });

  it.each([
    [
      "email",
      { email: "not-an-email", password: "secure123", phone: "0123456789", fullName: "Test" },
    ],
    [
      "password shorter than six characters",
      { email: "customer@example.com", password: "12345", phone: "0123456789", fullName: "Test" },
    ],
    [
      "phone number with the wrong length",
      { email: "customer@example.com", password: "secure123", phone: "12345", fullName: "Test" },
    ],
    [
      "missing full name",
      { email: "customer@example.com", password: "secure123", phone: "0123456789" },
    ],
  ])("rejects invalid %s", (_case, input) => {
    expect(authValidator.registerSchema.validate(input).error).toBeDefined();
  });
});

describe("authValidator.loginSchema", () => {
  it("accepts valid login details", () => {
    const result = authValidator.loginSchema.validate({
      email: "customer@example.com",
      password: "secure123",
    });

    expect(result.error).toBeUndefined();
  });

  it("rejects a missing password", () => {
    const result = authValidator.loginSchema.validate({
      email: "customer@example.com",
    });

    expect(result.error).toBeDefined();
    expect(result.error.details[0].path).toEqual(["password"]);
  });
});

describe("auth OTP validators", () => {
  it("accepts a valid registration OTP payload", () => {
    const result = authValidator.verifyRegisterOtpSchema.validate({
      email: "customer@example.com",
      otp: "12345678",
    });

    expect(result.error).toBeUndefined();
  });

  it("rejects registration OTPs that are not eight digits", () => {
    const result = authValidator.verifyRegisterOtpSchema.validate({
      email: "customer@example.com",
      otp: "1234",
    });

    expect(result.error).toBeDefined();
  });

  it("accepts a valid password reset payload", () => {
    const result = authValidator.resetPasswordSchema.validate({
      email: "customer@example.com",
      otp: "12345678",
      newPassword: "new-password",
    });

    expect(result.error).toBeUndefined();
  });
});

describe("authValidator.changePasswordSchema", () => {
  it("accepts valid old and new passwords", () => {
    expect(
      authValidator.changePasswordSchema.validate({
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
      expect(authValidator.changePasswordSchema.validate(payload).error).toBeDefined();
    }
  });
});
