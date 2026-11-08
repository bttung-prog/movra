import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateHash: vi.fn(),
  findRecord: vi.fn(),
  createProcessingRecord: vi.fn(),
  completeRecord: vi.fn(),
  deleteRecord: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("../../../src/modules/idempotency/idempotency.service.js", () => ({
  default: {
    generateHash: mocks.generateHash,
    findRecord: mocks.findRecord,
    createProcessingRecord: mocks.createProcessingRecord,
    completeRecord: mocks.completeRecord,
    deleteRecord: mocks.deleteRecord,
  },
}));

vi.mock("../../../src/configs/logger.js", () => ({
  default: {
    error: mocks.loggerError,
  },
}));

import { IDEMPOTENCY_STATUSES } from "../../../src/constants/idempotencyStatuses.js";
import idempotency from "../../../src/middlewares/idempotency.middleware.js";

const mockResponse = () => {
  const res = {
    statusCode: 200,
    headers: {},
    status: vi.fn(function (code) {
      this.statusCode = code;
      return this;
    }),
    json: vi.fn(function (data) {
      this.body = data;
      return this;
    }),
    setHeader: vi.fn(function (key, val) {
      this.headers[key] = val;
      return this;
    }),
    on: vi.fn(),
  };
  return res;
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.generateHash.mockReturnValue("hash-abc");
  mocks.completeRecord.mockResolvedValue({});
  mocks.deleteRecord.mockResolvedValue({});
});

describe("idempotency middleware", () => {
  it("passes through when header is omitted and required=false", async () => {
    const middleware = idempotency({ required: false });
    const req = { headers: {} };
    const res = mockResponse();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(mocks.findRecord).not.toHaveBeenCalled();
  });

  it("throws 400 when header is omitted and required=true", async () => {
    const middleware = idempotency({ required: true });
    const req = { headers: {} };
    const res = mockResponse();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: expect.stringContaining("Idempotency-Key"),
      }),
    );
  });

  it("throws 401 when user is not authenticated", async () => {
    const middleware = idempotency();
    const req = {
      headers: { "idempotency-key": "valid-key-123" },
      user: null,
    };
    const res = mockResponse();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
      }),
    );
  });

  it("replays cached response when record is already completed with matching payload", async () => {
    const middleware = idempotency();
    const req = {
      headers: { "idempotency-key": "valid-key-123" },
      user: { userId: "user-1" },
      body: { amount: 50000 },
      originalUrl: "/api/orders",
      method: "POST",
    };
    const res = mockResponse();
    const next = vi.fn();

    const completedRecord = {
      _id: "rec-1",
      userId: "user-1",
      key: "valid-key-123",
      requestHash: "hash-abc",
      status: IDEMPOTENCY_STATUSES.COMPLETED,
      responseStatus: 201,
      responseBody: { success: true, data: { orderCode: "ORD-001" } },
    };
    mocks.findRecord.mockResolvedValue(completedRecord);

    await middleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith("X-Cache-Lookup", "HIT");
    expect(res.setHeader).toHaveBeenCalledWith("Idempotent-Replayed", "true");
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(completedRecord.responseBody);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 409 Conflict when request is still processing", async () => {
    const middleware = idempotency();
    const req = {
      headers: { "idempotency-key": "valid-key-123" },
      user: { userId: "user-1" },
      body: { amount: 50000 },
      originalUrl: "/api/orders",
      method: "POST",
    };
    const res = mockResponse();
    const next = vi.fn();

    mocks.findRecord.mockResolvedValue({
      _id: "rec-1",
      requestHash: "hash-abc",
      status: IDEMPOTENCY_STATUSES.PROCESSING,
    });

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
      }),
    );
  });

  it("returns 422 Unprocessable Entity when key is reused with different payload", async () => {
    const middleware = idempotency();
    const req = {
      headers: { "idempotency-key": "valid-key-123" },
      user: { userId: "user-1" },
      body: { amount: 999999 },
      originalUrl: "/api/orders",
      method: "POST",
    };
    const res = mockResponse();
    const next = vi.fn();

    mocks.findRecord.mockResolvedValue({
      _id: "rec-1",
      requestHash: "different-hash",
      status: IDEMPOTENCY_STATUSES.COMPLETED,
    });

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 422,
      }),
    );
  });

  it("creates processing record on first request and completes record on successful response", async () => {
    const middleware = idempotency();
    const req = {
      headers: { "idempotency-key": "valid-key-123" },
      user: { userId: "user-1" },
      body: { amount: 50000 },
      originalUrl: "/api/orders",
      method: "POST",
    };
    const res = mockResponse();
    const next = vi.fn();

    mocks.findRecord.mockResolvedValue(null);
    mocks.createProcessingRecord.mockResolvedValue({
      record: { _id: "rec-new", status: IDEMPOTENCY_STATUSES.PROCESSING },
      duplicate: false,
    });

    await middleware(req, res, next);

    expect(mocks.createProcessingRecord).toHaveBeenCalledWith({
      userId: "user-1",
      key: "valid-key-123",
      endpoint: "/api/orders",
      method: "POST",
      requestHash: "hash-abc",
    });
    expect(next).toHaveBeenCalledWith();

    // Simulate successful response from controller
    res.statusCode = 201;
    res.json({ success: true, data: { orderId: "ord-1" } });

    expect(mocks.completeRecord).toHaveBeenCalledWith("rec-new", 201, {
      success: true,
      data: { orderId: "ord-1" },
    });
    expect(mocks.deleteRecord).not.toHaveBeenCalled();
  });

  it("deletes processing record when response is an error (4xx/5xx)", async () => {
    const middleware = idempotency();
    const req = {
      headers: { "idempotency-key": "valid-key-123" },
      user: { userId: "user-1" },
      body: { amount: 50000 },
      originalUrl: "/api/orders",
      method: "POST",
    };
    const res = mockResponse();
    const next = vi.fn();

    mocks.findRecord.mockResolvedValue(null);
    mocks.createProcessingRecord.mockResolvedValue({
      record: { _id: "rec-new", status: "processing" },
      duplicate: false,
    });

    await middleware(req, res, next);
    expect(next).toHaveBeenCalledWith();

    // Simulate error response from error middleware
    res.statusCode = 400;
    res.json({ success: false, message: "Invalid payload" });

    expect(mocks.deleteRecord).toHaveBeenCalledWith("rec-new");
    expect(mocks.completeRecord).not.toHaveBeenCalled();
  });
});
