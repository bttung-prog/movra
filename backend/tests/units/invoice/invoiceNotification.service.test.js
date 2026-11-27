import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findActiveUserIds: vi.fn(),
  createManyNotifications: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("../../../src/modules/accountant/accountant.repository.js", () => ({
  default: {
    findActiveUserIds: mocks.findActiveUserIds,
  },
}));

vi.mock("../../../src/modules/notification/notification.service.js", () => ({
  default: {
    createMany: mocks.createManyNotifications,
  },
}));

vi.mock("../../../src/configs/logger.js", () => ({
  default: { error: mocks.loggerError },
}));

import invoiceNotificationService from "../../../src/modules/invoice/invoiceNotification.service.js";

const invoice = {
  _id: "invoice-1",
  invoiceCode: "INV-0001",
  customerId: { _id: "customer-1", userId: { _id: "customer-user-1" } },
  orderIds: [{ _id: "order-1" }, { _id: "order-2" }],
  status: "issued",
  totalAmount: 100000,
  paidAmount: 40000,
  remainingAmount: 60000,
  dueDate: "2030-05-01T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findActiveUserIds.mockResolvedValue(["accountant-user-1"]);
  mocks.createManyNotifications.mockResolvedValue([]);
});

describe("invoiceNotificationService.notifyInvoiceIssued", () => {
  it("notifies the customer only", async () => {
    await invoiceNotificationService.notifyInvoiceIssued({ invoice });

    expect(mocks.createManyNotifications).toHaveBeenCalledWith([
      expect.objectContaining({
        userId: "customer-user-1",
        type: "INVOICE",
        data: expect.objectContaining({
          invoiceId: "invoice-1",
          invoiceCode: "INV-0001",
          orderIds: ["order-1", "order-2"],
          event: "INVOICE_ISSUED",
        }),
      }),
    ]);
    expect(mocks.findActiveUserIds).not.toHaveBeenCalled();
  });
});

describe("invoiceNotificationService paid events", () => {
  it("notifies customer and accountants when partially paid", async () => {
    await invoiceNotificationService.notifyInvoicePartiallyPaid({
      invoice,
      paymentId: "payment-1",
    });

    const notifications = mocks.createManyNotifications.mock.calls[0][0];
    expect(notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: "customer-user-1" }),
        expect.objectContaining({ userId: "accountant-user-1" }),
      ]),
    );
    expect(notifications[0].data.event).toBe("INVOICE_PARTIALLY_PAID");
    expect(notifications[0].data.paymentId).toBe("payment-1");
  });

  it("uses INVOICE_PAID when the invoice is fully paid", async () => {
    await invoiceNotificationService.notifyInvoicePaid({
      invoice: {
        ...invoice,
        status: "paid",
        paidAmount: 100000,
        remainingAmount: 0,
      },
    });

    expect(mocks.createManyNotifications).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({ event: "INVOICE_PAID" }),
        }),
      ]),
    );
  });
});

describe("invoiceNotificationService cancellation", () => {
  it("notifies the customer with the cancellation reason", async () => {
    await invoiceNotificationService.notifyInvoiceCancelled({
      invoice: { ...invoice, status: "cancelled" },
      notes: "Sai thông tin",
    });

    const notification = mocks.createManyNotifications.mock.calls[0][0][0];
    expect(notification.message).toContain("Sai thông tin");
    expect(notification.data.event).toBe("INVOICE_CANCELLED");
  });
});

describe("invoiceNotificationService failure handling", () => {
  it("swallows notification failures", async () => {
    mocks.createManyNotifications.mockRejectedValue(new Error("db down"));

    await expect(
      invoiceNotificationService.notifyInvoiceIssued({ invoice }),
    ).resolves.toEqual([]);

    expect(mocks.loggerError).toHaveBeenCalled();
  });
});
