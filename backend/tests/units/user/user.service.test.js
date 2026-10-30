import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findById: vi.fn(),
  findByEmail: vi.fn(),
  findByPhone: vi.fn(),
  findPassword: vi.fn(),
  findAll: vi.fn(),
  countAll: vi.fn(),
  search: vi.fn(),
  searchPaginated: vi.fn(),
  countSearch: vi.fn(),
  updateById: vi.fn(),
  customerCreate: vi.fn(),
  driverCreate: vi.fn(),
  staffCreate: vi.fn(),
  dispatcherCreate: vi.fn(),
  getCustomerByUserId: vi.fn(),
  getDriverByUserId: vi.fn(),
  getStaffByUserId: vi.fn(),
  getDispatcherByUserId: vi.fn(),
  updateDispatcherStatus: vi.fn(),
}));

vi.mock("../../../src/modules/user/user.repository.js", () => ({
  default: {
    create: mocks.create,
    findById: mocks.findById,
    findByEmail: mocks.findByEmail,
    findByPhone: mocks.findByPhone,
    findPassword: mocks.findPassword,
    findAll: mocks.findAll,
    countAll: mocks.countAll,
    search: mocks.search,
    searchPaginated: mocks.searchPaginated,
    countSearch: mocks.countSearch,
    updateById: mocks.updateById,
  },
}));

vi.mock("../../../src/modules/customer/customer.service.js", () => ({
  default: {
    create: mocks.customerCreate,
    getByUserId: mocks.getCustomerByUserId,
  },
}));

vi.mock("../../../src/modules/driver/driver.service.js", () => ({
  default: {
    create: mocks.driverCreate,
    getByUserId: mocks.getDriverByUserId,
  },
}));

vi.mock("../../../src/modules/staff/staff.service.js", () => ({
  default: {
    create: mocks.staffCreate,
    getByUserId: mocks.getStaffByUserId,
  },
}));

vi.mock("../../../src/modules/dispatcher/dispatcher.service.js", () => ({
  default: {
    create: mocks.dispatcherCreate,
    getByUserId: mocks.getDispatcherByUserId,
    updateStatus: mocks.updateDispatcherStatus,
  },
}));

import {
  COMMON_MESSAGES,
  USER_MESSAGES,
} from "../../../src/constants/messages.js";
import ROLES from "../../../src/constants/roles.js";
import USER_STATUSES from "../../../src/constants/userStatuses.js";
import userService from "../../../src/modules/user/user.service.js";

const userId = "user-1";
const user = {
  _id: userId,
  email: "user@example.com",
  phone: "0123456789",
  fullName: "Test User",
  role: ROLES.CUSTOMER,
  status: USER_STATUSES.ACTIVE,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findById.mockResolvedValue(user);
  mocks.findByEmail.mockResolvedValue(null);
  mocks.findByPhone.mockResolvedValue(null);
  mocks.findPassword.mockResolvedValue({ password: "stored-hash" });
  mocks.findAll.mockResolvedValue([user]);
  mocks.countAll.mockResolvedValue(21);
  mocks.search.mockResolvedValue([user]);
  mocks.searchPaginated.mockResolvedValue([user]);
  mocks.countSearch.mockResolvedValue(21);
  mocks.updateById.mockResolvedValue(user);
});

describe("userService.createWithHashedPassword", () => {
  it("requires role-specific profile data before creating staff accounts", async () => {
    await expect(
      userService.createWithHashedPassword({
        email: "driver@example.com",
        passwordHash: "hashed-password",
        phone: "0123456789",
        fullName: "Driver",
        role: ROLES.DRIVER,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: USER_MESSAGES.DRIVER_DATA_REQUIRED,
    });

    await expect(
      userService.createWithHashedPassword({
        email: "staff@example.com",
        passwordHash: "hashed-password",
        phone: "0123456789",
        fullName: "Staff",
        role: ROLES.WAREHOUSE_STAFF,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: USER_MESSAGES.STAFF_DATA_REQUIRED,
    });

    await expect(
      userService.createWithHashedPassword({
        email: "dispatcher@example.com",
        passwordHash: "hashed-password",
        phone: "0123456789",
        fullName: "Dispatcher",
        role: ROLES.DISPATCHER,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: USER_MESSAGES.DISPATCHER_DATA_REQUIRED,
    });

    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects duplicate normalized emails and phone numbers", async () => {
    mocks.findByEmail.mockResolvedValueOnce(user);
    await expect(
      userService.createWithHashedPassword({
        email: " User@Example.com ",
        passwordHash: "hashed-password",
        phone: "0123456789",
        fullName: "Test User",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: USER_MESSAGES.EMAIL_EXISTS,
    });
    expect(mocks.findByEmail).toHaveBeenCalledWith("user@example.com");

    mocks.findByPhone.mockResolvedValueOnce(user);
    await expect(
      userService.createWithHashedPassword({
        email: "new@example.com",
        passwordHash: "hashed-password",
        phone: " 0123456789 ",
        fullName: "Test User",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: USER_MESSAGES.PHONE_EXISTS,
    });
    expect(mocks.findByPhone).toHaveBeenCalledWith("0123456789");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects incomplete account data", async () => {
    await expect(
      userService.createWithHashedPassword({
        email: "user@example.com",
        passwordHash: "",
        phone: "0123456789",
        fullName: "Test User",
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: COMMON_MESSAGES.ALL_FIELDS_REQUIRED,
    });
  });
});

describe("userService.updateMe", () => {
  it("trims profile fields and permits retaining the current phone number", async () => {
    mocks.findByPhone.mockResolvedValue(user);

    await userService.updateMe(userId, {
      phone: " 0123456789 ",
      fullName: "  Updated Name ",
    });

    expect(mocks.updateById).toHaveBeenCalledWith(userId, {
      phone: "0123456789",
      fullName: "Updated Name",
    });
  });

  it("rejects another user's phone number and missing user records", async () => {
    mocks.findByPhone.mockResolvedValueOnce({ _id: "another-user" });
    await expect(
      userService.updateMe(userId, { phone: "0987654321" }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: USER_MESSAGES.PHONE_EXISTS,
    });
    expect(mocks.updateById).not.toHaveBeenCalled();

    mocks.updateById.mockResolvedValueOnce(null);
    await expect(
      userService.updateMe(userId, { fullName: "Updated Name" }),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: USER_MESSAGES.NOT_FOUND,
    });
  });
});

describe("userService authentication data access", () => {
  it("retrieves a password hash by user ID", async () => {
    await expect(userService.getPasswordHash(userId)).resolves.toEqual({
      password: "stored-hash",
    });

    expect(mocks.findPassword).toHaveBeenCalledWith(userId);
  });

  it("updates password hash and increments token version", async () => {
    await userService.updatePasswordHash(userId, "new-hash");

    expect(mocks.updateById).toHaveBeenCalledWith(userId, {
      $set: { password: "new-hash" },
      $inc: { tokenVersion: 1 },
    });
  });

  it("updates the last login timestamp", async () => {
    await userService.updateLastLoginAt(userId);

    expect(mocks.updateById).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({ lastLoginAt: expect.any(Date) }),
    );
  });
});

describe("userService.searchPaginated", () => {
  it("escapes search text and returns filtered pagination", async () => {
    const result = await userService.searchPaginated("  A+B ", {
      page: 2,
      limit: 5,
      filter: { role: ROLES.CUSTOMER },
    });

    expect(mocks.searchPaginated).toHaveBeenCalledWith("A\\+B", {
      skip: 5,
      limit: 5,
      filter: { role: ROLES.CUSTOMER },
    });
    expect(mocks.countSearch).toHaveBeenCalledWith("A\\+B", {
      role: ROLES.CUSTOMER,
    });
    expect(result).toEqual({
      data: [user],
      pagination: {
        page: 2,
        limit: 5,
        totalUsers: 21,
        totalPages: 5,
      },
    });
  });

  it("returns an empty page for a blank search without querying the repository", async () => {
    await expect(
      userService.searchPaginated("   ", { page: 2, limit: 5 }),
    ).resolves.toEqual({
      data: [],
      pagination: {
        page: 2,
        limit: 5,
        totalUsers: 0,
        totalPages: 0,
      },
    });

    expect(mocks.searchPaginated).not.toHaveBeenCalled();
    expect(mocks.countSearch).not.toHaveBeenCalled();
  });
});

describe("userService.updateById and updateRole preconditions", () => {
  it("requires dedicated operations to change role or status", async () => {
    for (const updateData of [
      { role: ROLES.DRIVER },
      { status: USER_STATUSES.LOCKED },
    ]) {
      await expect(
        userService.updateById(userId, updateData),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: USER_MESSAGES.ROLE_STATUS_CHANGE_REQUIRES_DEDICATED_OPERATION,
      });
    }

    expect(mocks.updateById).not.toHaveBeenCalled();
  });

  it("rejects an email already belonging to a different user", async () => {
    mocks.findByEmail.mockResolvedValueOnce({ _id: "another-user" });

    await expect(
      userService.updateById(userId, { email: " OTHER@EXAMPLE.COM " }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: USER_MESSAGES.EMAIL_EXISTS,
    });

    expect(mocks.findByEmail).toHaveBeenCalledWith("other@example.com");
    expect(mocks.updateById).not.toHaveBeenCalled();
  });

  it("requires an active user before assigning the dispatcher role", async () => {
    mocks.findById.mockResolvedValueOnce({
      ...user,
      status: USER_STATUSES.INACTIVE,
    });

    await expect(
      userService.updateRole(userId, ROLES.DISPATCHER, {
        dispatcherData: { warehouseId: "warehouse-1" },
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: USER_MESSAGES.DISPATCHER_USER_NOT_ACTIVE,
    });
  });

  it("requires driver profile data before assigning the driver role", async () => {
    await expect(
      userService.updateRole(userId, ROLES.DRIVER),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: USER_MESSAGES.DRIVER_DATA_REQUIRED,
    });
  });
});
