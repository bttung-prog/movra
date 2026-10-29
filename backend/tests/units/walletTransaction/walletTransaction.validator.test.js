import { describe, expect, it } from "vitest";

import PAYMENT_METHODS from "../../../src/constants/paymentMethods.js";
import { WALLET_TRANSACTION_STATUSES } from "../../../src/constants/walletTransactionStatuses.js";
import { WALLET_TRANSACTION_TYPES } from "../../../src/constants/walletTransactionTypes.js";
import walletTransactionValidator from "../../../src/modules/walletTransaction/walletTransaction.validator.js";

const customerId = "507f1f77bcf86cd799439011";

describe("walletTransactionValidator.topUpSchema", () => {
  it("accepts a valid top-up and defaults the payment method", () => {
    const { error, value } = walletTransactionValidator.topUpSchema.validate({
      amount: 1000,
      transactionReference: "  BANK-REF-1  ",
    });

    expect(error).toBeUndefined();
    expect(value).toMatchObject({
      amount: 1000,
      paymentMethod: PAYMENT_METHODS.BANK,
      transactionReference: "BANK-REF-1",
    });
  });

  it("accepts supported payment methods and trims optional fields", () => {
    const { error, value } = walletTransactionValidator.topUpSchema.validate({
      amount: 1000,
      paymentMethod: PAYMENT_METHODS.E_WALLET,
      transactionReference: "EW-REF-1",
      proofUrl: " https://example.com/proof ",
      notes: "  Wallet top-up  ",
    });

    expect(error).toBeUndefined();
    expect(value).toMatchObject({
      paymentMethod: PAYMENT_METHODS.E_WALLET,
      proofUrl: "https://example.com/proof",
      notes: "Wallet top-up",
    });
  });

  it.each([
    ["zero amount", { amount: 0 }],
    ["negative amount", { amount: -1 }],
    ["fractional amount", { amount: 1.5 }],
    ["unsupported payment method", { paymentMethod: PAYMENT_METHODS.CASH }],
    ["empty transaction reference", { transactionReference: "   " }],
    ["malformed proof URL", { proofUrl: "not-a-url" }],
  ])("rejects %s", (_case, override) => {
    expect(
      walletTransactionValidator.topUpSchema.validate({
        amount: 1000,
        transactionReference: "REF-1",
        ...override,
      }).error,
    ).toBeDefined();
  });
});

describe("walletTransactionValidator.adjustmentSchema", () => {
  it("accepts a valid credit or debit adjustment", () => {
    for (const direction of ["credit", "debit"]) {
      expect(
        walletTransactionValidator.adjustmentSchema.validate({
          customerId,
          amount: 250,
          direction,
          reason: "  Correction  ",
        }).error,
      ).toBeUndefined();
    }
  });

  it.each([
    ["invalid customer ID", { customerId: "customer-1" }],
    ["zero amount", { amount: 0 }],
    ["fractional amount", { amount: 2.5 }],
    ["invalid direction", { direction: "transfer" }],
    ["blank reason", { reason: "   " }],
    ["reason over 500 characters", { reason: "x".repeat(501) }],
  ])("rejects %s", (_case, override) => {
    expect(
      walletTransactionValidator.adjustmentSchema.validate({
        customerId,
        amount: 250,
        direction: "credit",
        reason: "Correction",
        ...override,
      }).error,
    ).toBeDefined();
  });
});

describe("walletTransactionValidator query and parameter schemas", () => {
  it("applies query defaults and accepts valid filters", () => {
    const { error, value } =
      walletTransactionValidator.queryWalletTransactionSchema.validate({
        type: WALLET_TRANSACTION_TYPES.TOP_UP,
        status: WALLET_TRANSACTION_STATUSES.PENDING,
        customerId,
        startDate: "2026-01-01",
        endDate: "2026-01-31",
      });

    expect(error).toBeUndefined();
    expect(value).toMatchObject({ page: 1, limit: 10, customerId });
  });

  it.each([
    ["invalid transaction type", { type: "unknown" }],
    ["invalid status", { status: "unknown" }],
    ["invalid customer ID", { customerId: "customer-1" }],
    ["fractional page", { page: 1.5 }],
    ["excessive limit", { limit: 101 }],
    ["invalid start date", { startDate: "not-a-date" }],
  ])("rejects %s", (_case, query) => {
    expect(
      walletTransactionValidator.queryWalletTransactionSchema.validate(query)
        .error,
    ).toBeDefined();
  });

  it("validates transaction ID and non-empty transaction code parameters", () => {
    expect(
      walletTransactionValidator.paramIdSchema.validate({
        id: customerId,
      }).error,
    ).toBeUndefined();
    expect(
      walletTransactionValidator.paramIdSchema.validate({ id: "bad-id" }).error,
    ).toBeDefined();
    expect(
      walletTransactionValidator.paramCodeSchema.validate({
        code: " WTRX-0001 ",
      }).value.code,
    ).toBe("WTRX-0001");
    expect(
      walletTransactionValidator.paramCodeSchema.validate({ code: "   " })
        .error,
    ).toBeDefined();
  });
});
