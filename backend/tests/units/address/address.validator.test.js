import { describe, expect, it } from "vitest";

import addressValidator from "../../../src/modules/address/address.validator.js";

const addressId = "507f1f77bcf86cd799439011";

const validAddress = {
  receiverName: "  Test Receiver ",
  province: "  Province ",
  district: "  District ",
  ward: "  Ward ",
  detail: "  123 Main Street ",
  postalCode: " 12345 ",
  isDefault: true,
};

describe("addressValidator.createSchema", () => {
  it("accepts a complete address and trims text fields", () => {
    const { error, value } =
      addressValidator.createSchema.validate(validAddress);

    expect(error).toBeUndefined();
    expect(value).toMatchObject({
      receiverName: "Test Receiver",
      province: "Province",
      district: "District",
      ward: "Ward",
      detail: "123 Main Street",
      postalCode: "12345",
      isDefault: true,
    });
  });

  it("defaults optional postal code and isDefault fields", () => {
    const { error, value } = addressValidator.createSchema.validate({
      receiverName: "Receiver",
      province: "Province",
      district: "District",
      ward: "Ward",
      detail: "Address",
    });

    expect(error).toBeUndefined();
    expect(value.isDefault).toBe(false);
  });

  it.each([
    ["missing receiver name", { ...validAddress, receiverName: undefined }],
    ["blank province", { ...validAddress, province: "  " }],
    ["missing district", { ...validAddress, district: undefined }],
    ["missing ward", { ...validAddress, ward: undefined }],
    ["blank detail", { ...validAddress, detail: " " }],
    ["postal code too long", { ...validAddress, postalCode: "1".repeat(11) }],
    ["non-boolean default flag", { ...validAddress, isDefault: "yes" }],
  ])("rejects %s", (_case, payload) => {
    expect(addressValidator.createSchema.validate(payload).error).toBeDefined();
  });
});

describe("addressValidator.updateSchema", () => {
  it("requires at least one field and accepts valid partial updates", () => {
    expect(
      addressValidator.updateSchema.validate({}).error?.details[0].type,
    ).toBe("object.min");

    const { error, value } = addressValidator.updateSchema.validate({
      receiverName: "  Updated Receiver ",
      isDefault: true,
    });
    expect(error).toBeUndefined();
    expect(value).toMatchObject({
      receiverName: "Updated Receiver",
      isDefault: true,
    });
  });

  it("rejects oversized update values", () => {
    expect(
      addressValidator.updateSchema.validate({
        receiverName: "R".repeat(101),
      }).error,
    ).toBeDefined();
    expect(
      addressValidator.updateSchema.validate({
        detail: "D".repeat(501),
      }).error,
    ).toBeDefined();
    expect(
      addressValidator.updateSchema.validate({
        postalCode: "P".repeat(11),
      }).error,
    ).toBeDefined();
  });
});

describe("addressValidator.idParamSchema", () => {
  it("accepts valid MongoDB ObjectIds and rejects malformed IDs", () => {
    expect(
      addressValidator.idParamSchema.validate({ addressId }).error,
    ).toBeUndefined();
    expect(
      addressValidator.idParamSchema.validate({ addressId: "address-1" }).error,
    ).toBeDefined();
    expect(addressValidator.idParamSchema.validate({}).error).toBeDefined();
  });
});
