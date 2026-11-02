import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserById: vi.fn(),
  findByUserId: vi.fn(),
  findByCode: vi.fn(),
  create: vi.fn(),
  generateCode: vi.fn(),
}));

vi.mock("../../../src/modules/user/user.service.js", () => ({
  default: { getById: mocks.getUserById },
}));

vi.mock("../../../src/modules/accountant/accountant.repository.js", () => ({
  default: {
    findByUserId: mocks.findByUserId,
    findByCode: mocks.findByCode,
    create: mocks.create,
  },
}));

vi.mock("../../../src/utils/generateCode.js", () => ({
  default: { generateCode: mocks.generateCode },
}));

import ROLES from "../../../src/constants/roles.js";
import USER_STATUSES from "../../../src/constants/userStatuses.js";
import {
  ACCOUNTANT_MESSAGES,
  USER_MESSAGES,
} from "../../../src/constants/messages.js";
import accountantService from "../../../src/modules/accountant/accountant.service.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUserById.mockResolvedValue({
    role: ROLES.ACCOUNTANT,
    status: USER_STATUSES.ACTIVE,
  });
  mocks.findByUserId.mockResolvedValue(null);
  mocks.findByCode.mockResolvedValue(null);
  mocks.generateCode.mockReturnValue("ACC-12345678");
  mocks.create.mockResolvedValue({
    accountantCode: "ACC-12345678",
    status: "active",
  });
});

describe("accountantService.create", () => {
  it("creates a unique accountant profile for an active accountant user", async () => {
    await expect(
      accountantService.create({ userId: "user-1" }, "session-1"),
    ).resolves.toMatchObject({
      accountantCode: "ACC-12345678",
      status: "active",
    });

    expect(mocks.getUserById).toHaveBeenCalledWith("user-1", "session-1");
    expect(mocks.generateCode).toHaveBeenCalledWith("ACC-");
    expect(mocks.create).toHaveBeenCalledWith(
      {
        userId: "user-1",
        accountantCode: "ACC-12345678",
      },
      "session-1",
    );
  });

  it("rejects users without the accountant role", async () => {
    mocks.getUserById.mockResolvedValueOnce({
      role: ROLES.DISPATCHER,
      status: USER_STATUSES.ACTIVE,
    });

    await expect(
      accountantService.create({ userId: "user-1" }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: USER_MESSAGES.ACCOUNTANT_ROLE_INVALID,
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects duplicate accountant profiles", async () => {
    mocks.findByUserId.mockResolvedValueOnce({ _id: "accountant-1" });

    await expect(
      accountantService.create({ userId: "user-1" }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: ACCOUNTANT_MESSAGES.ALREADY_EXISTS,
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
