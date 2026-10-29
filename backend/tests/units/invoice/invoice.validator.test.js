import { describe, expect, it } from "vitest";

import invoiceValidator from "../../../src/modules/invoice/invoice.validator.js";

const validInvoiceItem = {
  description: "  Delivery fee  ",
  quantity: 2,
  unitPrice: 1500,
  amount: 3000,
};

describe("invoiceValidator.createInvoiceSchema", () => {
  it("accepts an invoice with a customer and applies defaults", () => {
    const { error, value } = invoiceValidator.createInvoiceSchema.validate({
      customerId: "507f1f77bcf86cd799439011",
      items: [validInvoiceItem],
    });

    expect(error).toBeUndefined();
    expect(value).toMatchObject({
      tax: 0,
      discount: 0,
      paymentTerms: "immediate",
    });
    expect(value.items[0].description).toBe("Delivery fee");
    expect(value.items[0].quantity).toBe(2);
  });

  it("requires a customer or order and validates their IDs", () => {
    expect(
      invoiceValidator.createInvoiceSchema.validate({}).error,
    ).toBeDefined();
    expect(
      invoiceValidator.createInvoiceSchema.validate({
        orderId: "order-1",
      }).error,
    ).toBeDefined();
    expect(
      invoiceValidator.createInvoiceSchema.validate({
        customerId: "507f1f77bcf86cd799439011",
      }).error,
    ).toBeUndefined();
  });

  it.each([
    ["negative tax", { tax: -1 }],
    ["fractional discount", { discount: 1.5 }],
    ["unsupported payment terms", { paymentTerms: "net_60" }],
    ["invalid due date", { dueDate: "not-a-date" }],
    ["missing item description", { items: [{ unitPrice: 10, amount: 10 }] }],
    ["zero item quantity", { items: [{ ...validInvoiceItem, quantity: 0 }] }],
    [
      "fractional item amount",
      { items: [{ ...validInvoiceItem, amount: 3.5 }] },
    ],
  ])("rejects %s", (_case, override) => {
    expect(
      invoiceValidator.createInvoiceSchema.validate({
        customerId: "507f1f77bcf86cd799439011",
        ...override,
      }).error,
    ).toBeDefined();
  });
});

describe("invoiceValidator.updateInvoiceSchema", () => {
  it("requires at least one update field", () => {
    expect(
      invoiceValidator.updateInvoiceSchema.validate({}).error?.details[0].type,
    ).toBe("object.min");
  });

  it("accepts valid updates and trims notes", () => {
    const { error, value } = invoiceValidator.updateInvoiceSchema.validate({
      subTotal: 3000,
      paymentTerms: "net_15",
      notes: "  Revised invoice  ",
    });

    expect(error).toBeUndefined();
    expect(value.notes).toBe("Revised invoice");
  });

  it("rejects an invalid payment term or monetary value", () => {
    expect(
      invoiceValidator.updateInvoiceSchema.validate({
        paymentTerms: "net_45",
      }).error,
    ).toBeDefined();
    expect(
      invoiceValidator.updateInvoiceSchema.validate({ tax: -1 }).error,
    ).toBeDefined();
  });
});

describe("invoiceValidator.queryInvoiceSchema", () => {
  it("applies pagination defaults and accepts valid filters", () => {
    const { error, value } = invoiceValidator.queryInvoiceSchema.validate({
      status: "partially_paid",
      customerId: "507f1f77bcf86cd799439011",
      orderId: "507f1f77bcf86cd799439012",
      search: "  INV-0001  ",
      isOverdue: true,
    });

    expect(error).toBeUndefined();
    expect(value).toMatchObject({
      page: 1,
      limit: 10,
      search: "INV-0001",
      isOverdue: true,
    });
  });

  it.each([
    ["invalid status", { status: "refunded" }],
    ["invalid customer ID", { customerId: "customer-1" }],
    ["fractional page", { page: 1.5 }],
    ["excessive limit", { limit: 101 }],
    ["invalid overdue flag", { isOverdue: "yes" }],
    ["search over 100 characters", { search: "x".repeat(101) }],
  ])("rejects %s", (_case, query) => {
    expect(
      invoiceValidator.queryInvoiceSchema.validate(query).error,
    ).toBeDefined();
  });
});

describe("invoiceValidator parameter and cancellation schemas", () => {
  it("validates invoice IDs", () => {
    expect(
      invoiceValidator.paramInvoiceIdSchema.validate({
        invoiceId: "507f1f77bcf86cd799439011",
      }).error,
    ).toBeUndefined();
    expect(
      invoiceValidator.paramInvoiceIdSchema.validate({
        invoiceId: "invoice-1",
      }).error,
    ).toBeDefined();
  });

  it("requires a non-blank cancellation reason", () => {
    expect(
      invoiceValidator.cancelInvoiceSchema.validate({
        reason: "  Duplicate invoice  ",
      }).value.reason,
    ).toBe("Duplicate invoice");
    expect(
      invoiceValidator.cancelInvoiceSchema.validate({ reason: "   " }).error,
    ).toBeDefined();
    expect(
      invoiceValidator.cancelInvoiceSchema.validate({}).error,
    ).toBeDefined();
  });
});
