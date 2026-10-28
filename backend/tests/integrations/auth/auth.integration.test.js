import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import ApiError from "../../../src/utils/ApiError.js";

const authServiceMock = vi.hoisted(() => ({
  register: vi.fn(),
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

  it("registers a new customer account", async () => {
    authServiceMock.register.mockResolvedValue({
      _id: "user-1",
      email: "customer@example.com",
      fullName: "Test Customer",
      role: "customer",
      status: "active",
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

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual({
      _id: "user-1",
      email: "customer@example.com",
      fullName: "Test Customer",
      role: "customer",
      status: "active",
    });
    expect(authServiceMock.register).toHaveBeenCalledWith({
      email: "customer@example.com",
      password: "customer123",
      fullName: "Test Customer",
      phone: "0123456789",
    });
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
