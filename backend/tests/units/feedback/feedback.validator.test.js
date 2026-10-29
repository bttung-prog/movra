import { describe, expect, it } from "vitest";

import feedbackValidator from "../../../src/modules/feedback/feedback.validator.js";

describe("feedbackValidator.createFeedbackSchema", () => {
  it("accepts a valid feedback payload", () => {
    const result = feedbackValidator.createFeedbackSchema.validate({
      orderId: "507f1f77bcf86cd799439011",
      rating: 5,
      tags: ["friendly", "on_time"],
      comment: "Great service",
    });

    expect(result.error).toBeUndefined();
    expect(result.value).toMatchObject({
      orderId: "507f1f77bcf86cd799439011",
      rating: 5,
      tags: ["friendly", "on_time"],
      comment: "Great service",
    });
  });

  it("rejects invalid rating and malformed order ID", () => {
    expect(
      feedbackValidator.createFeedbackSchema.validate({
        orderId: "invalid-id",
        rating: 0,
      }).error,
    ).toBeDefined();

    expect(
      feedbackValidator.createFeedbackSchema.validate({
        orderId: "507f1f77bcf86cd799439011",
        rating: 6,
      }).error,
    ).toBeDefined();
  });
});

describe("feedbackValidator.driverResponseSchema", () => {
  it("requires a non-empty response", () => {
    const result = feedbackValidator.driverResponseSchema.validate({
      driverResponse: "",
    });

    expect(result.error).toBeDefined();
  });

  it("accepts a valid response", () => {
    const result = feedbackValidator.driverResponseSchema.validate({
      driverResponse: "Thank you for the feedback",
    });

    expect(result.error).toBeUndefined();
    expect(result.value.driverResponse).toBe("Thank you for the feedback");
  });
});

describe("feedbackValidator.queryFeedbackSchema", () => {
  it("applies pagination defaults", () => {
    const { error, value } = feedbackValidator.queryFeedbackSchema.validate({});

    expect(error).toBeUndefined();
    expect(value).toMatchObject({ page: 1, limit: 10 });
  });

  it("rejects invalid pagination and unsupported status", () => {
    expect(
      feedbackValidator.queryFeedbackSchema.validate({
        page: 0,
      }).error,
    ).toBeDefined();

    expect(
      feedbackValidator.queryFeedbackSchema.validate({
        limit: 101,
      }).error,
    ).toBeDefined();

    expect(
      feedbackValidator.queryFeedbackSchema.validate({
        status: "archived",
      }).error,
    ).toBeDefined();
  });
});

describe("feedbackValidator.paramIdSchema", () => {
  it("requires a valid Mongo ObjectId", () => {
    expect(
      feedbackValidator.paramIdSchema.validate({
        id: "507f1f77bcf86cd799439011",
      }).error,
    ).toBeUndefined();
    expect(
      feedbackValidator.paramIdSchema.validate({ id: "invalid-id" }).error,
    ).toBeDefined();
  });
});
