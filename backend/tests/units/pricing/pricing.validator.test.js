import { describe, expect, it } from "vitest";

import pricingValidator from "../../../src/modules/pricing/pricing.validator.js";

describe("pricingValidator.calculateFeeSchema", () => {
  it("accepts a valid distance-based quote with defaults", () => {
    const { error, value } = pricingValidator.calculateFeeSchema.validate({
      weight: 2,
      distance: 15,
    });

    expect(error).toBeUndefined();
    expect(value).toMatchObject({
      serviceType: "standard",
      weight: 2,
      volume: 0,
      distance: 15,
    });
  });

  it("requires either distance or routeId and rejects invalid values", () => {
    expect(
      pricingValidator.calculateFeeSchema.validate({ weight: 2 }).error,
    ).toBeDefined();

    expect(
      pricingValidator.calculateFeeSchema.validate({
        weight: 0,
        distance: 5,
      }).error,
    ).toBeDefined();

    expect(
      pricingValidator.calculateFeeSchema.validate({
        weight: 2,
        serviceType: "overnight",
        distance: 10,
      }).error,
    ).toBeDefined();
  });
});

describe("pricingValidator.createShippingRateSchema", () => {
  it("accepts a valid shipping rate payload", () => {
    const result = pricingValidator.createShippingRateSchema.validate({
      name: "Standard Rate",
      serviceType: "standard",
      basePrice: 16500,
      categorySurcharges: [
        {
          goodsCategoryId: "507f1f77bcf86cd799439011",
          surchargePercentage: 10,
          surchargeFixed: 500,
        },
      ],
      description: "Includes urban delivery",
    });

    expect(result.error).toBeUndefined();
    expect(result.value).toMatchObject({
      name: "Standard Rate",
      serviceType: "standard",
      basePrice: 16500,
    });
  });

  it("requires a name and valid category IDs", () => {
    expect(
      pricingValidator.createShippingRateSchema.validate({
        serviceType: "standard",
        basePrice: 10000,
      }).error,
    ).toBeDefined();

    expect(
      pricingValidator.createShippingRateSchema.validate({
        name: "Rate",
        serviceType: "standard",
        basePrice: 10000,
        categorySurcharges: [{ goodsCategoryId: "invalid-id" }],
      }).error,
    ).toBeDefined();
  });
});

describe("pricingValidator.queryRateSchema", () => {
  it("applies pagination defaults and allows valid filters", () => {
    const defaultResult = pricingValidator.queryRateSchema.validate({});
    expect(defaultResult.error).toBeUndefined();
    expect(defaultResult.value).toMatchObject({ page: 1, limit: 10 });

    const validResult = pricingValidator.queryRateSchema.validate({
      serviceType: "express",
      isActive: true,
      limit: 20,
    });
    expect(validResult.error).toBeUndefined();
  });

  it("rejects invalid pagination and serviceType values", () => {
    expect(
      pricingValidator.queryRateSchema.validate({ page: 0 }).error,
    ).toBeDefined();
    expect(
      pricingValidator.queryRateSchema.validate({ limit: 101 }).error,
    ).toBeDefined();
    expect(
      pricingValidator.queryRateSchema.validate({ serviceType: "vip" }).error,
    ).toBeDefined();
  });
});

describe("pricingValidator.paramIdSchema", () => {
  it("requires a valid Mongo ObjectId", () => {
    expect(
      pricingValidator.paramIdSchema.validate({
        id: "507f1f77bcf86cd799439011",
      }).error,
    ).toBeUndefined();

    expect(
      pricingValidator.paramIdSchema.validate({ id: "bad-id" }).error,
    ).toBeDefined();
  });
});
