import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findActiveDispatchers: vi.fn(),
  findActiveAdminUserIds: vi.fn(),
  createManyNotifications: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("../../../src/modules/dispatcher/dispatcher.service.js", () => ({
  default: {
    getActiveByWarehouseId: mocks.findActiveDispatchers,
  },
}));

vi.mock("../../../src/modules/user/user.repository.js", () => ({
  default: {
    findActiveUserIdsByRole: mocks.findActiveAdminUserIds,
  },
}));

vi.mock("../../../src/modules/notification/notification.service.js", () => ({
  default: {
    createMany: mocks.createManyNotifications,
  },
}));

vi.mock("../../../src/configs/logger.js", () => ({
  default: { error: mocks.loggerError },
}));

import feedbackNotificationService from "../../../src/modules/feedback/feedbackNotification.service.js";

const feedback = {
  _id: "feedback-1",
  orderId: { _id: "order-1", orderCode: "ORD-0001" },
  customerId: { _id: "customer-1", userId: { _id: "customer-user-1" } },
  driverId: { _id: "driver-1", userId: { _id: "driver-user-1" } },
  tripId: "trip-1",
  warehouseId: "warehouse-1",
  rating: 5,
  tags: ["friendly"],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findActiveDispatchers.mockResolvedValue([
    { userId: { _id: "dispatcher-user-1" } },
  ]);
  mocks.findActiveAdminUserIds.mockResolvedValue(["admin-user-1"]);
  mocks.createManyNotifications.mockResolvedValue([]);
});

describe("feedbackNotificationService.notifyFeedbackCreated", () => {
  it("notifies the driver and responsible dispatcher", async () => {
    await feedbackNotificationService.notifyFeedbackCreated({
      feedback,
      actor: { userId: "customer-user-1" },
    });

    const notifications = mocks.createManyNotifications.mock.calls[0][0];
    expect(notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: "driver-user-1" }),
        expect.objectContaining({ userId: "dispatcher-user-1" }),
      ]),
    );
    expect(notifications[0].type).toBe("FEEDBACK");
    expect(notifications[0].data).toEqual(
      expect.objectContaining({
        feedbackId: "feedback-1",
        orderId: "order-1",
        orderCode: "ORD-0001",
        rating: 5,
        tags: ["friendly"],
        event: "FEEDBACK_CREATED",
      }),
    );
  });

  it("adds a low-rating notification for admins when rating <= 2", async () => {
    await feedbackNotificationService.notifyFeedbackCreated({
      feedback: { ...feedback, rating: 2 },
    });

    const notifications = mocks.createManyNotifications.mock.calls[0][0];
    expect(notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: "admin-user-1",
          data: expect.objectContaining({ event: "FEEDBACK_LOW_RATING" }),
        }),
      ]),
    );
    expect(mocks.findActiveAdminUserIds).toHaveBeenCalledWith("admin");
  });
});

describe("feedbackNotificationService.notifyFeedbackReplied", () => {
  it("notifies the customer only", async () => {
    await feedbackNotificationService.notifyFeedbackReplied({
      feedback,
      actor: { userId: "admin-1" },
    });

    expect(mocks.createManyNotifications).toHaveBeenCalledWith([
      expect.objectContaining({
        userId: "customer-user-1",
        data: expect.objectContaining({ event: "FEEDBACK_REPLIED" }),
      }),
    ]);
    expect(mocks.findActiveDispatchers).not.toHaveBeenCalled();
  });
});

describe("feedbackNotificationService failure handling", () => {
  it("swallows notification failures", async () => {
    mocks.createManyNotifications.mockRejectedValue(new Error("db down"));

    await expect(
      feedbackNotificationService.notifyFeedbackCreated({ feedback }),
    ).resolves.toEqual([]);

    expect(mocks.loggerError).toHaveBeenCalled();
  });
});
