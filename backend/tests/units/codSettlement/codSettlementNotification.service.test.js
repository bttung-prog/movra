import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createManyNotifications: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("../../../src/modules/notification/notification.service.js", () => ({
  default: {
    createMany: mocks.createManyNotifications,
  },
}));

vi.mock("../../../src/configs/logger.js", () => ({
  default: { error: mocks.loggerError },
}));

import codSettlementNotificationService from "../../../src/modules/codSettlement/codSettlementNotification.service.js";

const settlement = {
  _id: "settlement-1",
  settlementCode: "SET-0001",
  orderId: { _id: "order-1", orderCode: "ORD-0001" },
  customerId: { _id: "customer-1", userId: { _id: "customer-user-1" } },
  netPayoutAmount: 50000,
  payoutMethod: "wallet",
  status: "confirmed",
  bankDetails: {
    bankName: "VCB",
    accountNumber: "1234567890",
  },
  bankTransferReference: null,
  notes: "",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createManyNotifications.mockResolvedValue([]);
});

describe("codSettlementNotificationService", () => {
  it("notifies the customer when a settlement is confirmed", async () => {
    await codSettlementNotificationService.notifySettlementConfirmed({
      settlement,
    });

    expect(mocks.createManyNotifications).toHaveBeenCalledWith([
      expect.objectContaining({
        userId: "customer-user-1",
        type: "COD",
        data: expect.objectContaining({
          settlementId: "settlement-1",
          settlementCode: "SET-0001",
          orderId: "order-1",
          netPayoutAmount: 50000,
          payoutMethod: "wallet",
          status: "confirmed",
          event: "COD_SETTLEMENT_CONFIRMED",
        }),
      }),
    ]);
  });

  it("notifies the customer when a settlement is completed", async () => {
    await codSettlementNotificationService.notifySettlementCompleted({
      settlement: {
        ...settlement,
        status: "completed",
        bankTransferReference: "BANK-REF-1",
      },
    });

    const notification = mocks.createManyNotifications.mock.calls[0][0][0];
    expect(notification.type).toBe("COD");
    expect(notification.data).toEqual(
      expect.objectContaining({
        event: "COD_SETTLEMENT_COMPLETED",
        status: "completed",
        bankName: "VCB",
        bankTransferReference: "BANK-REF-1",
      }),
    );
    expect(notification.data.accountNumber).toBeUndefined();
  });

  it("notifies the customer with the cancellation reason", async () => {
    await codSettlementNotificationService.notifySettlementCancelled({
      settlement: { ...settlement, status: "cancelled" },
      notes: "Sai thông tin ngân hàng",
    });

    const notification = mocks.createManyNotifications.mock.calls[0][0][0];
    expect(notification.message).toContain("Sai thông tin ngân hàng");
    expect(notification.data.event).toBe("COD_SETTLEMENT_CANCELLED");
  });

  it("swallows notification failures", async () => {
    mocks.createManyNotifications.mockRejectedValue(new Error("db down"));

    await expect(
      codSettlementNotificationService.notifySettlementConfirmed({
        settlement,
      }),
    ).resolves.toEqual([]);

    expect(mocks.loggerError).toHaveBeenCalled();
  });
});
