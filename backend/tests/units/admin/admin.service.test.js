import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateById: vi.fn(),
  updateRole: vi.fn(),
  updateStatus: vi.fn(),
}));

vi.mock("../../../src/modules/user/user.service.js", () => ({
  default: {
    updateById: mocks.updateById,
    updateRole: mocks.updateRole,
    updateStatus: mocks.updateStatus,
  },
}));

import { ADMIN_MESSAGES } from "../../../src/constants/messages.js";
import ROLES from "../../../src/constants/roles.js";
import USER_STATUSES from "../../../src/constants/userStatuses.js";
import adminService from "../../../src/modules/admin/admin.service.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("adminService.updateUser", () => {
  it.each([
    ["role", "unknown", ADMIN_MESSAGES.INVALID_ROLE],
    ["status", "unknown", ADMIN_MESSAGES.INVALID_STATUS],
  ])("rejects an invalid %s before updating the user", async (field, value, message) => {
    await expect(
      adminService.updateUser("user-1", { [field]: value }),
    ).rejects.toMatchObject({ statusCode: 400, message });

    expect(mocks.updateById).not.toHaveBeenCalled();
  });
});

describe("adminService.changeRoleUser", () => {
  it("rejects an invalid role without updating the user", async () => {
    await expect(
      adminService.changeRoleUser("user-1", { role: "unknown" }, "admin-1"),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: ADMIN_MESSAGES.INVALID_ROLE,
    });

    expect(mocks.updateRole).not.toHaveBeenCalled();
  });

  it("prevents an admin from demoting themself", async () => {
    await expect(
      adminService.changeRoleUser(
        "admin-1",
        { role: ROLES.CUSTOMER },
        "admin-1",
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: ADMIN_MESSAGES.CANNOT_DEMOTE_SELF,
    });

    expect(mocks.updateRole).not.toHaveBeenCalled();
  });

  it("allows an admin to retain their role and forwards role-specific data", async () => {
    const roleData = {
      role: ROLES.ADMIN,
      dispatcherData: { warehouseId: "warehouse-1" },
    };
    mocks.updateRole.mockResolvedValue({ id: "admin-1", role: ROLES.ADMIN });

    await expect(
      adminService.changeRoleUser("admin-1", roleData, "admin-1"),
    ).resolves.toMatchObject({ role: ROLES.ADMIN });

    expect(mocks.updateRole).toHaveBeenCalledWith("admin-1", ROLES.ADMIN, {
      dispatcherData: roleData.dispatcherData,
    });
  });
});

describe("adminService.changeStatusUser", () => {
  it("rejects invalid statuses without updating the user", async () => {
    await expect(
      adminService.changeStatusUser("user-1", "unknown", "admin-1"),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: ADMIN_MESSAGES.INVALID_STATUS,
    });

    expect(mocks.updateStatus).not.toHaveBeenCalled();
  });

  it("prevents an admin from deactivating or locking themself", async () => {
    for (const status of [USER_STATUSES.INACTIVE, USER_STATUSES.LOCKED]) {
      await expect(
        adminService.changeStatusUser("admin-1", status, "admin-1"),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: ADMIN_MESSAGES.CANNOT_DEACTIVATE_SELF,
      });
    }

    expect(mocks.updateStatus).not.toHaveBeenCalled();
  });

  it("allows an admin to remain active and forwards status changes for other users", async () => {
    mocks.updateStatus.mockResolvedValue({ id: "user-1" });

    await expect(
      adminService.changeStatusUser("admin-1", USER_STATUSES.ACTIVE, "admin-1"),
    ).resolves.toMatchObject({ id: "user-1" });
    await adminService.changeStatusUser(
      "user-1",
      USER_STATUSES.LOCKED,
      "admin-1",
    );

    expect(mocks.updateStatus).toHaveBeenNthCalledWith(
      1,
      "admin-1",
      USER_STATUSES.ACTIVE,
    );
    expect(mocks.updateStatus).toHaveBeenNthCalledWith(
      2,
      "user-1",
      USER_STATUSES.LOCKED,
    );
  });
});
