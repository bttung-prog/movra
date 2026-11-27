import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findActiveAccountants: vi.fn(),
  createManyNotifications: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("../../../src/modules/accountant/accountant.repository.js", () => ({
  default: { findActiveUserIds: mocks.findActiveAccountants },
}));

vi.mock("../../../src/modules/notification/notification.service.js", () => ({
  default: { createMany: mocks.createManyNotifications },
}));

vi.mock("../../../src/configs/logger.js", () => ({
  default: { error: mocks.loggerError },
}));

import { WALLET_NOTIFICATION_EVENTS } from "../../../src/constants/walletNotification.js";
import walletNotificationService from "../../../src/modules/walletTransaction/walletNotification.service.js";

const customer = {
  _id: "customer-1",
  userId: { _id: "customer-user-1" },
  walletBalance: 500000,
};
const payment = {
  _id: "payment-1",
  paymentCode: "PAY-0001",
  paymentAmount: 100000,
  paymentStatus: "pending",
  purpose: "wallet_top_up",
  customerId: customer,
};
const walletTransaction = {
  _id: "wallet-transaction-1",
  transactionCode: "WTRX-0001",
  direction: "credit",
  amount: 100000,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findActiveAccountants.mockResolvedValue(["accountant-user-1"]);
  mocks.createManyNotifications.mockResolvedValue([{ _id: "notification-1" }]);
});

describe("walletNotificationService", () => {
  it("notifies the customer and active accountants about a pending top-up", async () => {
    await walletNotificationService.notifyTopUpPending({
      payment,
      customer,
      actor: { userId: "customer-user-1" },
    });

    const notifications = mocks.createManyNotifications.mock.calls[0][0];
    expect(notifications).toHaveLength(2);
    expect(notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: "customer-user-1",
          type: "PAYMENT",
          dedupeKey: "wallet:payment:payment-1:topup_pending",
          data: expect.objectContaining({
            event: WALLET_NOTIFICATION_EVENTS.WALLET_TOPUP_PENDING,
            paymentId: "payment-1",
            amount: 100000,
          }),
        }),
        expect.objectContaining({
          userId: "accountant-user-1",
          type: "PAYMENT",
          dedupeKey: "wallet:payment:payment-1:topup_pending",
        }),
      ]),
    );
  });

  it("notifies the customer when a top-up is completed", async () => {
    await walletNotificationService.notifyTopUpCompleted({
      payment: { ...payment, paymentStatus: "completed" },
      customer,
      walletTransaction,
      balanceBefore: 400000,
      balanceAfter: 500000,
    });

    expect(mocks.createManyNotifications).toHaveBeenCalledWith([
      expect.objectContaining({
        userId: "customer-user-1",
        type: "PAYMENT",
        dedupeKey: "wallet:payment:payment-1:topup_completed",
        data: expect.objectContaining({
          event: WALLET_NOTIFICATION_EVENTS.WALLET_TOPUP_COMPLETED,
          walletTransactionId: "wallet-transaction-1",
          transactionCode: "WTRX-0001",
          balanceBefore: 400000,
          balanceAfter: 500000,
        }),
      }),
    ]);
  });

  it("notifies the customer when a top-up is rejected", async () => {
    await walletNotificationService.notifyTopUpRejected({
      payment,
      customer,
      notes: "Reference not found",
    });

    expect(mocks.createManyNotifications).toHaveBeenCalledWith([
      expect.objectContaining({
        userId: "customer-user-1",
        message: expect.stringContaining("Reference not found"),
        dedupeKey: "wallet:payment:payment-1:topup_rejected",
      }),
    ]);
  });

  it("notifies the customer about an adjustment without exposing the reason", async () => {
    await walletNotificationService.notifyWalletAdjusted({
      customer,
      walletTransaction: { ...walletTransaction, direction: "debit" },
      direction: "debit",
      amount: 25000,
      balanceBefore: 500000,
      balanceAfter: 475000,
    });

    const notification = mocks.createManyNotifications.mock.calls[0][0][0];
    expect(notification).toEqual(
      expect.objectContaining({
        userId: "customer-user-1",
        type: "PAYMENT",
        dedupeKey: "wallet:transaction:wallet-transaction-1:adjustment",
        data: expect.objectContaining({
          event: WALLET_NOTIFICATION_EVENTS.WALLET_ADJUSTED,
          direction: "debit",
          amount: 25000,
          balanceAfter: 475000,
        }),
      }),
    );
    expect(notification.data).not.toHaveProperty("reason");
  });

  it("notifies the customer when a top-up is refunded", async () => {
    await walletNotificationService.notifyTopUpRefunded({
      payment: { ...payment, paymentStatus: "refunded" },
      customer,
      walletTransaction: { ...walletTransaction, _id: "wallet-transaction-2" },
      amount: 100000,
      balanceBefore: 500000,
      balanceAfter: 400000,
      notes: "Top-up reversed",
    });

    expect(mocks.createManyNotifications).toHaveBeenCalledWith([
      expect.objectContaining({
        userId: "customer-user-1",
        type: "PAYMENT",
        dedupeKey: "wallet:transaction:wallet-transaction-2:topup_refunded",
        data: expect.objectContaining({
          event: WALLET_NOTIFICATION_EVENTS.WALLET_TOPUP_REFUNDED,
          direction: "debit",
          amount: 100000,
          balanceAfter: 400000,
        }),
      }),
    ]);
  });

  it("swallows notification persistence failures", async () => {
    mocks.createManyNotifications.mockRejectedValue(new Error("database down"));

    await expect(
      walletNotificationService.notifyTopUpCompleted({
        payment,
        customer,
      }),
    ).resolves.toBe(0);
    expect(mocks.loggerError).toHaveBeenCalled();
  });
});
