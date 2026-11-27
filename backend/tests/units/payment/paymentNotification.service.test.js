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

import paymentNotificationService from "../../../src/modules/payment/paymentNotification.service.js";

const customerPayment = {
  _id: "payment-1",
  paymentCode: "PAY-0001",
  customerId: { _id: "customer-1", userId: { _id: "customer-user-1" } },
  payerType: "customer",
  paymentAmount: 50000,
  paymentStatus: "pending",
  purpose: "standard",
  notes: "Chờ duyệt",
};

const driverPayment = {
  _id: "payment-2",
  paymentCode: "PAY-0002",
  driverId: { _id: "driver-1", userId: { _id: "driver-user-1" } },
  payerType: "driver",
  paymentAmount: 30000,
  paymentStatus: "pending",
  purpose: "standard",
  notes: "",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findActiveUserIds.mockResolvedValue(["accountant-user-1"]);
  mocks.createManyNotifications.mockResolvedValue([]);
});

describe("paymentNotificationService.notifyPaymentPending", () => {
  it("notifies payer and accountants for customer-created payments", async () => {
    await paymentNotificationService.notifyPaymentPending({
      payment: customerPayment,
      actor: { userId: "customer-user-1", role: "customer" },
      includeAccountants: true,
    });

    const notifications = mocks.createManyNotifications.mock.calls[0][0];
    expect(notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: "customer-user-1" }),
        expect.objectContaining({ userId: "accountant-user-1" }),
      ]),
    );
    expect(notifications[0].type).toBe("PAYMENT");
  });

  it("does not resolve accountants when includeAccountants is false", async () => {
    await paymentNotificationService.notifyPaymentPending({
      payment: customerPayment,
      includeAccountants: false,
    });

    expect(mocks.findActiveUserIds).not.toHaveBeenCalled();
  });
});

describe("paymentNotificationService.verification notifications", () => {
  it("notifies a customer when a payment is verified", async () => {
    await paymentNotificationService.notifyPaymentVerified({
      payment: customerPayment,
      notes: "Đã nhận tiền",
    });

    expect(mocks.createManyNotifications).toHaveBeenCalledWith([
      expect.objectContaining({
        userId: "customer-user-1",
        data: expect.objectContaining({
          event: "PAYMENT_VERIFIED",
          paymentId: "payment-1",
        }),
      }),
    ]);
  });

  it("uses remittance events for driver payments", async () => {
    await paymentNotificationService.notifyPaymentRejected({
      payment: driverPayment,
      notes: "Sai tham chiếu",
    });

    expect(mocks.createManyNotifications).toHaveBeenCalledWith([
      expect.objectContaining({
        userId: "driver-user-1",
        data: expect.objectContaining({
          event: "DRIVER_REMITTANCE_REJECTED",
          payerType: "driver",
        }),
      }),
    ]);
  });
});

describe("paymentNotificationService.notifyDriverRemittanceCreated", () => {
  it("notifies active accountants only", async () => {
    await paymentNotificationService.notifyDriverRemittanceCreated({
      payment: driverPayment,
      actor: { userId: "driver-user-1" },
    });

    expect(mocks.createManyNotifications).toHaveBeenCalledWith([
      expect.objectContaining({
        userId: "accountant-user-1",
        data: expect.objectContaining({
          event: "DRIVER_REMITTANCE_CREATED",
          remittanceId: "payment-2",
        }),
      }),
    ]);
  });
});

describe("paymentNotificationService.notifyRefundCompleted", () => {
  it("notifies the payer with the refund amount", async () => {
    await paymentNotificationService.notifyRefundCompleted({
      payment: customerPayment,
      refundAmount: 20000,
      notes: "Khách yêu cầu",
    });

    expect(mocks.createManyNotifications).toHaveBeenCalledWith([
      expect.objectContaining({
        userId: "customer-user-1",
        data: expect.objectContaining({
          event: "REFUND_COMPLETED",
          refundAmount: 20000,
          notes: "Khách yêu cầu",
        }),
      }),
    ]);
  });
});

describe("paymentNotificationService failure handling", () => {
  it("swallows notification persistence failures", async () => {
    mocks.createManyNotifications.mockRejectedValue(new Error("db down"));

    await expect(
      paymentNotificationService.notifyPaymentCompleted({
        payment: customerPayment,
      }),
    ).resolves.toEqual([]);

    expect(mocks.loggerError).toHaveBeenCalled();
  });
});
