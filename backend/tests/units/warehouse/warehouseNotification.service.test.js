import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findActiveDispatchers: vi.fn(),
  createManyNotifications: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("../../../src/modules/dispatcher/dispatcher.repository.js", () => ({
  default: { findActiveByWarehouseId: mocks.findActiveDispatchers },
}));

vi.mock("../../../src/modules/notification/notification.service.js", () => ({
  default: { createMany: mocks.createManyNotifications },
}));

vi.mock("../../../src/configs/logger.js", () => ({
  default: { error: mocks.loggerError },
}));

import { WAREHOUSE_NOTIFICATION_EVENTS } from "../../../src/constants/warehouseNotification.js";
import warehouseNotificationService from "../../../src/modules/warehouse/warehouseNotification.service.js";

const warehouse = {
  _id: "warehouse-1",
  warehouseName: "Kho trung tâm",
};
const issue = {
  _id: "issue-1",
  issueCode: "IS-0001",
  orderId: "order-1",
  warehouseId: "warehouse-1",
  goodsCategoryId: "category-1",
  quantity: 2,
  status: "completed",
  note: "",
};
const receipt = {
  _id: "receipt-1",
  receiptCode: "RC-0001",
  orderId: { _id: "order-1", orderCode: "ORD-0001" },
  warehouseId: "warehouse-1",
  goodsCategoryId: "category-1",
  quantity: 2,
  condition: "good",
  status: "completed",
  note: "",
};
const order = { _id: "order-1", orderCode: "ORD-0001" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findActiveDispatchers.mockResolvedValue([
    { userId: { _id: "dispatcher-user-1" } },
  ]);
  mocks.createManyNotifications.mockResolvedValue([{ _id: "notification-1" }]);
});

describe("warehouseNotificationService", () => {
  it("notifies the warehouse dispatcher about a new issue", async () => {
    await warehouseNotificationService.notifyIssueCreated({
      issue,
      order,
      warehouse,
    });

    expect(mocks.findActiveDispatchers).toHaveBeenCalledWith("warehouse-1");
    const notifications = mocks.createManyNotifications.mock.calls[0][0];
    expect(notifications).toHaveLength(1);
    expect(notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: "dispatcher-user-1",
          type: "WAREHOUSE",
          data: expect.objectContaining({
            event: WAREHOUSE_NOTIFICATION_EVENTS.WAREHOUSE_ISSUE_CREATED,
            issueId: "issue-1",
            issueCode: "IS-0001",
            orderCode: "ORD-0001",
          }),
        }),
      ]),
    );
  });

  it("notifies about a cancelled issue with its note", async () => {
    await warehouseNotificationService.notifyIssueCancelled({
      issue: { ...issue, status: "cancelled", note: "Sai số lượng" },
      order,
      warehouse,
    });

    expect(mocks.createManyNotifications).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining("Sai số lượng"),
          data: expect.objectContaining({
            event: WAREHOUSE_NOTIFICATION_EVENTS.WAREHOUSE_ISSUE_CANCELLED,
          }),
        }),
      ]),
    );
  });

  it("notifies about a receipt condition change with previous and new values", async () => {
    await warehouseNotificationService.notifyReceiptConditionUpdated({
      receipt: { ...receipt, condition: "damaged", note: "Móp thùng" },
      warehouse,
      previousCondition: "good",
      condition: "damaged",
      notes: "Móp thùng",
    });

    expect(mocks.createManyNotifications).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          userId: "dispatcher-user-1",
          data: expect.objectContaining({
            event:
              WAREHOUSE_NOTIFICATION_EVENTS.WAREHOUSE_RECEIPT_CONDITION_UPDATED,
            previousCondition: "good",
            condition: "damaged",
            notes: "Móp thùng",
          }),
        }),
      ]),
    );
  });

  it("does not notify the actor when they are also a recipient", async () => {
    await warehouseNotificationService.notifyReceiptCreated({
      receipt,
      order,
      warehouse,
      actor: { userId: "dispatcher-user-1" },
    });

    expect(mocks.createManyNotifications).not.toHaveBeenCalled();
  });

  it("swallows notification persistence failures", async () => {
    mocks.createManyNotifications.mockRejectedValue(new Error("database down"));

    await expect(
      warehouseNotificationService.notifyReceiptCreated({
        receipt,
        order,
        warehouse,
      }),
    ).resolves.toBe(0);
    expect(mocks.loggerError).toHaveBeenCalled();
  });
});
