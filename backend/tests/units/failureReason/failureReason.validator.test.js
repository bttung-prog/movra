import { describe, expect, it } from "vitest";

import failureReasonValidator from "../../../src/modules/failureReason/failureReason.validator.js";

const orderId = "507f1f77bcf86cd799439011";
const tripId = "507f1f77bcf86cd799439012";

describe("failureReasonValidator.createFailureReasonSchema", () => {
  const validReport = {
    orderId,
    tripId,
    failureReasonType: "customer_rejected",
    failureReasonDescription: "  Customer unavailable  ",
    latitude: 10.75,
    longitude: 106.67,
    address: "  Ho Chi Minh City  ",
  };

  it("accepts a valid failure report and trims free-text fields", () => {
    const { error, value } =
      failureReasonValidator.createFailureReasonSchema.validate(validReport);

    expect(error).toBeUndefined();
    expect(value.failureReasonDescription).toBe("Customer unavailable");
    expect(value.address).toBe("Ho Chi Minh City");
  });

  it("requires valid order and trip IDs and a supported failure type", () => {
    for (const invalidReport of [
      { ...validReport, orderId: "invalid-id" },
      { ...validReport, tripId: "invalid-id" },
      { ...validReport, failureReasonType: "unknown" },
      { ...validReport, orderId: undefined },
      { ...validReport, tripId: undefined },
    ]) {
      expect(
        failureReasonValidator.createFailureReasonSchema.validate(invalidReport)
          .error,
      ).toBeDefined();
    }
  });

  it("keeps optional coordinates within valid latitude and longitude ranges", () => {
    for (const coordinates of [
      { latitude: -90, longitude: -180 },
      { latitude: 90, longitude: 180 },
    ]) {
      expect(
        failureReasonValidator.createFailureReasonSchema.validate({
          ...validReport,
          ...coordinates,
        }).error,
      ).toBeUndefined();
    }

    for (const coordinates of [
      { latitude: -91 },
      { latitude: 91 },
      { longitude: -181 },
      { longitude: 181 },
    ]) {
      expect(
        failureReasonValidator.createFailureReasonSchema.validate({
          ...validReport,
          ...coordinates,
        }).error,
      ).toBeDefined();
    }
  });
});

describe("failureReasonValidator list and ID schemas", () => {
  it("applies list pagination defaults and validates filters", () => {
    expect(
      failureReasonValidator.getAllFailureReasonsSchema.validate({}).value,
    ).toMatchObject({ page: 1, limit: 20 });
    expect(
      failureReasonValidator.getAllFailureReasonsSchema.validate({
        page: 2,
        limit: 50,
        failureReasonType: "damaged",
        orderId,
      }).error,
    ).toBeUndefined();

    for (const query of [
      { page: 0 },
      { limit: 101 },
      { failureReasonType: "unknown" },
      { orderId: "bad-id" },
    ]) {
      expect(
        failureReasonValidator.getAllFailureReasonsSchema.validate(query).error,
      ).toBeDefined();
    }
  });

  it("requires valid IDs for failure reports, orders, and trips", () => {
    expect(
      failureReasonValidator.getByIdSchema.validate({
        failureReasonId: orderId,
      }).error,
    ).toBeUndefined();
    expect(
      failureReasonValidator.paramOrderIdSchema.validate({ orderId }).error,
    ).toBeUndefined();
    expect(
      failureReasonValidator.paramTripIdSchema.validate({ tripId }).error,
    ).toBeUndefined();

    expect(
      failureReasonValidator.getByIdSchema.validate({
        failureReasonId: "bad-id",
      }).error,
    ).toBeDefined();
    expect(
      failureReasonValidator.paramOrderIdSchema.validate({
        orderId: "bad-id",
      }).error,
    ).toBeDefined();
    expect(
      failureReasonValidator.paramTripIdSchema.validate({
        tripId: "bad-id",
      }).error,
    ).toBeDefined();
  });
});

describe("failureReasonValidator.updateFailureReasonSchema", () => {
  it("requires at least one editable field and validates supplied updates", () => {
    expect(
      failureReasonValidator.updateFailureReasonSchema.validate({}).error
        ?.details[0].type,
    ).toBe("object.min");
    expect(
      failureReasonValidator.updateFailureReasonSchema.validate({
        failureReasonType: "other",
        address: "Updated address",
      }).error,
    ).toBeUndefined();

    for (const update of [
      { failureReasonType: "unknown" },
      { latitude: -91 },
      { longitude: 181 },
    ]) {
      expect(
        failureReasonValidator.updateFailureReasonSchema.validate(update).error,
      ).toBeDefined();
    }
  });
});
