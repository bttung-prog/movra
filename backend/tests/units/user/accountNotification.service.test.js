import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createManyNotifications: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("../../../src/modules/notification/notification.service.js", () => ({
  default: { createMany: mocks.createManyNotifications },
}));

vi.mock("../../../src/configs/logger.js", () => ({
  default: { error: mocks.loggerError },
}));

import { ACCOUNT_NOTIFICATION_EVENTS } from "../../../src/constants/accountNotification.js";
import accountNotificationService from "../../../src/modules/user/accountNotification.service.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createManyNotifications.mockResolvedValue([{ _id: "notification-1" }]);
});

describe("accountNotificationService", () => {
  it("notifies the affected user when their role changes", async () => {
    await accountNotificationService.notifyRoleChanged({
      userId: "user-1",
      previousRole: "customer",
      role: "driver",
    });

    expect(mocks.createManyNotifications).toHaveBeenCalledWith([
      expect.objectContaining({
        userId: "user-1",
        type: "ACCOUNT",
        title: "Vai trò tài khoản đã thay đổi",
        data: expect.objectContaining({
          event: ACCOUNT_NOTIFICATION_EVENTS.ACCOUNT_ROLE_CHANGED,
          previousRole: "customer",
          role: "driver",
        }),
      }),
    ]);
  });

  it("does not notify when the role is unchanged", async () => {
    await expect(
      accountNotificationService.notifyRoleChanged({
        userId: "user-1",
        previousRole: "driver",
        role: "driver",
      }),
    ).resolves.toBe(0);

    expect(mocks.createManyNotifications).not.toHaveBeenCalled();
  });

  it("swallows notification persistence failures", async () => {
    mocks.createManyNotifications.mockRejectedValue(new Error("database down"));

    await expect(
      accountNotificationService.notifyRoleChanged({
        userId: "user-1",
        previousRole: "customer",
        role: "driver",
      }),
    ).resolves.toBe(0);
    expect(mocks.loggerError).toHaveBeenCalled();
  });
});
