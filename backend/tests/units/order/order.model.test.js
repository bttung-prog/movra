import { describe, expect, it } from "vitest";

import { PAYMENT_METHODS } from "../../../src/constants/paymentMethods.js";
import Order from "../../../src/modules/order/order.js";

const buildOrder = (overrides = {}) => ({
  orderCode: "ORD-0001",
  customerId: "507f1f77bcf86cd799439011",
  senderName: "Sender",
  senderPhone: "0123456789",
  senderAddress: "Sender address",
  recipientName: "Recipient",
  recipientPhone: "0987654321",
  recipientAddress: "Recipient address",
  goodCategory: "507f1f77bcf86cd799439012",
  weight: 1,
  length: 100,
  width: 100,
  height: 100,
  volume: 1000000,
  quantity: 1,
  totalAmount: 10000,
  ...overrides,
});

describe("Order paymentMethod enum", () => {
  it("accepts null and every supported payment method", () => {
    for (const method of [null, ...Object.values(PAYMENT_METHODS)]) {
      const order = new Order(buildOrder({ paymentMethod: method }));

      expect(order.validateSync()).toBeUndefined();
    }
  });

  it("rejects unsupported payment methods", () => {
    const order = new Order(buildOrder({ paymentMethod: "crypto" }));
    const error = order.validateSync();

    expect(error).toBeDefined();
    expect(error.errors.paymentMethod).toBeDefined();
  });
});
