import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findByUserAndKey: vi.fn(),
  create: vi.fn(),
  updateById: vi.fn(),
  deleteById: vi.fn(),
}));

vi.mock("../../../src/modules/idempotency/idempotency.repository.js", () => ({
  default: {
    findByUserAndKey: mocks.findByUserAndKey,
    create: mocks.create,
    updateById: mocks.updateById,
    deleteById: mocks.deleteById,
  },
}));

import { IDEMPOTENCY_STATUSES } from "../../../src/constants/idempotencyStatuses.js";
import idempotencyService from "../../../src/modules/idempotency/idempotency.service.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("idempotencyService.generateHash", () => {
  it("produces identical hash for objects with different key order", () => {
    const obj1 = { a: 1, b: "hello", c: { nested: true, count: 5 } };
    const obj2 = { c: { count: 5, nested: true }, b: "hello", a: 1 };

    const hash1 = idempotencyService.generateHash(obj1);
    const hash2 = idempotencyService.generateHash(obj2);

    expect(hash1).toEqual(hash2);
  });

  it("produces different hash for different payload contents", () => {
    const obj1 = { amount: 100000 };
    const obj2 = { amount: 200000 };

    const hash1 = idempotencyService.generateHash(obj1);
    const hash2 = idempotencyService.generateHash(obj2);

    expect(hash1).not.toEqual(hash2);
  });

  it("handles null or undefined payload gracefully", () => {
    const hash1 = idempotencyService.generateHash(null);
    const hash2 = idempotencyService.generateHash(undefined);
    const hash3 = idempotencyService.generateHash({});

    expect(hash1).toBeDefined();
    expect(hash1).toEqual(hash2);
    expect(hash1).toEqual(hash3);
  });
});

describe("idempotencyService.findRecord", () => {
  it("returns null if userId or key is missing", async () => {
    expect(await idempotencyService.findRecord(null, "key-1")).toBeNull();
    expect(await idempotencyService.findRecord("user-1", null)).toBeNull();
    expect(mocks.findByUserAndKey).not.toHaveBeenCalled();
  });

  it("calls repository when both userId and key are provided", async () => {
    const record = { _id: "rec-1", userId: "user-1", key: "key-1" };
    mocks.findByUserAndKey.mockResolvedValue(record);

    const result = await idempotencyService.findRecord("user-1", "key-1");

    expect(result).toEqual(record);
    expect(mocks.findByUserAndKey).toHaveBeenCalledWith("user-1", "key-1");
  });
});

describe("idempotencyService.createProcessingRecord", () => {
  it("returns { record: null, duplicate: false } if userId or key is missing", async () => {
    const result = await idempotencyService.createProcessingRecord({
      userId: null,
      key: "key-1",
    });

    expect(result).toEqual({ record: null, duplicate: false });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("creates a processing record successfully when no duplicate exists", async () => {
    const recordData = {
      userId: "user-1",
      key: "idemp-key-1",
      endpoint: "/api/orders",
      method: "POST",
      requestHash: "hash-123",
    };

    const createdRecord = {
      ...recordData,
      _id: "rec-1",
      status: IDEMPOTENCY_STATUSES.PROCESSING,
    };
    mocks.create.mockResolvedValue(createdRecord);

    const result = await idempotencyService.createProcessingRecord(recordData);

    expect(result).toEqual({ record: createdRecord, duplicate: false });
    expect(mocks.create).toHaveBeenCalledWith({
      ...recordData,
      status: IDEMPOTENCY_STATUSES.PROCESSING,
    });
  });

  it("handles code 11000 duplicate key gracefully and fetches existing record", async () => {
    const recordData = {
      userId: "user-1",
      key: "idemp-key-1",
      endpoint: "/api/orders",
      method: "POST",
      requestHash: "hash-123",
    };

    const duplicateError = new Error("E11000 duplicate key error");
    duplicateError.code = 11000;
    mocks.create.mockRejectedValue(duplicateError);

    const existingRecord = {
      ...recordData,
      _id: "rec-existing",
      status: IDEMPOTENCY_STATUSES.PROCESSING,
    };
    mocks.findByUserAndKey.mockResolvedValue(existingRecord);

    const result = await idempotencyService.createProcessingRecord(recordData);

    expect(result).toEqual({ record: existingRecord, duplicate: true });
    expect(mocks.findByUserAndKey).toHaveBeenCalledWith(
      "user-1",
      "idemp-key-1",
    );
  });

  it("rethrows non-duplicate errors", async () => {
    const recordData = {
      userId: "user-1",
      key: "idemp-key-1",
      endpoint: "/api/orders",
      method: "POST",
      requestHash: "hash-123",
    };

    mocks.create.mockRejectedValue(new Error("Database connection lost"));

    await expect(
      idempotencyService.createProcessingRecord(recordData),
    ).rejects.toThrow("Database connection lost");
  });
});

describe("idempotencyService.completeRecord", () => {
  it("returns null if recordId is missing", async () => {
    const result = await idempotencyService.completeRecord(null, 201, {});
    expect(result).toBeNull();
    expect(mocks.updateById).not.toHaveBeenCalled();
  });

  it("updates status to completed with response status and body", async () => {
    const recordId = "rec-1";
    const responseStatus = 201;
    const responseBody = { success: true, data: { orderId: "ord-1" } };

    const updated = {
      _id: recordId,
      status: IDEMPOTENCY_STATUSES.COMPLETED,
      responseStatus,
      responseBody,
    };
    mocks.updateById.mockResolvedValue(updated);

    const result = await idempotencyService.completeRecord(
      recordId,
      responseStatus,
      responseBody,
    );

    expect(result).toEqual(updated);
    expect(mocks.updateById).toHaveBeenCalledWith(recordId, {
      status: IDEMPOTENCY_STATUSES.COMPLETED,
      responseStatus,
      responseBody,
    });
  });
});

describe("idempotencyService.deleteRecord", () => {
  it("returns null if recordId is missing", async () => {
    const result = await idempotencyService.deleteRecord(null);
    expect(result).toBeNull();
    expect(mocks.deleteById).not.toHaveBeenCalled();
  });

  it("removes record by id", async () => {
    const recordId = "rec-1";
    mocks.deleteById.mockResolvedValue({ _id: recordId });

    const result = await idempotencyService.deleteRecord(recordId);

    expect(result).toEqual({ _id: recordId });
    expect(mocks.deleteById).toHaveBeenCalledWith(recordId);
  });
});
