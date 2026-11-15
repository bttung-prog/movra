import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findActiveOrderIdsByCustomer: vi.fn(),
  sumOutstandingByCustomer: vi.fn(),
  sumUnbilledShippingFeeByCustomer: vi.fn(),
}));

vi.mock("../../../src/modules/invoice/invoice.service.js", () => ({
  default: {
    getActiveOrderIdsByCustomer: mocks.findActiveOrderIdsByCustomer,
    sumOutstandingByCustomer: mocks.sumOutstandingByCustomer,
  },
}));

vi.mock("../../../src/modules/order/order.service.js", () => ({
  default: {
    sumUnbilledShippingFeeByCustomer: mocks.sumUnbilledShippingFeeByCustomer,
  },
}));

import { CUSTOMER_MESSAGES } from "../../../src/constants/messages.js";
import { PAYMENT_TERMS } from "../../../src/constants/paymentTerms.js";
import customerCreditService from "../../../src/modules/customer/customerCredit.service.js";

const customer = { _id: "customer-1", creditLimit: 500000 };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findActiveOrderIdsByCustomer.mockResolvedValue([]);
  mocks.sumOutstandingByCustomer.mockResolvedValue(0);
  mocks.sumUnbilledShippingFeeByCustomer.mockResolvedValue(0);
});

describe("customerCreditService.getCreditSnapshot", () => {
  it("aggregates invoiced debt and unbilled commitments", async () => {
    mocks.findActiveOrderIdsByCustomer.mockResolvedValue(["order-2"]);
    mocks.sumOutstandingByCustomer.mockResolvedValue(100000);
    mocks.sumUnbilledShippingFeeByCustomer.mockResolvedValue(50000);

    const snapshot = await customerCreditService.getCreditSnapshot(customer);

    expect(snapshot).toEqual({
      creditLimit: 500000,
      invoicedDebt: 100000,
      unbilledCommitment: 50000,
      totalDebt: 150000,
      availableCredit: 350000,
    });
    expect(mocks.findActiveOrderIdsByCustomer).toHaveBeenCalledWith(
      "customer-1",
    );
    expect(mocks.sumUnbilledShippingFeeByCustomer).toHaveBeenCalledWith(
      "customer-1",
      ["order-2"],
    );
  });

  it("normalizes missing or invalid debt values to zero", async () => {
    mocks.sumOutstandingByCustomer.mockResolvedValue(null);
    mocks.sumUnbilledShippingFeeByCustomer.mockResolvedValue(-10);

    const snapshot = await customerCreditService.getCreditSnapshot({
      _id: "customer-1",
      creditLimit: undefined,
    });

    expect(snapshot).toEqual({
      creditLimit: 0,
      invoicedDebt: 0,
      unbilledCommitment: 0,
      totalDebt: 0,
      availableCredit: 0,
    });
  });
});

describe("customerCreditService.assertCreditAvailable", () => {
  it("skips the check for immediate payment terms", async () => {
    await expect(
      customerCreditService.assertCreditAvailable({
        customer,
        paymentTerms: PAYMENT_TERMS.IMMEDIATE,
        additionalAmount: 10000,
      }),
    ).resolves.toBeNull();

    expect(mocks.findActiveOrderIdsByCustomer).not.toHaveBeenCalled();
  });

  it("skips the check when there is no additional amount", async () => {
    await expect(
      customerCreditService.assertCreditAvailable({
        customer,
        paymentTerms: PAYMENT_TERMS.NET_30,
        additionalAmount: 0,
      }),
    ).resolves.toBeNull();

    expect(mocks.findActiveOrderIdsByCustomer).not.toHaveBeenCalled();
  });

  it("rejects postpaid orders when no credit limit has been approved", async () => {
    await expect(
      customerCreditService.assertCreditAvailable({
        customer: { _id: "customer-1", creditLimit: 0 },
        paymentTerms: PAYMENT_TERMS.NET_30,
        additionalAmount: 10000,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: CUSTOMER_MESSAGES.CREDIT_LIMIT_NOT_APPROVED,
    });

    expect(mocks.findActiveOrderIdsByCustomer).not.toHaveBeenCalled();
  });

  it("resolves when the new order fits the available credit", async () => {
    mocks.findActiveOrderIdsByCustomer.mockResolvedValue(["order-2"]);
    mocks.sumOutstandingByCustomer.mockResolvedValue(100000);
    mocks.sumUnbilledShippingFeeByCustomer.mockResolvedValue(50000);

    const snapshot = await customerCreditService.assertCreditAvailable({
      customer,
      paymentTerms: PAYMENT_TERMS.NET_30,
      additionalAmount: 100000,
    });

    expect(snapshot).toMatchObject({
      totalDebt: 150000,
      availableCredit: 350000,
    });
  });

  it("rejects when the new order exceeds the available credit", async () => {
    mocks.findActiveOrderIdsByCustomer.mockResolvedValue(["order-2"]);
    mocks.sumOutstandingByCustomer.mockResolvedValue(400000);
    mocks.sumUnbilledShippingFeeByCustomer.mockResolvedValue(50000);

    await expect(
      customerCreditService.assertCreditAvailable({
        customer,
        paymentTerms: PAYMENT_TERMS.NET_30,
        additionalAmount: 100000,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: CUSTOMER_MESSAGES.CREDIT_LIMIT_EXCEEDED(50000, 100000),
    });
  });

  it("requires a loaded customer document", async () => {
    await expect(
      customerCreditService.assertCreditAvailable({
        customer: null,
        paymentTerms: PAYMENT_TERMS.NET_30,
        additionalAmount: 1000,
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: CUSTOMER_MESSAGES.NOT_FOUND,
    });
  });
});
