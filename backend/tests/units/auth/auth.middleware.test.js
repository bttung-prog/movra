import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyAccessToken: vi.fn(),
}));

vi.mock("../../../src/utils/jwt.js", () => ({
  verifyAccessToken: mocks.verifyAccessToken,
}));

import authMiddleware from "../../../src/middlewares/auth.middleware.js";

describe("authMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the token payload as the request user", async () => {
    const payload = {
      userId: "user-1",
      role: "driver",
      driverId: "driver-1",
      warehouseId: "warehouse-1",
    };
    mocks.verifyAccessToken.mockReturnValue(payload);
    const req = { headers: { authorization: "Bearer access-token" } };
    const next = vi.fn();

    await authMiddleware(req, {}, next);

    expect(mocks.verifyAccessToken).toHaveBeenCalledWith("access-token");
    expect(req.user).toEqual(payload);
    expect(req.user).not.toHaveProperty("_id");
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects requests without a bearer token", async () => {
    const req = { headers: {} };
    const next = vi.fn();

    await authMiddleware(req, {}, next);

    const error = next.mock.calls[0][0];
    expect(error).toMatchObject({ statusCode: 401 });
  });
});
