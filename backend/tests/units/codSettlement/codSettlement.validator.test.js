import { describe, expect, it } from "vitest";

import { COD_SETTLEMENT_MESSAGES } from "../../../src/constants/messages.js";
import codSettlementValidator from "../../../src/modules/codSettlement/codSettlement.validator.js";
import {
  PAYOUT_METHODS,
  SETTLEMENT_STATUSES,
} from "../../../src/modules/codSettlement/codSettlement.js";

const orderId = "507f1f77bcf86cd799439011";
const customerId = "507f1f77bcf86cd799439012";

describe("codSettlementValidator.generateSettlementSchema", () => {
  it("accepts an order and defaults to wallet payout", () => {
    const { error, value } =
      codSettlementValidator.generateSettlementSchema.validate({ orderId });

    expect(error).toBeUndefined();
    expect(value.payoutMethod).toBe(PAYOUT_METHODS.WALLET);
  });

  it("requires bank details for bank transfer and trims their values", () => {
    const { error, value } =
      codSettlementValidator.generateSettlementSchema.validate({
        orderId,
        payoutMethod: PAYOUT_METHODS.BANK_TRANSFER,
        bankDetails: {
          bankName: "  Example Bank ",
          accountNumber: " 123456 ",
          accountHolder: " Customer Name ",
        },
      });

    expect(error).toBeUndefined();
    expect(value.bankDetails).toEqual({
      bankName: "Example Bank",
      accountNumber: "123456",
      accountHolder: "Customer Name",
    });
  });

  it.each([
    ["missing order ID", {}],
    ["invalid order ID", { orderId: "order-1" }],
    ["unsupported payout method", { orderId, payoutMethod: "cash" }],
    [
      "missing bank details",
      { orderId, payoutMethod: PAYOUT_METHODS.BANK_TRANSFER },
    ],
    [
      "incomplete bank details",
      {
        orderId,
        payoutMethod: PAYOUT_METHODS.BANK_TRANSFER,
        bankDetails: { bankName: "Bank", accountNumber: "123" },
      },
    ],
  ])("rejects %s", (_case, payload) => {
    expect(
      codSettlementValidator.generateSettlementSchema.validate(payload).error,
    ).toBeDefined();
  });
});

describe("codSettlementValidator.completeSettlementSchema", () => {
  it("trims optional notes and bank transfer reference", () => {
    const { error, value } =
      codSettlementValidator.completeSettlementSchema.validate({
        notes: "  Paid  ",
        bankTransferReference: "  BANK-REF-1  ",
      });

    expect(error).toBeUndefined();
    expect(value).toMatchObject({
      notes: "Paid",
      bankTransferReference: "BANK-REF-1",
    });
  });

  it("rejects a bank transfer reference longer than 100 characters", () => {
    expect(
      codSettlementValidator.completeSettlementSchema.validate({
        bankTransferReference: "x".repeat(101),
      }).error,
    ).toBeDefined();
  });
});

describe("codSettlementValidator.cancelSettlementSchema", () => {
  it("requires a non-blank cancellation reason and trims it", () => {
    expect(
      codSettlementValidator.cancelSettlementSchema.validate({
        reason: "  Incorrect settlement  ",
      }).value.reason,
    ).toBe("Incorrect settlement");

    expect(
      codSettlementValidator.cancelSettlementSchema.validate({}).error
        ?.details[0].message,
    ).toBe(COD_SETTLEMENT_MESSAGES.CANCEL_REASON_REQUIRED);
    expect(
      codSettlementValidator.cancelSettlementSchema.validate({
        reason: "   ",
      }).error?.details[0].message,
    ).toBe(COD_SETTLEMENT_MESSAGES.CANCEL_REASON_EMPTY);
  });
});

describe("codSettlementValidator.querySettlementSchema and paramIdSchema", () => {
  it("applies pagination defaults and accepts valid filters", () => {
    const { error, value } =
      codSettlementValidator.querySettlementSchema.validate({
        customerId,
        status: SETTLEMENT_STATUSES.CONFIRMED,
        payoutMethod: PAYOUT_METHODS.BANK_TRANSFER,
        startDate: "2026-01-01",
      });

    expect(error).toBeUndefined();
    expect(value).toMatchObject({
      page: 1,
      limit: 10,
      customerId,
      status: SETTLEMENT_STATUSES.CONFIRMED,
    });
    expect(value.startDate).toBe("2026-01-01");
  });

  it.each([
    ["invalid customer ID", { customerId: "customer-1" }],
    ["invalid status", { status: "pending" }],
    ["invalid payout method", { payoutMethod: "cash" }],
    ["fractional page", { page: 1.5 }],
    ["excessive limit", { limit: 101 }],
    ["invalid date", { endDate: "not-a-date" }],
  ])("rejects %s", (_case, query) => {
    expect(
      codSettlementValidator.querySettlementSchema.validate(query).error,
    ).toBeDefined();
  });

  it("validates settlement IDs", () => {
    expect(
      codSettlementValidator.paramIdSchema.validate({ id: orderId }).error,
    ).toBeUndefined();
    expect(
      codSettlementValidator.paramIdSchema.validate({ id: "settlement-1" })
        .error,
    ).toBeDefined();
  });
});
