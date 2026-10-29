import { describe, expect, it } from "vitest";

import PAYMENT_METHODS from "../../../src/constants/paymentMethods.js";
import PAYMENT_STATUSES from "../../../src/constants/paymentStatuses.js";
import paymentValidator from "../../../src/modules/payment/payment.validator.js";

const invoiceId = "507f1f77bcf86cd799439011";
const orderId = "507f1f77bcf86cd799439012";

describe("paymentValidator.createPaymentSchema", () => {
  it("accepts an invoice payment and applies the customer payer default", () => {
    const { error, value } = paymentValidator.createPaymentSchema.validate({
      invoiceId,
      paymentAmount: 1000,
      paymentMethod: PAYMENT_METHODS.BANK,
    });

    expect(error).toBeUndefined();
    expect(value.payerType).toBe("customer");
  });

  it("requires an invoice or order and a positive integer amount", () => {
    expect(
      paymentValidator.createPaymentSchema.validate({
        paymentAmount: 1000,
        paymentMethod: PAYMENT_METHODS.CASH,
      }).error,
    ).toBeDefined();

    for (const paymentAmount of [0, -1, 1.5]) {
      expect(
        paymentValidator.createPaymentSchema.validate({
          orderId,
          paymentAmount,
          paymentMethod: PAYMENT_METHODS.CASH,
        }).error,
      ).toBeDefined();
    }
  });

  it("rejects invalid IDs, payment methods, and malformed proof URLs", () => {
    expect(
      paymentValidator.createPaymentSchema.validate({
        invoiceId: "invoice-1",
        paymentAmount: 1000,
        paymentMethod: PAYMENT_METHODS.CASH,
      }).error,
    ).toBeDefined();
    expect(
      paymentValidator.createPaymentSchema.validate({
        invoiceId,
        paymentAmount: 1000,
        paymentMethod: "crypto",
      }).error,
    ).toBeDefined();
    expect(
      paymentValidator.createPaymentSchema.validate({
        orderId,
        paymentAmount: 1000,
        paymentMethod: PAYMENT_METHODS.CASH,
        proofUrl: "not-a-url",
      }).error,
    ).toBeDefined();
  });
});

describe("paymentValidator.driverRemitSchema", () => {
  it("accepts remittance against order IDs or detailed orders", () => {
    expect(
      paymentValidator.driverRemitSchema.validate({
        orderIds: [orderId],
        paymentAmount: 500,
        paymentMethod: PAYMENT_METHODS.CASH,
      }).error,
    ).toBeUndefined();

    expect(
      paymentValidator.driverRemitSchema.validate({
        orders: [{ orderId, collectedAmount: 500 }],
        paymentAmount: 500,
        paymentMethod: PAYMENT_METHODS.BANK,
      }).error,
    ).toBeUndefined();
  });

  it("requires at least one valid order and restricts remittance methods", () => {
    expect(
      paymentValidator.driverRemitSchema.validate({
        orderIds: [],
        paymentAmount: 500,
        paymentMethod: PAYMENT_METHODS.CASH,
      }).error,
    ).toBeDefined();
    expect(
      paymentValidator.driverRemitSchema.validate({
        orders: [{ orderId: "invalid-id" }],
        paymentAmount: 500,
        paymentMethod: PAYMENT_METHODS.CASH,
      }).error,
    ).toBeDefined();
    expect(
      paymentValidator.driverRemitSchema.validate({
        orderIds: [orderId],
        paymentAmount: 500,
        paymentMethod: PAYMENT_METHODS.E_WALLET,
      }).error,
    ).toBeDefined();
  });
});

describe("paymentValidator verification, refund, query, and parameter schemas", () => {
  it("accepts completed or failed verification statuses only", () => {
    for (const status of [
      PAYMENT_STATUSES.COMPLETED,
      PAYMENT_STATUSES.FAILED,
    ]) {
      expect(
        paymentValidator.verifyPaymentSchema.validate({ status }).error,
      ).toBeUndefined();
    }
    expect(
      paymentValidator.verifyPaymentSchema.validate({ status: "pending" })
        .error,
    ).toBeDefined();
  });

  it("requires a non-blank refund reason and positive integer refund amount", () => {
    expect(
      paymentValidator.refundPaymentSchema.validate({
        reason: "  Duplicate payment  ",
        refundAmount: 250,
      }).value,
    ).toMatchObject({ reason: "Duplicate payment", refundAmount: 250 });
    expect(
      paymentValidator.refundPaymentSchema.validate({ reason: "   " }).error,
    ).toBeDefined();
    expect(
      paymentValidator.refundPaymentSchema.validate({
        reason: "Refund",
        refundAmount: 1.5,
      }).error,
    ).toBeDefined();
  });

  it("applies query pagination defaults and validates filters and IDs", () => {
    const { error, value } = paymentValidator.queryPaymentSchema.validate({
      paymentStatus: PAYMENT_STATUSES.PENDING,
      paymentMethod: PAYMENT_METHODS.BANK,
      invoiceId,
      search: "  PAY-001  ",
    });

    expect(error).toBeUndefined();
    expect(value).toMatchObject({ page: 1, limit: 10, search: "PAY-001" });

    expect(
      paymentValidator.queryPaymentSchema.validate({ limit: 101 }).error,
    ).toBeDefined();
    expect(
      paymentValidator.queryPaymentSchema.validate({
        paymentStatus: "unknown",
      }).error,
    ).toBeDefined();
    expect(
      paymentValidator.queryPaymentSchema.validate({ tripId: "trip-1" }).error,
    ).toBeDefined();
  });

  it("validates payment ID parameters", () => {
    expect(
      paymentValidator.paramPaymentIdSchema.validate({ paymentId: invoiceId })
        .error,
    ).toBeUndefined();
    expect(
      paymentValidator.paramPaymentIdSchema.validate({
        paymentId: "payment-1",
      }).error,
    ).toBeDefined();
  });
});
