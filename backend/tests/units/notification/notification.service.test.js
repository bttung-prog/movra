import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findAll: vi.fn(),
  countAll: vi.fn(),
  findById: vi.fn(),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
}));

vi.mock("../../../src/modules/notification/notification.repository.js", () => ({
  default: {
    create: mocks.create,
    findAll: mocks.findAll,
    countAll: mocks.countAll,
    findById: mocks.findById,
    markAsRead: mocks.markAsRead,
    markAllAsRead: mocks.markAllAsRead,
  },
}));

import notificationService from "../../../src/modules/notification/notification.service.js";

const userId = "user-1";
const notificationId = "notification-1";
const notification = {
  _id: notificationId,
  userId,
  title: "Order update",
  message: "Your order is in transit",
  type: "ORDER_UPDATE",
  data: { orderId: "order-1" },
  isRead: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.create.mockResolvedValue(notification);
  mocks.findAll.mockResolvedValue([notification]);
  mocks.countAll.mockResolvedValue(12);
  mocks.findById.mockResolvedValue(notification);
  mocks.markAsRead.mockResolvedValue({ ...notification, isRead: true });
  mocks.markAllAsRead.mockResolvedValue({ modifiedCount: 3 });
});

describe("notificationService.create", () => {
  it("creates a notification with its default type and data", async () => {
    await notificationService.create({
      userId,
      title: " Order update ",
      message: " Order is on the way ",
    });

    expect(mocks.create).toHaveBeenCalledWith(
      {
        userId,
        title: " Order update ",
        message: " Order is on the way ",
        type: "ORDER_UPDATE",
        data: {},
      },
      null,
    );
  });

  it("preserves an explicit type, data, and database session", async () => {
    const session = { id: "session-1" };
    const data = { orderId: "order-1", orderCode: "ORD-001" };

    await notificationService.create({
      userId,
      title: "Payment received",
      message: "Payment has been confirmed",
      type: "PAYMENT",
      data,
      session,
    });

    expect(mocks.create).toHaveBeenCalledWith(
      {
        userId,
        title: "Payment received",
        message: "Payment has been confirmed",
        type: "PAYMENT",
        data,
      },
      session,
    );
  });

  it.each([
    ["userId", { title: "Title", message: "Message" }],
    ["title", { userId, message: "Message" }],
    ["message", { userId, title: "Title" }],
  ])("skips creation when %s is missing", async (_field, input) => {
    await expect(notificationService.create(input)).resolves.toBeNull();
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

describe("notificationService.getMyNotifications", () => {
  it("returns user-specific notifications, unread count, and pagination", async () => {
    mocks.countAll.mockResolvedValueOnce(12).mockResolvedValueOnce(4);

    const result = await notificationService.getMyNotifications({
      userId,
      page: 2,
      limit: 5,
    });

    expect(mocks.findAll).toHaveBeenCalledWith({
      filter: { userId },
      skip: 5,
      limit: 5,
      sort: { createdAt: -1 },
    });
    expect(mocks.countAll).toHaveBeenNthCalledWith(1, {
      filter: { userId },
    });
    expect(mocks.countAll).toHaveBeenNthCalledWith(2, {
      filter: { userId, isRead: false },
    });
    expect(result).toEqual({
      data: [notification],
      unreadCount: 4,
      pagination: {
        page: 2,
        limit: 5,
        total: 12,
        totalPages: 3,
      },
    });
  });

  it.each([
    ["true", true],
    [true, true],
    ["false", false],
    [false, false],
  ])("filters by read state %s", async (isRead, expected) => {
    await notificationService.getMyNotifications({ userId, isRead });

    expect(mocks.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: { userId, isRead: expected },
      }),
    );
    expect(mocks.countAll).toHaveBeenNthCalledWith(1, {
      filter: { userId, isRead: expected },
    });
  });

  it("ignores an empty read-state filter and normalizes invalid pagination", async () => {
    const result = await notificationService.getMyNotifications({
      userId,
      isRead: "",
      page: 0,
      limit: "invalid",
    });

    expect(mocks.findAll).toHaveBeenCalledWith({
      filter: { userId },
      skip: 0,
      limit: 10,
      sort: { createdAt: -1 },
    });
    expect(result.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 12,
      totalPages: 2,
    });
  });
});

describe("notificationService.markAsRead", () => {
  it("marks a notification as read only for its owner", async () => {
    const result = await notificationService.markAsRead({
      notificationId,
      userId,
    });

    expect(mocks.findById).toHaveBeenCalledWith(notificationId);
    expect(mocks.markAsRead).toHaveBeenCalledWith(notificationId);
    expect(result.isRead).toBe(true);
  });

  it("rejects when the notification does not exist", async () => {
    mocks.findById.mockResolvedValue(null);

    await expect(
      notificationService.markAsRead({ notificationId, userId }),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Không tìm thấy thông báo",
    });
    expect(mocks.markAsRead).not.toHaveBeenCalled();
  });

  it("denies users access to another user's notification", async () => {
    mocks.findById.mockResolvedValue({
      ...notification,
      userId: "another-user",
    });

    await expect(
      notificationService.markAsRead({ notificationId, userId }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "Bạn không có quyền truy cập thông báo này",
    });
    expect(mocks.markAsRead).not.toHaveBeenCalled();
  });
});

describe("notificationService.markAllAsRead", () => {
  it("marks all unread notifications for the current user as read", async () => {
    const result = await notificationService.markAllAsRead({ userId });

    expect(mocks.markAllAsRead).toHaveBeenCalledWith(userId);
    expect(result).toEqual({ modifiedCount: 3 });
  });
});
