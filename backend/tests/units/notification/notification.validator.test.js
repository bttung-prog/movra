import { describe, expect, it } from "vitest";

import notificationValidator from "../../../src/modules/notification/notification.validator.js";

const notificationId = "507f1f77bcf86cd799439011";

describe("notificationValidator.queryNotificationSchema", () => {
  it("applies default pagination when no query is passed", () => {
    const { error, value } =
      notificationValidator.queryNotificationSchema.validate({});

    expect(error).toBeUndefined();
    expect(value).toMatchObject({
      page: 1,
      limit: 10,
    });
  });

  it("accepts valid pagination and isRead boolean", () => {
    const { error, value } =
      notificationValidator.queryNotificationSchema.validate({
        page: 2,
        limit: 25,
        isRead: true,
      });

    expect(error).toBeUndefined();
    expect(value).toMatchObject({
      page: 2,
      limit: 25,
      isRead: true,
    });
  });

  it.each([
    ["zero page", { page: 0 }],
    ["negative page", { page: -1 }],
    ["non-integer page", { page: 1.5 }],
    ["zero limit", { limit: 0 }],
    ["limit over 100", { limit: 101 }],
    ["invalid isRead", { isRead: "not-a-boolean" }],
  ])("rejects %s", (_case, query) => {
    expect(
      notificationValidator.queryNotificationSchema.validate(query).error,
    ).toBeDefined();
  });
});

describe("notificationValidator.paramNotificationIdSchema", () => {
  it("accepts a valid ObjectId", () => {
    const { error, value } =
      notificationValidator.paramNotificationIdSchema.validate({
        id: notificationId,
      });

    expect(error).toBeUndefined();
    expect(value.id).toBe(notificationId);
  });

  it.each([
    ["missing ID", {}],
    ["malformed ID", { id: "invalid-id" }],
    ["short hex ID", { id: "123456" }],
    ["non-hex characters", { id: "507f1f77bcf86cd79943901z" }],
  ])("rejects %s", (_case, params) => {
    expect(
      notificationValidator.paramNotificationIdSchema.validate(params).error,
    ).toBeDefined();
  });
});
