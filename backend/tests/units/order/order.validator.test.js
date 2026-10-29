import { describe, expect, it } from "vitest";

import Order from "../../../src/modules/order/order.js";
import orderValidator from "../../../src/modules/order/order.validator.js";

const validOrderPayload = {
  senderName: "Sender",
  senderPhone: "0123456789",
  senderAddress: "Sender address",
  pickupLocation: { latitude: 10.78, longitude: 106.69 },
  recipientName: "Recipient",
  recipientPhone: "0987654321",
  recipientAddress: "Recipient address",
  goodCategory: "507f1f77bcf86cd799439011",
  weight: 2,
  volume: 1,
  quantity: 1,
};

describe("orderValidator.createOrderSchema", () => {
  it("accepts a valid order and applies defaults", () => {
    const { error, value } =
      orderValidator.createOrderSchema.validate(validOrderPayload);

    expect(error).toBeUndefined();
    expect(value.codAmount).toBe(0);
    expect(value.type).toBe("normal");
  });

  it.each([
    ["invalid sender phone", { senderPhone: "123" }],
    ["non-positive weight", { weight: 0 }],
    ["fractional quantity", { quantity: 1.5 }],
    ["malformed category ID", { goodCategory: "category-1" }],
    ["negative COD amount", { codAmount: -1 }],
    ["unsupported order type", { type: "overnight" }],
    [
      "latitude outside valid range",
      { pickupLocation: { latitude: 91, longitude: 0 } },
    ],
  ])("rejects %s", (_case, override) => {
    const result = orderValidator.createOrderSchema.validate({
      ...validOrderPayload,
      ...override,
    });

    expect(result.error).toBeDefined();
  });

  it("allows non-customer order payloads to omit pickup coordinates", () => {
    const result = orderValidator.createOrderSchema.validate({
      ...validOrderPayload,
      pickupLocation: undefined,
    });

    expect(result.error).toBeUndefined();
  });
});

describe("Order pickup location schema", () => {
  it("allows orders without pickup coordinates at the model layer", () => {
    const validationError = new Order({}).validateSync();

    expect(validationError?.errors["pickupLocation.latitude"]).toBeUndefined();
    expect(validationError?.errors["pickupLocation.longitude"]).toBeUndefined();
  });

  it("still enforces geographic bounds when pickup coordinates are provided", () => {
    const validationError = new Order({
      pickupLocation: { latitude: 91, longitude: 0 },
    }).validateSync();

    expect(validationError?.errors["pickupLocation.latitude"]).toBeDefined();
  });
});

describe("orderValidator.updateOrderSchema", () => {
  it("requires at least one update field", () => {
    const result = orderValidator.updateOrderSchema.validate({});

    expect(result.error).toBeDefined();
    expect(result.error.details[0].type).toBe("object.min");
  });

  it("accepts valid optional order updates", () => {
    const result = orderValidator.updateOrderSchema.validate({
      recipientAddress: "Updated address",
      notes: "",
    });

    expect(result.error).toBeUndefined();
  });
});

describe("orderValidator.queryOrderSchema", () => {
  it("applies pagination defaults", () => {
    const { error, value } = orderValidator.queryOrderSchema.validate({});

    expect(error).toBeUndefined();
    expect(value).toMatchObject({ page: 1, limit: 10 });
  });

  it("rejects invalid status and out-of-range page size", () => {
    expect(
      orderValidator.queryOrderSchema.validate({
        status: "in_transit",
      }).error,
    ).toBeDefined();
    expect(
      orderValidator.queryOrderSchema.validate({
        limit: 101,
      }).error,
    ).toBeDefined();
  });
});

describe("orderValidator.assignOrdersSchema", () => {
  it("requires a trip and at least one valid order ID", () => {
    const result = orderValidator.assignOrdersSchema.validate({
      tripId: "507f1f77bcf86cd799439011",
      orderIds: [],
    });

    expect(result.error).toBeDefined();
  });

  it("accepts valid trip and order IDs", () => {
    const result = orderValidator.assignOrdersSchema.validate({
      tripId: "507f1f77bcf86cd799439011",
      orderIds: ["507f1f77bcf86cd799439012"],
    });

    expect(result.error).toBeUndefined();
  });
});

describe("orderValidator.pickupConfirmationSchema", () => {
  it("requires a reason when pickup fails", () => {
    expect(
      orderValidator.pickupConfirmationSchema.validate({
        outcome: "failed",
        notes: "   ",
      }).error,
    ).toBeDefined();
  });

  it("accepts successful pickup confirmation and a failed pickup with notes", () => {
    expect(
      orderValidator.pickupConfirmationSchema.validate({
        outcome: "picked_up",
      }).error,
    ).toBeUndefined();
    expect(
      orderValidator.pickupConfirmationSchema.validate({
        outcome: "failed",
        notes: "No one at the pickup address",
      }).error,
    ).toBeUndefined();
  });
});
