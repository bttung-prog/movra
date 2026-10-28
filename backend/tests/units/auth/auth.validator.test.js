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
