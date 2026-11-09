import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  processOverdueInvoices: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
}));

vi.mock("../../../src/modules/invoice/invoice.service.js", () => ({
  default: {
    processOverdueInvoices: mocks.processOverdueInvoices,
  },
}));

vi.mock("../../../src/configs/logger.js", () => ({
  default: {
    info: mocks.info,
    error: mocks.error,
  },
}));

import { runInvoiceOverdueJob } from "../../../src/jobs/invoiceOverdue.job.js";

describe("runInvoiceOverdueJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("successfully runs job and logs results", async () => {
    mocks.processOverdueInvoices.mockResolvedValue({
      scannedCount: 5,
      updatedCount: 3,
      invoices: [],
    });

    const result = await runInvoiceOverdueJob();

    expect(mocks.processOverdueInvoices).toHaveBeenCalled();
    expect(result).toEqual({
      scannedCount: 5,
      updatedCount: 3,
      invoices: [],
    });
    expect(mocks.info).toHaveBeenCalledWith(
      expect.stringContaining("Hoàn tất quét hóa đơn quá hạn"),
    );
  });

  it("logs error and rethrows when invoiceService fails", async () => {
    const error = new Error("Database timeout");
    mocks.processOverdueInvoices.mockRejectedValue(error);

    await expect(runInvoiceOverdueJob()).rejects.toThrow("Database timeout");
    expect(mocks.error).toHaveBeenCalledWith(
      expect.stringContaining("Lỗi khi quét hóa đơn quá hạn"),
      expect.any(Object),
    );
  });
});
