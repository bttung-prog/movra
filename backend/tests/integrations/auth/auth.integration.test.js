import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import ApiError from "../../../src/utils/ApiError.js";

const authServiceMock = vi.hoisted(() => ({
  register: vi.fn(),
  verifyRegisterOtp: vi.fn(),
  requestPasswordResetOtp: vi.fn(),
  resetPasswordWithOtp: vi.fn(),
  changePassword: vi.fn(),
  login: vi.fn(),
  refreshAccessToken: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("../../../src/modules/auth/auth.service.js", () => ({
  default: authServiceMock,
}));

import app from "../../../src/app.js";

describe("Auth API integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends an OTP to verify a new customer registration", async () => {
    authServiceMock.register.mockResolvedValue({
      email: "customer@example.com",
    });

    const response = await request(app)
      .post("/api/v1/auth/register")
      .set("Origin", "http://localhost:5173")
      .send({
        email: "customer@example.com",
        password: "customer123",
        fullName: "Test Customer",
        phone: "0123456789",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual({
      email: "customer@example.com",
    });
    expect(authServiceMock.register).toHaveBeenCalledWith({
      email: "customer@example.com",
      password: "customer123",
      fullName: "Test Customer",
      phone: "0123456789",
    });
  });

  it("creates a customer after registration OTP verification", async () => {
    authServiceMock.verifyRegisterOtp.mockResolvedValue({
    _id: "user-1",
    email: "customer@example.com",
    fullName: "Test Customer",
    role: "customer",
    status: "active",
    });

    const response = await request(app)
    .post("/api/v1/auth/register/verify-otp")
    .set("Origin", "http://localhost:5173")
    .send({
      email: "customer@example.com",
      otp: "12345678",
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(authServiceMock.verifyRegisterOtp).toHaveBeenCalledWith({
    email: "customer@example.com",
    otp: "12345678",
    });
  });

  it("rejects malformed registration OTPs before calling the service", async () => {
    const response = await request(app)
    .post("/api/v1/auth/register/verify-otp")
    .set("Origin", "http://localhost:5173")
    .send({
      email: "customer@example.com",
      otp: "1234",
    });

    expect(response.status).toBe(400);
    expect(authServiceMock.verifyRegisterOtp).not.toHaveBeenCalled();
  });

  it("requests a password-reset OTP", async () => {
    authServiceMock.requestPasswordResetOtp.mockResolvedValue(undefined);

    const response = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: "customer@example.com" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(authServiceMock.requestPasswordResetOtp).toHaveBeenCalledWith({
      email: "customer@example.com",
    });
  });

  it("resets a password with a valid OTP payload", async () => {
    authServiceMock.resetPasswordWithOtp.mockResolvedValue(undefined);

    const response = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({
        email: "customer@example.com",
        otp: "12345678",
        newPassword: "new-password",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(authServiceMock.resetPasswordWithOtp).toHaveBeenCalledWith({
      email: "customer@example.com",
      otp: "12345678",
      newPassword: "new-password",
    });
  });

  it("requires authentication to change a password", async () => {
    const response = await request(app)
      .patch("/api/v1/auth/change-password")
      .send({
        oldPassword: "old-password",
        newPassword: "new-password",
      });

    expect(response.status).toBe(401);
    expect(authServiceMock.changePassword).not.toHaveBeenCalled();
  });

  it("rejects invalid register payload before calling the service", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .set("Origin", "http://localhost:5173")
      .send({
        email: "invalid-email",
        password: "123",
        fullName: "",
        phone: "abc",
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(authServiceMock.register).not.toHaveBeenCalled();
  });

  it("logs in a valid user and sets the refresh token cookie", async () => {
    authServiceMock.login.mockResolvedValue({
      user: {
        _id: "user-1",
        email: "customer@example.com",
        fullName: "Test Customer",
        role: "customer",
        status: "active",
        customerId: "customer-1",
      },
      tokens: {
        accessToken: "access-token",
        refreshToken: "refresh-token",
      },
    });

    const response = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", "http://localhost:5173")
      .send({
        email: "customer@example.com",
        password: "customer123",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual({
      user: {
        _id: "user-1",
        email: "customer@example.com",
        fullName: "Test Customer",
        role: "customer",
        status: "active",
        customerId: "customer-1",
      },
      tokens: {
        accessToken: "access-token",
      },
    });
    expect(response.headers["set-cookie"]).toEqual(
      expect.arrayContaining([
        expect.stringContaining("refreshToken=refresh-token"),
      ]),
    );
    expect(authServiceMock.login).toHaveBeenCalledWith({
      email: "customer@example.com",
      password: "customer123",
    });
  });

  it("rejects invalid login payloads before calling the service", async () => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", "http://localhost:5173")
      .send({
        email: "not-an-email",
        password: "123",
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(authServiceMock.login).not.toHaveBeenCalled();
  });

  it("blocks requests from untrusted origins", async () => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", "http://evil.com")
      .send({
        email: "customer@example.com",
        password: "customer123",
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(authServiceMock.login).not.toHaveBeenCalled();
  });

  it("refreshes access tokens with a valid stored refresh token", async () => {
    authServiceMock.refreshAccessToken.mockResolvedValue({
      accessToken: "new-access-token",
    });

    const response = await request(app)
      .post("/api/v1/auth/refresh-token")
      .set("Origin", "http://localhost:5173")
      .set("Cookie", "refreshToken=refresh-token");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual({
      accessToken: "new-access-token",
    });
    expect(authServiceMock.refreshAccessToken).toHaveBeenCalledWith(
      "refresh-token",
    );
  });

  it("returns an error when the refresh token is invalid or expired", async () => {
    authServiceMock.refreshAccessToken.mockRejectedValue(
      new ApiError(401, "Invalid or expired refresh token"),
    );

    const response = await request(app)
      .post("/api/v1/auth/refresh-token")
      .set("Origin", "http://localhost:5173")
      .set("Cookie", "refreshToken=bad-token");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Invalid or expired refresh token");
  });

  it("logs out the user and clears the refresh token cookie", async () => {
    authServiceMock.logout.mockResolvedValue(undefined);

    const response = await request(app)
      .post("/api/v1/auth/logout")
      .set("Origin", "http://localhost:5173")
      .set("Cookie", "refreshToken=refresh-token");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(authServiceMock.logout).toHaveBeenCalledWith("refresh-token");
    expect(response.headers["set-cookie"]).toEqual(
      expect.arrayContaining([expect.stringContaining("refreshToken=")]),
    );
  });

  it("returns success when logout is called without a refresh token cookie", async () => {
    const response = await request(app)
      .post("/api/v1/auth/logout")
      .set("Origin", "http://localhost:5173");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(authServiceMock.logout).not.toHaveBeenCalled();
  });
});
