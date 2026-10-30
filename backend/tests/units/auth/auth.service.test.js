import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createWithHashedPassword: vi.fn(),
  getUserByEmail: vi.fn(),
  getUserByPhone: vi.fn(),
  getUserById: vi.fn(),
  getUserByIdWithStatus: vi.fn(),
  getPasswordHash: vi.fn(),
  updatePasswordHash: vi.fn(),
  updateLastLoginAt: vi.fn(),
  comparePassword: vi.fn(),
  hashPassword: vi.fn(),
  generateOtp: vi.fn(),
  sendRegisterOtpEmail: vi.fn(),
  sendPasswordResetOtpEmail: vi.fn(),
  generateAccessToken: vi.fn(),
  generateRefreshToken: vi.fn(),
  verifyRefreshToken: vi.fn(),
  createRefreshToken: vi.fn(),
  findRefreshToken: vi.fn(),
  deleteRefreshToken: vi.fn(),
  deleteRefreshTokenByUserId: vi.fn(),
  createRegisterOtp: vi.fn(),
  findRegisterOtpByEmail: vi.fn(),
  deleteRegisterOtpByEmail: vi.fn(),
  incrementRegisterOtpAttempts: vi.fn(),
  consumeRegisterOtp: vi.fn(),
  createPasswordResetOtp: vi.fn(),
  findPasswordResetOtpByEmail: vi.fn(),
  deletePasswordResetOtpByEmail: vi.fn(),
  incrementPasswordResetOtpAttempts: vi.fn(),
  consumePasswordResetOtp: vi.fn(),
  getCustomerByUserId: vi.fn(),
  getDriverByUserId: vi.fn(),
  getStaffByUserId: vi.fn(),
  getDispatcherByUserId: vi.fn(),
}));

vi.mock("../../../src/modules/user/user.service.js", () => ({
  default: {
    createWithHashedPassword: mocks.createWithHashedPassword,
    getByEmail: mocks.getUserByEmail,
    getByPhone: mocks.getUserByPhone,
    getById: mocks.getUserById,
    getByIdWithStatus: mocks.getUserByIdWithStatus,
    getPasswordHash: mocks.getPasswordHash,
    updatePasswordHash: mocks.updatePasswordHash,
    updateLastLoginAt: mocks.updateLastLoginAt,
  },
}));

vi.mock("../../../src/utils/password.js", () => ({
  comparePassword: mocks.comparePassword,
  hashPassword: mocks.hashPassword,
}));

vi.mock("../../../src/utils/generateCode.js", () => ({
  default: vi.fn(),
  generateOtp: mocks.generateOtp,
}));

vi.mock("../../../src/utils/email.js", () => ({
  default: {
    sendRegisterOtpEmail: mocks.sendRegisterOtpEmail,
    sendPasswordResetOtpEmail: mocks.sendPasswordResetOtpEmail,
  },
  sendRegisterOtpEmail: mocks.sendRegisterOtpEmail,
  sendPasswordResetOtpEmail: mocks.sendPasswordResetOtpEmail,
}));

vi.mock("../../../src/utils/jwt.js", () => ({
  generateAccessToken: mocks.generateAccessToken,
  generateRefreshToken: mocks.generateRefreshToken,
  verifyRefreshToken: mocks.verifyRefreshToken,
}));

vi.mock("../../../src/modules/auth/auth.repository.js", () => ({
  default: {
    createRefreshToken: mocks.createRefreshToken,
    findRefreshToken: mocks.findRefreshToken,
    deleteRefreshToken: mocks.deleteRefreshToken,
    deleteRefreshTokenByUserId: mocks.deleteRefreshTokenByUserId,
    createRegisterOtp: mocks.createRegisterOtp,
    findRegisterOtpByEmail: mocks.findRegisterOtpByEmail,
    deleteRegisterOtpByEmail: mocks.deleteRegisterOtpByEmail,
    incrementRegisterOtpAttempts: mocks.incrementRegisterOtpAttempts,
    consumeRegisterOtp: mocks.consumeRegisterOtp,
    createPasswordResetOtp: mocks.createPasswordResetOtp,
    findPasswordResetOtpByEmail: mocks.findPasswordResetOtpByEmail,
    deletePasswordResetOtpByEmail: mocks.deletePasswordResetOtpByEmail,
    incrementPasswordResetOtpAttempts:
      mocks.incrementPasswordResetOtpAttempts,
    consumePasswordResetOtp: mocks.consumePasswordResetOtp,
  },
}));

vi.mock("../../../src/modules/customer/customer.service.js", () => ({
  default: { getByUserId: mocks.getCustomerByUserId },
}));

vi.mock("../../../src/modules/driver/driver.service.js", () => ({
  default: { getByUserId: mocks.getDriverByUserId },
}));

vi.mock("../../../src/modules/staff/staff.service.js", () => ({
  default: { getByUserId: mocks.getStaffByUserId },
}));

vi.mock("../../../src/modules/dispatcher/dispatcher.service.js", () => ({
  default: { getByUserId: mocks.getDispatcherByUserId },
}));

import {
  AUTH_MESSAGES,
  USER_MESSAGES,
} from "../../../src/constants/messages.js";
import ROLES from "../../../src/constants/roles.js";
import USER_STATUSES from "../../../src/constants/userStatuses.js";
import ApiError from "../../../src/utils/ApiError.js";
import authService from "../../../src/modules/auth/auth.service.js";

const activeUser = {
  _id: "user-1",
  email: "customer@example.com",
  fullName: "Test Customer",
  role: ROLES.CUSTOMER,
  status: USER_STATUSES.ACTIVE,
  password: "hashed-password",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.generateAccessToken.mockReturnValue("access-token");
  mocks.generateRefreshToken.mockReturnValue("refresh-token");
  mocks.generateOtp.mockReturnValue("12345678");
  mocks.hashPassword.mockResolvedValue("hashed-password");
  mocks.comparePassword.mockResolvedValue(true);
  mocks.getUserById.mockResolvedValue(activeUser);
  mocks.getPasswordHash.mockResolvedValue({ password: "old-hash" });
  mocks.updatePasswordHash.mockResolvedValue(activeUser);
  mocks.getCustomerByUserId.mockResolvedValue({ _id: "customer-1" });
});

describe("authService password management", () => {
  it("does not expose arbitrary password reset by user ID", () => {
    expect(authService.resetPassword).toBeUndefined();
  });

  it("hashes and delegates password-backed user creation", async () => {
    mocks.createWithHashedPassword.mockResolvedValue(activeUser);

    await expect(
      authService.createUser({
        email: activeUser.email,
        password: "plain-password",
        fullName: activeUser.fullName,
        phone: "0123456789",
      }),
    ).resolves.toEqual(activeUser);

    expect(mocks.hashPassword).toHaveBeenCalledWith("plain-password");
    expect(mocks.createWithHashedPassword).toHaveBeenCalledWith({
      email: activeUser.email,
      fullName: activeUser.fullName,
      phone: "0123456789",
      passwordHash: "hashed-password",
    });
  });

  it("validates the old password before changing it and revokes refresh tokens", async () => {
    await authService.changePassword(
      activeUser._id,
      "old-password",
      "new-password",
    );

    expect(mocks.comparePassword).toHaveBeenCalledWith(
      "old-password",
      "old-hash",
    );
    expect(mocks.hashPassword).toHaveBeenCalledWith("new-password");
    expect(mocks.updatePasswordHash).toHaveBeenCalledWith(
      activeUser._id,
      "hashed-password",
    );
    expect(mocks.deleteRefreshTokenByUserId).toHaveBeenCalledWith(
      activeUser._id,
    );
  });

  it("rejects password changes when the old password is incorrect", async () => {
    mocks.comparePassword.mockResolvedValue(false);

    await expect(
      authService.changePassword(
        activeUser._id,
        "wrong-password",
        "new-password",
      ),
    ).rejects.toMatchObject({
      statusCode: 401,
      message: USER_MESSAGES.OLD_PASSWORD_INCORRECT,
    });
    expect(mocks.updatePasswordHash).not.toHaveBeenCalled();
  });

  it("updates last login through the user service", async () => {
    await authService.updateLastLoginAt(activeUser._id);

    expect(mocks.updateLastLoginAt).toHaveBeenCalledWith(activeUser._id);
  });
});

describe("authService.register", () => {
  it("stores a hashed registration and sends an OTP without creating the account", async () => {
    mocks.getUserByEmail.mockResolvedValue(null);
    mocks.getUserByPhone.mockResolvedValue(null);
    mocks.createRegisterOtp.mockResolvedValue({});
    mocks.sendRegisterOtpEmail.mockResolvedValue({});

    await expect(
      authService.register({
        email: activeUser.email,
        password: "plain-password",
        fullName: activeUser.fullName,
        phone: "0123456789",
      }),
    ).resolves.toEqual({
      email: activeUser.email,
    });
    expect(mocks.createRegisterOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: activeUser.email,
        otp: "12345678",
        pendingRegistration: {
          passwordHash: "hashed-password",
          fullName: activeUser.fullName,
          phone: "0123456789",
        },
      }),
    );
    expect(mocks.sendRegisterOtpEmail).toHaveBeenCalledWith(
      activeUser.email,
      "12345678",
    );
    expect(mocks.createWithHashedPassword).not.toHaveBeenCalled();
  });

  it("creates an account only after consuming a valid OTP", async () => {
    const savedOtp = {
      otp: "12345678",
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
      pendingRegistration: {
        passwordHash: "hashed-password",
        fullName: activeUser.fullName,
        phone: "0123456789",
      },
    };
    mocks.findRegisterOtpByEmail.mockResolvedValue(savedOtp);
    mocks.consumeRegisterOtp.mockResolvedValue(savedOtp);
    mocks.createWithHashedPassword.mockResolvedValue({
      ...activeUser,
      phone: "0123456789",
    });

    await expect(
      authService.verifyRegisterOtp({
        email: activeUser.email,
        otp: "12345678",
      }),
    ).resolves.toEqual({
      _id: activeUser._id,
      email: activeUser.email,
      fullName: activeUser.fullName,
      phone: "0123456789",
      role: ROLES.CUSTOMER,
      status: USER_STATUSES.ACTIVE,
    });
    expect(mocks.consumeRegisterOtp).toHaveBeenCalledWith(
      activeUser.email,
      "12345678",
    );
    expect(mocks.createWithHashedPassword).toHaveBeenCalledWith({
      email: activeUser.email,
      ...savedOtp.pendingRegistration,
      role: ROLES.CUSTOMER,
    });
  });

  it("increments attempts and rejects an incorrect OTP", async () => {
    mocks.findRegisterOtpByEmail.mockResolvedValue({
      otp: "12345678",
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
    });
    mocks.incrementRegisterOtpAttempts.mockResolvedValue({});

    await expect(
      authService.verifyRegisterOtp({
        email: activeUser.email,
        otp: "87654321",
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: AUTH_MESSAGES.INVALID_OR_EXPIRED_OTP,
    });
    expect(mocks.incrementRegisterOtpAttempts).toHaveBeenCalledWith(
      activeUser.email,
    );
    expect(mocks.consumeRegisterOtp).not.toHaveBeenCalled();
  });
});

describe("authService password reset OTP", () => {
  it("sends a reset OTP for an existing account", async () => {
    mocks.getUserByEmail.mockResolvedValue(activeUser);
    mocks.createPasswordResetOtp.mockResolvedValue({});
    mocks.sendPasswordResetOtpEmail.mockResolvedValue({});

    await expect(
      authService.requestPasswordResetOtp({ email: activeUser.email }),
    ).resolves.toBeUndefined();
    expect(mocks.createPasswordResetOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: activeUser.email,
        otp: "12345678",
      }),
    );
    expect(mocks.sendPasswordResetOtpEmail).toHaveBeenCalledWith(
      activeUser.email,
      "12345678",
    );
  });

  it("does not reveal whether the requested email exists", async () => {
    mocks.getUserByEmail.mockResolvedValue(null);

    await expect(
      authService.requestPasswordResetOtp({ email: activeUser.email }),
    ).resolves.toBeUndefined();
    expect(mocks.createPasswordResetOtp).not.toHaveBeenCalled();
    expect(mocks.sendPasswordResetOtpEmail).not.toHaveBeenCalled();
  });

  it("resets the password after consuming a valid OTP", async () => {
    const savedOtp = {
      otp: "12345678",
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
    };
    mocks.getUserByEmail.mockResolvedValue(activeUser);
    mocks.findPasswordResetOtpByEmail.mockResolvedValue(savedOtp);
    mocks.consumePasswordResetOtp.mockResolvedValue(savedOtp);

    await expect(
      authService.resetPasswordWithOtp({
        email: activeUser.email,
        otp: "12345678",
        newPassword: "new-password",
      }),
    ).resolves.toBeUndefined();
    expect(mocks.consumePasswordResetOtp).toHaveBeenCalledWith(
      activeUser.email,
      "12345678",
    );
    expect(mocks.hashPassword).toHaveBeenCalledWith("new-password");
    expect(mocks.updatePasswordHash).toHaveBeenCalledWith(
      activeUser._id,
      "hashed-password",
    );
    expect(mocks.deleteRefreshTokenByUserId).toHaveBeenCalledWith(
      activeUser._id,
    );
  });
});

describe("authService.login", () => {
  it("rejects when the user does not exist", async () => {
    mocks.getUserByEmail.mockResolvedValue(null);

    await expect(
      authService.login({ email: activeUser.email, password: "password" }),
    ).rejects.toMatchObject({
      statusCode: 401,
      message: AUTH_MESSAGES.INVALID_CREDENTIALS,
    });
    expect(mocks.comparePassword).not.toHaveBeenCalled();
  });

  it("rejects inactive accounts before checking the password", async () => {
    mocks.getUserByEmail.mockResolvedValue({
      ...activeUser,
      status: USER_STATUSES.LOCKED,
    });

    await expect(
      authService.login({ email: activeUser.email, password: "password" }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: AUTH_MESSAGES.ACCOUNT_INACTIVE_OR_LOCKED,
    });
    expect(mocks.comparePassword).not.toHaveBeenCalled();
  });

  it("rejects an incorrect password", async () => {
    mocks.getUserByEmail.mockResolvedValue(activeUser);
    mocks.comparePassword.mockResolvedValue(false);

    await expect(
      authService.login({ email: activeUser.email, password: "wrong" }),
    ).rejects.toMatchObject({
      statusCode: 401,
      message: AUTH_MESSAGES.INVALID_CREDENTIALS,
    });
    expect(mocks.createRefreshToken).not.toHaveBeenCalled();
  });

  it("issues tokens, persists the refresh token, and updates last login", async () => {
    mocks.getUserByEmail.mockResolvedValue(activeUser);

    await expect(
      authService.login({ email: activeUser.email, password: "password" }),
    ).resolves.toEqual({
      user: {
        _id: activeUser._id,
        email: activeUser.email,
        fullName: activeUser.fullName,
        role: activeUser.role,
        status: activeUser.status,
        customerId: "customer-1",
      },
      tokens: {
        accessToken: "access-token",
        refreshToken: "refresh-token",
      },
    });
    expect(mocks.comparePassword).toHaveBeenCalledWith(
      "password",
      activeUser.password,
    );
    expect(mocks.generateAccessToken).toHaveBeenCalledWith({
      userId: activeUser._id,
      role: ROLES.CUSTOMER,
      customerId: "customer-1",
    });
    expect(mocks.generateRefreshToken).toHaveBeenCalledWith({
      userId: activeUser._id,
      role: ROLES.CUSTOMER,
      customerId: "customer-1",
    });
    expect(mocks.createRefreshToken).toHaveBeenCalledWith(
      activeUser._id,
      "refresh-token",
    );
    expect(mocks.updateLastLoginAt).toHaveBeenCalledWith(activeUser._id);
  });
});

describe("authService.refreshAccessToken", () => {
  it("rejects an invalid refresh token", async () => {
    mocks.verifyRefreshToken.mockImplementation(() => {
      throw new Error("invalid token");
    });

    await expect(
      authService.refreshAccessToken("bad-token"),
    ).rejects.toMatchObject({
      statusCode: 401,
      message: AUTH_MESSAGES.INVALID_OR_EXPIRED_REFRESH_TOKEN,
    });
    expect(mocks.findRefreshToken).not.toHaveBeenCalled();
    expect(mocks.deleteRefreshToken).not.toHaveBeenCalled();
  });

  it("deletes an expired refresh token before rejecting it", async () => {
    mocks.verifyRefreshToken.mockImplementation(() => {
      const error = new Error("jwt expired");
      error.name = "TokenExpiredError";
      throw error;
    });

    await expect(
      authService.refreshAccessToken("expired-refresh-token"),
    ).rejects.toMatchObject({
      statusCode: 401,
      message: AUTH_MESSAGES.INVALID_OR_EXPIRED_REFRESH_TOKEN,
    });
    expect(mocks.deleteRefreshToken).toHaveBeenCalledWith(
      "expired-refresh-token",
    );
    expect(mocks.findRefreshToken).not.toHaveBeenCalled();
  });

  it("rejects a refresh token that is not stored", async () => {
    mocks.verifyRefreshToken.mockReturnValue({ userId: "user-1" });
    mocks.findRefreshToken.mockResolvedValue(null);

    await expect(
      authService.refreshAccessToken("refresh-token"),
    ).rejects.toMatchObject({
      statusCode: 401,
      message: AUTH_MESSAGES.INVALID_OR_EXPIRED_REFRESH_TOKEN,
    });
  });

  it("rejects when the stored token belongs to a different user", async () => {
    mocks.verifyRefreshToken.mockReturnValue({ userId: "user-1" });
    mocks.findRefreshToken.mockResolvedValue({
      userId: { toString: () => "user-2" },
    });

    await expect(
      authService.refreshAccessToken("refresh-token"),
    ).rejects.toMatchObject({
      statusCode: 401,
      message: AUTH_MESSAGES.INVALID_OR_EXPIRED_REFRESH_TOKEN,
    });
    expect(mocks.getUserByIdWithStatus).not.toHaveBeenCalled();
  });

  it("rejects when the token user no longer exists", async () => {
    mocks.verifyRefreshToken.mockReturnValue({ userId: "user-1" });
    mocks.findRefreshToken.mockResolvedValue({
      userId: { toString: () => "user-1" },
    });
    mocks.getUserByIdWithStatus.mockResolvedValue(null);

    await expect(
      authService.refreshAccessToken("refresh-token"),
    ).rejects.toMatchObject({
      statusCode: 401,
      message: AUTH_MESSAGES.USER_NOT_FOUND,
    });
  });

  it("rejects inactive users", async () => {
    mocks.verifyRefreshToken.mockReturnValue({ userId: "user-1" });
    mocks.findRefreshToken.mockResolvedValue({
      userId: { toString: () => "user-1" },
    });
    mocks.getUserByIdWithStatus.mockResolvedValue({
      ...activeUser,
      status: USER_STATUSES.INACTIVE,
    });

    await expect(
      authService.refreshAccessToken("refresh-token"),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: AUTH_MESSAGES.ACCOUNT_INACTIVE_OR_LOCKED,
    });
  });

  it("issues a new access token for an active user", async () => {
    mocks.verifyRefreshToken.mockReturnValue({ userId: "user-1" });
    mocks.findRefreshToken.mockResolvedValue({
      userId: { toString: () => "user-1" },
    });
    mocks.getUserByIdWithStatus.mockResolvedValue(activeUser);

    await expect(
      authService.refreshAccessToken("refresh-token"),
    ).resolves.toEqual({ accessToken: "access-token" });
    expect(mocks.generateAccessToken).toHaveBeenCalledWith({
      userId: activeUser._id,
      role: ROLES.CUSTOMER,
      customerId: "customer-1",
    });
  });
});

describe("authService role-specific access", () => {
  it("rejects a driver whose profile is missing", async () => {
    mocks.getUserByEmail.mockResolvedValue({
      ...activeUser,
      role: ROLES.DRIVER,
    });
    mocks.getDriverByUserId.mockRejectedValue(new ApiError(404, "Not found"));

    await expect(
      authService.login({ email: activeUser.email, password: "password" }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: AUTH_MESSAGES.DRIVER_PROFILE_MISSING,
    });
    expect(mocks.generateAccessToken).not.toHaveBeenCalled();
  });

  it("rejects a driver without an assigned warehouse", async () => {
    mocks.getUserByEmail.mockResolvedValue({
      ...activeUser,
      role: ROLES.DRIVER,
    });
    mocks.getDriverByUserId.mockResolvedValue({
      _id: "driver-1",
      status: USER_STATUSES.ACTIVE,
      warehouseId: null,
    });

    await expect(
      authService.login({ email: activeUser.email, password: "password" }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: AUTH_MESSAGES.DRIVER_NO_WAREHOUSE,
    });
  });
});

describe("authService logout and token revocation", () => {
  it("deletes a refresh token when logging out", async () => {
    await authService.logout("refresh-token");

    expect(mocks.deleteRefreshToken).toHaveBeenCalledWith("refresh-token");
  });

  it("revokes a user's refresh token", async () => {
    await authService.revokeRefreshTokenByUserId("user-1");

    expect(mocks.deleteRefreshTokenByUserId).toHaveBeenCalledWith("user-1");
  });
});
