import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  startSession: vi.fn(),
  findAll: vi.fn(),
  countAll: vi.fn(),
  findById: vi.fn(),
  findByCode: vi.fn(),
  updateById: vi.fn(),
  findTopUpByReference: vi.fn(),
  findPendingRemittanceByOrderIds: vi.fn(),
  getStats: vi.fn(),
  getByOrderId: vi.fn(),
  getInvoiceById: vi.fn(),
  getInvoiceOrderIds: vi.fn((invoice) => {
    const orderIds = [];
    const seen = new Set();
    const addOrderId = (value) => {
      const id = value?._id || value;
      if (!id) return;
      const key = String(id);
      if (seen.has(key)) return;
      seen.add(key);
      orderIds.push(id);
    };

    for (const id of invoice?.orderIds || []) {
      addOrderId(id);
    }

    return orderIds;
  }),
  issueInvoice: vi.fn(),
  reservePendingPayment: vi.fn(),
  releasePendingPayment: vi.fn(),
  updatePaymentProgress: vi.fn(),
  getOrderById: vi.fn(),
  findOrdersForRemittance: vi.fn(),
  bulkUpdateOrders: vi.fn(),
  updateOrderById: vi.fn(),
  applyInvoicePayment: vi.fn(),
  getTripById: vi.fn(),
  getCustomerById: vi.fn(),
  updateCustomerById: vi.fn(),
  debitWallet: vi.fn(),
  recordTransaction: vi.fn(),
  generateCode: vi.fn(),
  notifyPaymentPending: vi.fn(),
  notifyPaymentCompleted: vi.fn(),
  notifyPaymentVerified: vi.fn(),
  notifyPaymentRejected: vi.fn(),
  notifyRefundCompleted: vi.fn(),
  notifyDriverRemittanceCreated: vi.fn(),
  notifyTopUpCompleted: vi.fn(),
  notifyTopUpRejected: vi.fn(),
  notifyTopUpRefunded: vi.fn(),
  notifyInvoicePaid: vi.fn(),
  notifyInvoicePartiallyPaid: vi.fn(),
}));

vi.mock("mongoose", async (importOriginal) => {
  const actual = await importOriginal();

  return {
    ...actual,
    default: { ...actual.default, startSession: mocks.startSession },
  };
});

vi.mock("../../../src/modules/payment/payment.repository.js", () => ({
  default: {
    create: mocks.create,
    findAll: mocks.findAll,
    countAll: mocks.countAll,
    findById: mocks.findById,
    findByCode: mocks.findByCode,
    updateById: mocks.updateById,
    findTopUpByReference: mocks.findTopUpByReference,
    findPendingRemittanceByOrderIds: mocks.findPendingRemittanceByOrderIds,
    getStats: mocks.getStats,
  },
}));

vi.mock("../../../src/modules/payment/paymentNotification.service.js", () => ({
  default: {
    notifyPaymentPending: mocks.notifyPaymentPending,
    notifyPaymentCompleted: mocks.notifyPaymentCompleted,
    notifyPaymentVerified: mocks.notifyPaymentVerified,
    notifyPaymentRejected: mocks.notifyPaymentRejected,
    notifyRefundCompleted: mocks.notifyRefundCompleted,
    notifyDriverRemittanceCreated: mocks.notifyDriverRemittanceCreated,
  },
}));

vi.mock(
  "../../../src/modules/walletTransaction/walletNotification.service.js",
  () => ({
    default: {
      notifyTopUpCompleted: mocks.notifyTopUpCompleted,
      notifyTopUpRejected: mocks.notifyTopUpRejected,
      notifyTopUpRefunded: mocks.notifyTopUpRefunded,
    },
  }),
);

vi.mock("../../../src/modules/invoice/invoiceNotification.service.js", () => ({
  default: {
    notifyInvoicePaid: mocks.notifyInvoicePaid,
    notifyInvoicePartiallyPaid: mocks.notifyInvoicePartiallyPaid,
  },
}));

vi.mock("../../../src/modules/invoice/invoice.service.js", () => ({
  default: {
    getByOrderId: mocks.getByOrderId,
    getById: mocks.getInvoiceById,
    getInvoiceOrderIds: mocks.getInvoiceOrderIds,
    issueInvoice: mocks.issueInvoice,
    reservePendingPayment: mocks.reservePendingPayment,
    releasePendingPayment: mocks.releasePendingPayment,
    updatePaymentProgress: mocks.updatePaymentProgress,
  },
}));

vi.mock("../../../src/modules/order/order.service.js", () => ({
  default: {
    getById: mocks.getOrderById,
    getOrdersForRemittance: mocks.findOrdersForRemittance,
    findOrdersForRemittance: mocks.findOrdersForRemittance,
    bulkUpdateOrders: mocks.bulkUpdateOrders,
    updateById: mocks.updateOrderById,
    applyInvoicePayment: mocks.applyInvoicePayment,
  },
}));

vi.mock("../../../src/modules/trip/trip.service.js", () => ({
  default: {
    getById: mocks.getTripById,
  },
}));

vi.mock("../../../src/modules/customer/customer.service.js", () => ({
  default: {
    getById: mocks.getCustomerById,
    updateById: mocks.updateCustomerById,
    debitWallet: mocks.debitWallet,
  },
}));

vi.mock(
  "../../../src/modules/walletTransaction/walletTransaction.service.js",
  () => ({
    default: { recordTransaction: mocks.recordTransaction },
  }),
);

vi.mock("../../../src/utils/generateCode.js", () => ({
  generateCode: mocks.generateCode,
}));

import {
  PAYMENT_METHODS,
  PAYER_TYPES,
} from "../../../src/constants/paymentMethods.js";
import { PAYMENT_STATUSES } from "../../../src/constants/paymentStatuses.js";
import { PAYMENT_PURPOSES } from "../../../src/constants/paymentPurposes.js";
import {
  INVOICE_MESSAGES,
  ORDER_MESSAGES,
  PAYMENT_MESSAGES,
} from "../../../src/constants/messages.js";
import { ROLES } from "../../../src/constants/roles.js";
import paymentService from "../../../src/modules/payment/payment.service.js";

const orderId = "order-1";
const customerId = "customer-1";
const paymentId = "payment-1";

const transaction = {
  startTransaction: vi.fn(),
  commitTransaction: vi.fn().mockResolvedValue(undefined),
  abortTransaction: vi.fn().mockResolvedValue(undefined),
  endSession: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.startSession.mockResolvedValue(transaction);
  mocks.generateCode.mockReturnValue("PAY-0001");
  mocks.getByOrderId.mockResolvedValue(null);
  mocks.issueInvoice.mockResolvedValue({});
  mocks.reservePendingPayment.mockResolvedValue({});
  mocks.releasePendingPayment.mockResolvedValue({});
  mocks.getOrderById.mockResolvedValue({
    _id: orderId,
    customerId,
    status: "created",
    shippingFee: 1000,
    shippingFeePaid: false,
    shippingFeePaidAmount: 0,
  });
  mocks.getCustomerById.mockResolvedValue({
    _id: customerId,
    walletBalance: 5000,
  });
  mocks.create.mockImplementation(async (paymentData) => ({
    _id: paymentId,
    ...paymentData,
  }));
  mocks.findAll.mockResolvedValue([]);
  mocks.countAll.mockResolvedValue(0);
  mocks.findById.mockResolvedValue(null);
  mocks.updateById.mockResolvedValue(null);
  mocks.findPendingRemittanceByOrderIds.mockResolvedValue(null);
  mocks.recordTransaction.mockResolvedValue({
    _id: "wallet-transaction-1",
    transactionCode: "WTRX-0001",
    direction: "credit",
    amount: 1000,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("paymentService.create", () => {
  it("completes wallet payments through the linked invoice and updates the order", async () => {
    const invoice = {
      _id: "invoice-1",
      orderIds: [orderId],
      customerId,
      status: "issued",
      paidAmount: 0,
      remainingAmount: 1000,
      pendingAmount: 0,
    };
    mocks.getByOrderId.mockResolvedValue(invoice);
    mocks.getInvoiceById.mockResolvedValue(invoice);
    mocks.updatePaymentProgress.mockResolvedValue({ _id: invoice._id });
    mocks.updateOrderById.mockResolvedValue({ _id: orderId });
    mocks.updateCustomerById.mockResolvedValue({
      _id: customerId,
      walletBalance: 4000,
    });

    const payment = await paymentService.create(
      {
        orderId,
        paymentAmount: 1000,
        paymentMethod: PAYMENT_METHODS.WALLET_BALANCE,
      },
      { role: ROLES.CUSTOMER, customerId },
    );

    expect(payment.paymentStatus).toBe(PAYMENT_STATUSES.COMPLETED);
    expect(payment.invoiceId).toBe(invoice._id);
    expect(mocks.updatePaymentProgress).toHaveBeenCalledWith(
      invoice._id,
      expect.objectContaining({
        paidAmount: 1000,
        remainingAmount: 0,
      }),
      transaction,
      expect.any(Object),
    );
    expect(mocks.updateOrderById).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId,
        updateData: expect.objectContaining({
          paymentMethod: PAYMENT_METHODS.WALLET_BALANCE,
          shippingFeePaid: true,
        }),
      }),
    );
    expect(mocks.updateCustomerById).toHaveBeenCalledWith(
      customerId,
      expect.objectContaining({
        $inc: {
          walletBalance: -1000,
        },
      }),
      transaction,
      { walletBalance: { $gte: 1000 } },
    );
    expect(mocks.recordTransaction).toHaveBeenCalled();
    expect(transaction.commitTransaction).toHaveBeenCalled();
  });

  it("records the wallet debit without awarding loyalty points for an already delivered order", async () => {
    const invoice = {
      _id: "invoice-1",
      orderIds: [orderId],
      customerId,
      status: "issued",
      paidAmount: 0,
      remainingAmount: 10000,
      pendingAmount: 0,
    };
    mocks.getByOrderId.mockResolvedValue(invoice);
    mocks.getInvoiceById.mockResolvedValue(invoice);
    mocks.updatePaymentProgress.mockResolvedValue({ _id: invoice._id });
    mocks.getOrderById.mockResolvedValue({
      _id: orderId,
      customerId,
      status: "delivered",
      shippingFee: 10000,
      shippingFeePaid: false,
      shippingFeePaidAmount: 0,
    });
    mocks.updateOrderById.mockResolvedValue({ _id: orderId });
    mocks.getCustomerById.mockResolvedValue({
      _id: customerId,
      walletBalance: 20000,
    });
    mocks.updateCustomerById.mockResolvedValue({
      _id: customerId,
      walletBalance: 10000,
    });

    const payment = await paymentService.create(
      {
        orderId,
        paymentAmount: 10000,
        paymentMethod: PAYMENT_METHODS.WALLET_BALANCE,
      },
      { role: ROLES.CUSTOMER, customerId },
    );

    expect(payment.paymentStatus).toBe(PAYMENT_STATUSES.COMPLETED);
    expect(mocks.updateCustomerById).toHaveBeenCalledWith(
      customerId,
      expect.objectContaining({
        lastPurchaseDate: expect.any(Date),
        $inc: {
          walletBalance: -10000,
        },
      }),
      transaction,
      { walletBalance: { $gte: 10000 } },
    );
    expect(mocks.updateOrderById).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId,
        updateData: expect.not.objectContaining({
          loyaltyPointsAwarded: true,
        }),
      }),
    );
  });

  it("does not add spending totals or loyalty points for a partial payment", async () => {
    const invoice = {
      _id: "invoice-1",
      orderIds: [orderId],
      customerId,
      status: "issued",
      paidAmount: 0,
      remainingAmount: 10000,
      pendingAmount: 0,
    };
    mocks.getByOrderId.mockResolvedValue(invoice);
    mocks.getInvoiceById.mockResolvedValue(invoice);
    mocks.updatePaymentProgress.mockResolvedValue({ _id: invoice._id });
    mocks.getOrderById.mockResolvedValue({
      _id: orderId,
      customerId,
      status: "delivered",
      shippingFee: 10000,
      shippingFeePaid: false,
      shippingFeePaidAmount: 0,
    });
    mocks.updateOrderById.mockResolvedValue({ _id: orderId });
    mocks.getCustomerById.mockResolvedValue({
      _id: customerId,
      walletBalance: 20000,
    });
    mocks.updateCustomerById.mockResolvedValue({
      _id: customerId,
      walletBalance: 16000,
    });

    const payment = await paymentService.create(
      {
        orderId,
        paymentAmount: 4000,
        paymentMethod: PAYMENT_METHODS.WALLET_BALANCE,
      },
      { role: ROLES.CUSTOMER, customerId },
    );

    expect(payment.paymentStatus).toBe(PAYMENT_STATUSES.COMPLETED);
    expect(mocks.updateCustomerById).toHaveBeenCalledWith(
      customerId,
      expect.objectContaining({
        lastPurchaseDate: expect.any(Date),
        $inc: {
          walletBalance: -4000,
        },
      }),
      transaction,
      { walletBalance: { $gte: 4000 } },
    );
    expect(mocks.updateCustomerById).toHaveBeenCalledWith(
      customerId,
      expect.not.objectContaining({
        $inc: expect.objectContaining({
          totalSpent: expect.anything(),
        }),
      }),
      transaction,
      { walletBalance: { $gte: 4000 } },
    );
    expect(mocks.updateOrderById).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId,
        updateData: expect.not.objectContaining({
          loyaltyPointsAwarded: true,
        }),
      }),
    );
  });

  it("keeps bank-transfer payments pending until verification", async () => {
    vi.stubEnv("VIETQR_BANK_ID", "970422");
    vi.stubEnv("VIETQR_ACCOUNT_NUMBER", "1234567890");
    vi.stubEnv("VIETQR_ACCOUNT_NAME", "MOVRA");
    const invoice = {
      _id: "invoice-1",
      orderIds: [orderId],
      customerId,
      status: "issued",
      remainingAmount: 1000,
      pendingAmount: 0,
    };
    mocks.getByOrderId.mockResolvedValue(invoice);
    mocks.getInvoiceById.mockResolvedValue(invoice);

    const payment = await paymentService.create(
      {
        orderId,
        paymentAmount: 1000,
        paymentMethod: PAYMENT_METHODS.BANK,
      },
      { role: ROLES.CUSTOMER, customerId },
    );

    expect(payment.paymentStatus).toBe(PAYMENT_STATUSES.PENDING);
    expect(payment.invoiceId).toBe(invoice._id);
    expect(payment.invoiceAmountReserved).toBe(true);
    expect(payment.qrCodeUrl).toContain(
      "https://img.vietqr.io/image/970422-1234567890-compact2.png?",
    );
    expect(payment.qrCodeUrl).toContain("amount=1000");
    expect(payment.qrCodeUrl).toContain("addInfo=PAY-0001");
    expect(mocks.updateOrderById).not.toHaveBeenCalled();
    expect(mocks.updateCustomerById).not.toHaveBeenCalled();
    expect(transaction.commitTransaction).toHaveBeenCalled();
    expect(mocks.notifyPaymentPending).toHaveBeenCalledWith(
      expect.objectContaining({
        includeAccountants: true,
      }),
    );
  });

  it("issues a draft invoice and reserves its balance for a pending bank payment", async () => {
    vi.stubEnv("VIETQR_BANK_ID", "970422");
    vi.stubEnv("VIETQR_ACCOUNT_NUMBER", "1234567890");
    mocks.getInvoiceById.mockResolvedValue({
      _id: "invoice-1",
      customerId,
      orderIds: [],
      status: "draft",
      remainingAmount: 3000,
      pendingAmount: 0,
    });

    const payment = await paymentService.create(
      {
        invoiceId: "invoice-1",
        paymentAmount: 1000,
        paymentMethod: PAYMENT_METHODS.BANK,
      },
      { role: ROLES.CUSTOMER, customerId },
    );

    expect(mocks.issueInvoice).toHaveBeenCalledWith(
      "invoice-1",
      null,
      transaction,
    );
    expect(mocks.reservePendingPayment).toHaveBeenCalledWith(
      "invoice-1",
      1000,
      transaction,
    );
    expect(payment).toMatchObject({
      invoiceId: "invoice-1",
      paymentStatus: PAYMENT_STATUSES.PENDING,
      invoiceAmountReserved: true,
    });
    expect(transaction.commitTransaction).toHaveBeenCalled();
  });

  it("rolls back issuing when a pending payment cannot reserve its invoice balance", async () => {
    vi.stubEnv("VIETQR_BANK_ID", "970422");
    vi.stubEnv("VIETQR_ACCOUNT_NUMBER", "1234567890");
    mocks.getInvoiceById.mockResolvedValue({
      _id: "invoice-1",
      customerId,
      orderIds: [],
      status: "draft",
      remainingAmount: 3000,
      pendingAmount: 0,
    });
    mocks.reservePendingPayment.mockResolvedValue(null);

    await expect(
      paymentService.create(
        {
          invoiceId: "invoice-1",
          paymentAmount: 1000,
          paymentMethod: PAYMENT_METHODS.BANK,
        },
        { role: ROLES.CUSTOMER, customerId },
      ),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(mocks.issueInvoice).toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(transaction.abortTransaction).toHaveBeenCalled();
  });

  it("rejects bank payments when VietQR account configuration is missing", async () => {
    vi.stubEnv("VIETQR_BANK_ID", "");
    vi.stubEnv("VIETQR_ACCOUNT_NUMBER", "");
    mocks.getInvoiceById.mockResolvedValue({
      _id: "invoice-1",
      customerId,
      status: "issued",
      remainingAmount: 1000,
      pendingAmount: 0,
    });

    await expect(
      paymentService.create(
        {
          invoiceId: "invoice-1",
          paymentAmount: 1000,
          paymentMethod: PAYMENT_METHODS.BANK,
        },
        { role: ROLES.CUSTOMER, customerId },
      ),
    ).rejects.toMatchObject({
      statusCode: 500,
    });

    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.startSession).not.toHaveBeenCalled();
  });

  it("rejects customer attempts to submit a driver payment before creating a transaction", async () => {
    await expect(
      paymentService.create(
        {
          orderId,
          payerType: PAYER_TYPES.DRIVER,
          paymentAmount: 500,
          paymentMethod: PAYMENT_METHODS.CASH,
        },
        { role: ROLES.CUSTOMER, customerId },
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: PAYMENT_MESSAGES.CUSTOMER_PAYER_TYPE_ONLY,
    });

    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects order payments when no invoice exists", async () => {
    await expect(
      paymentService.create(
        {
          orderId,
          paymentAmount: 1000,
          paymentMethod: PAYMENT_METHODS.CASH,
        },
        { role: ROLES.CUSTOMER, customerId },
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: PAYMENT_MESSAGES.ORDER_INVOICE_REQUIRED,
    });

    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.startSession).not.toHaveBeenCalled();
  });

  it("rejects an invoice that belongs to a different order", async () => {
    mocks.getInvoiceById.mockResolvedValue({
      _id: "invoice-1",
      orderIds: ["another-order"],
      customerId,
      status: "issued",
      remainingAmount: 1000,
      pendingAmount: 0,
    });

    await expect(
      paymentService.create(
        {
          invoiceId: "invoice-1",
          orderId,
          paymentAmount: 1000,
          paymentMethod: PAYMENT_METHODS.CASH,
        },
        { role: ROLES.CUSTOMER, customerId },
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: INVOICE_MESSAGES.ORDER_MISMATCH,
    });

    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.startSession).not.toHaveBeenCalled();
  });
});

describe("paymentService.verify", () => {
  it("does not complete legacy order payments without an invoice", async () => {
    mocks.findById.mockResolvedValue({
      _id: paymentId,
      orderId,
      paymentStatus: PAYMENT_STATUSES.PENDING,
      paymentAmount: 1000,
      paymentMethod: PAYMENT_METHODS.CASH,
      payerType: PAYER_TYPES.CUSTOMER,
    });
    mocks.updateById.mockResolvedValue({
      _id: paymentId,
      paymentStatus: PAYMENT_STATUSES.COMPLETED,
    });

    await expect(
      paymentService.verify(
        paymentId,
        { status: PAYMENT_STATUSES.COMPLETED },
        { userId: "admin-1", role: ROLES.ADMIN },
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: PAYMENT_MESSAGES.ORDER_INVOICE_REQUIRED,
    });

    expect(mocks.updateOrderById).not.toHaveBeenCalled();
    expect(transaction.abortTransaction).toHaveBeenCalled();
  });

  it("does not settle an order using an unrelated invoice", async () => {
    mocks.findById.mockResolvedValue({
      _id: paymentId,
      invoiceId: "invoice-1",
      orderId,
      paymentStatus: PAYMENT_STATUSES.PENDING,
      paymentAmount: 1000,
      paymentMethod: PAYMENT_METHODS.BANK,
      payerType: PAYER_TYPES.CUSTOMER,
    });
    mocks.getInvoiceById.mockResolvedValue({
      _id: "invoice-1",
      orderIds: ["another-order"],
      status: "issued",
      paidAmount: 0,
      remainingAmount: 1000,
    });
    mocks.updateById.mockResolvedValue({
      _id: paymentId,
      paymentStatus: PAYMENT_STATUSES.COMPLETED,
    });

    await expect(
      paymentService.verify(
        paymentId,
        { status: PAYMENT_STATUSES.COMPLETED },
        { userId: "admin-1", role: ROLES.ADMIN },
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: INVOICE_MESSAGES.ORDER_MISMATCH,
    });

    expect(mocks.updatePaymentProgress).not.toHaveBeenCalled();
    expect(mocks.updateOrderById).not.toHaveBeenCalled();
    expect(transaction.abortTransaction).toHaveBeenCalled();
  });

  it("notifies the customer when a wallet top-up is verified", async () => {
    const customer = {
      _id: customerId,
      userId: { _id: "customer-user-1" },
      walletBalance: 5000,
    };
    mocks.findById.mockResolvedValue({
      _id: paymentId,
      customerId: customer,
      paymentStatus: PAYMENT_STATUSES.PENDING,
      paymentAmount: 1000,
      paymentMethod: PAYMENT_METHODS.BANK,
      payerType: PAYER_TYPES.CUSTOMER,
      purpose: PAYMENT_PURPOSES.WALLET_TOP_UP,
    });
    mocks.getCustomerById.mockResolvedValue(customer);
    mocks.updateById.mockResolvedValue({
      _id: paymentId,
      paymentStatus: PAYMENT_STATUSES.COMPLETED,
      paymentCode: "PAY-0001",
      customerId: customer,
    });

    await paymentService.verify(
      paymentId,
      { status: PAYMENT_STATUSES.COMPLETED },
      { userId: "admin-1", role: ROLES.ADMIN },
    );

    expect(mocks.getCustomerById).toHaveBeenCalledWith(customerId, transaction);
    expect(mocks.updateCustomerById).toHaveBeenCalledWith(
      customerId,
      { $inc: { walletBalance: 1000 } },
      transaction,
    );
    expect(mocks.notifyTopUpCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        customer,
        balanceBefore: 5000,
        balanceAfter: 6000,
        walletTransaction: expect.objectContaining({ _id: "wallet-transaction-1" }),
      }),
    );
    expect(mocks.notifyPaymentVerified).not.toHaveBeenCalled();
  });

  it("notifies the customer when a wallet top-up is rejected", async () => {
    mocks.findById.mockResolvedValue({
      _id: paymentId,
      paymentStatus: PAYMENT_STATUSES.PENDING,
      purpose: PAYMENT_PURPOSES.WALLET_TOP_UP,
      notes: "Wallet top-up",
    });
    mocks.updateById.mockResolvedValue({
      _id: paymentId,
      paymentStatus: PAYMENT_STATUSES.FAILED,
    });

    await paymentService.verify(
      paymentId,
      { status: PAYMENT_STATUSES.FAILED, notes: "Invalid reference" },
      { userId: "admin-1", role: ROLES.ADMIN },
    );

    expect(mocks.notifyTopUpRejected).toHaveBeenCalledWith(
      expect.objectContaining({
        payment: expect.objectContaining({ _id: paymentId }),
        notes: "Invalid reference",
      }),
    );
    expect(mocks.notifyPaymentRejected).not.toHaveBeenCalled();
  });

  it("marks a pending payment failed without opening a transaction", async () => {
    mocks.findById.mockResolvedValue({
      _id: paymentId,
      paymentStatus: PAYMENT_STATUSES.PENDING,
      notes: "Customer transfer",
    });
    mocks.updateById.mockResolvedValue({
      _id: paymentId,
      paymentStatus: PAYMENT_STATUSES.FAILED,
      notes: "Customer transfer | Từ chối: Invalid reference",
    });

    const result = await paymentService.verify(
      paymentId,
      { status: PAYMENT_STATUSES.FAILED, notes: "Invalid reference" },
      { userId: "admin-1", role: ROLES.ADMIN },
    );

    expect(result.paymentStatus).toBe(PAYMENT_STATUSES.FAILED);
    expect(mocks.updateById).toHaveBeenCalledWith(
      paymentId,
      expect.objectContaining({
        paymentStatus: PAYMENT_STATUSES.FAILED,
        handledBy: "admin-1",
      }),
      null,
      { paymentStatus: PAYMENT_STATUSES.PENDING },
    );
    expect(mocks.findById).toHaveBeenCalledWith(paymentId);
    expect(mocks.notifyPaymentRejected).toHaveBeenCalledWith(
      expect.objectContaining({
        payment: expect.objectContaining({ _id: paymentId }),
        notes: "Invalid reference",
      }),
    );
  });

  it("releases a reserved invoice amount when a pending payment is rejected", async () => {
    mocks.findById.mockResolvedValue({
      _id: paymentId,
      invoiceId: "invoice-1",
      paymentAmount: 1000,
      invoiceAmountReserved: true,
      paymentStatus: PAYMENT_STATUSES.PENDING,
      notes: "",
    });
    mocks.updateById.mockResolvedValue({
      _id: paymentId,
      paymentStatus: PAYMENT_STATUSES.FAILED,
    });

    await paymentService.verify(
      paymentId,
      { status: PAYMENT_STATUSES.FAILED, notes: "Invalid reference" },
      { userId: "admin-1", role: ROLES.ADMIN },
    );

    expect(mocks.updateById).toHaveBeenCalledWith(
      paymentId,
      expect.objectContaining({
        paymentStatus: PAYMENT_STATUSES.FAILED,
        invoiceAmountReserved: false,
      }),
      transaction,
      {
        paymentStatus: PAYMENT_STATUSES.PENDING,
        invoiceAmountReserved: true,
      },
    );
    expect(mocks.releasePendingPayment).toHaveBeenCalledWith(
      "invoice-1",
      1000,
      transaction,
    );
    expect(transaction.commitTransaction).toHaveBeenCalled();
  });

  it("releases the reservation when a pending invoice payment is completed", async () => {
    mocks.findById.mockResolvedValue({
      _id: paymentId,
      invoiceId: "invoice-1",
      customerId,
      paymentAmount: 1000,
      paymentMethod: PAYMENT_METHODS.BANK,
      payerType: PAYER_TYPES.CUSTOMER,
      invoiceAmountReserved: true,
      paymentStatus: PAYMENT_STATUSES.PENDING,
    });
    mocks.getInvoiceById.mockResolvedValue({
      _id: "invoice-1",
      customerId,
      status: "issued",
      paidAmount: 0,
      remainingAmount: 3000,
      pendingAmount: 1000,
    });
    mocks.updateById.mockResolvedValue({
      _id: paymentId,
      paymentStatus: PAYMENT_STATUSES.COMPLETED,
    });
    mocks.updatePaymentProgress.mockResolvedValue({ _id: "invoice-1" });

    await paymentService.verify(
      paymentId,
      { status: PAYMENT_STATUSES.COMPLETED },
      { userId: "admin-1", role: ROLES.ADMIN },
    );

    expect(mocks.updatePaymentProgress).toHaveBeenCalledWith(
      "invoice-1",
      expect.objectContaining({
        paidAmount: 1000,
        remainingAmount: 2000,
        $inc: { pendingAmount: -1000 },
      }),
      transaction,
      expect.objectContaining({ pendingAmount: { $gte: 1000 } }),
    );
    expect(mocks.updateById).toHaveBeenCalledWith(
      paymentId,
      expect.objectContaining({
        paymentStatus: PAYMENT_STATUSES.COMPLETED,
        invoiceAmountReserved: false,
      }),
      transaction,
      { paymentStatus: PAYMENT_STATUSES.PENDING },
    );
    expect(transaction.commitTransaction).toHaveBeenCalled();
  });

  it("rejects verification when the payment is no longer pending", async () => {
    mocks.findById.mockResolvedValue({
      _id: paymentId,
      paymentStatus: PAYMENT_STATUSES.COMPLETED,
    });

    await expect(
      paymentService.verify(
        paymentId,
        { status: PAYMENT_STATUSES.FAILED },
        { userId: "admin-1", role: ROLES.ADMIN },
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: PAYMENT_MESSAGES.ALREADY_VERIFIED,
    });
    expect(mocks.updateById).not.toHaveBeenCalled();
  });

  it("updates COD orders via bulkUpdateOrders when verifying driver remittance payment", async () => {
    mocks.findById.mockResolvedValue({
      _id: paymentId,
      payerType: PAYER_TYPES.DRIVER,
      paymentStatus: PAYMENT_STATUSES.PENDING,
      codOrders: [
        {
          orderId,
          collectedAmount: 0,
          remittedAmount: 5000,
        },
      ],
    });
    mocks.updateById.mockResolvedValue({
      _id: paymentId,
      paymentStatus: PAYMENT_STATUSES.COMPLETED,
    });
    mocks.findOrdersForRemittance.mockResolvedValue([
      {
        _id: orderId,
        status: "delivered",
        codAmount: 5000,
        codCollectedAmount: 5000,
        codRemittedAmount: 0,
      },
    ]);
    mocks.bulkUpdateOrders.mockResolvedValue({
      matchedCount: 1,
      modifiedCount: 1,
    });

    const result = await paymentService.verify(
      paymentId,
      { status: PAYMENT_STATUSES.COMPLETED },
      { userId: "admin-1", role: ROLES.ADMIN },
    );

    expect(result.paymentStatus).toBe(PAYMENT_STATUSES.COMPLETED);
    expect(mocks.findOrdersForRemittance).toHaveBeenCalledWith(
      [orderId],
      transaction,
    );
    expect(mocks.bulkUpdateOrders).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          updateOne: expect.objectContaining({
            filter: expect.objectContaining({ _id: orderId }),
          }),
        }),
      ]),
      transaction,
    );

    const [bulkOps] = mocks.bulkUpdateOrders.mock.calls[0];
    expect(bulkOps[0].updateOne.update.$set).not.toHaveProperty(
      "paymentStatus",
    );
    expect(bulkOps[0].updateOne.update.$set).not.toHaveProperty("paymentTime");
    expect(transaction.commitTransaction).toHaveBeenCalled();
  });

  it("rejects remittance verification when a COD order is not delivered", async () => {
    mocks.findById.mockResolvedValue({
      _id: paymentId,
      payerType: PAYER_TYPES.DRIVER,
      paymentStatus: PAYMENT_STATUSES.PENDING,
      codOrders: [
        {
          orderId,
          collectedAmount: 0,
          remittedAmount: 5000,
        },
      ],
    });
    mocks.updateById.mockResolvedValue({
      _id: paymentId,
      paymentStatus: PAYMENT_STATUSES.COMPLETED,
    });
    mocks.findOrdersForRemittance.mockResolvedValue([
      {
        _id: orderId,
        status: "shipping",
        codAmount: 5000,
        codCollectedAmount: 0,
        codRemittedAmount: 0,
      },
    ]);

    await expect(
      paymentService.verify(
        paymentId,
        { status: PAYMENT_STATUSES.COMPLETED },
        { userId: "admin-1", role: ROLES.ADMIN },
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: PAYMENT_MESSAGES.ORDER_NOT_DELIVERED,
    });

    expect(mocks.bulkUpdateOrders).not.toHaveBeenCalled();
    expect(transaction.abortTransaction).toHaveBeenCalled();
  });

  it("rejects remittance verification when bulkUpdateOrders has conflict", async () => {
    mocks.findById.mockResolvedValue({
      _id: paymentId,
      payerType: PAYER_TYPES.DRIVER,
      paymentStatus: PAYMENT_STATUSES.PENDING,
      codOrders: [
        {
          orderId,
          collectedAmount: 0,
          remittedAmount: 5000,
        },
      ],
    });
    mocks.updateById.mockResolvedValue({
      _id: paymentId,
      paymentStatus: PAYMENT_STATUSES.COMPLETED,
    });
    mocks.findOrdersForRemittance.mockResolvedValue([
      {
        _id: orderId,
        status: "delivered",
        codAmount: 5000,
        codCollectedAmount: 5000,
        codRemittedAmount: 0,
      },
    ]);
    mocks.bulkUpdateOrders.mockResolvedValue({
      matchedCount: 0,
      modifiedCount: 0,
    });

    await expect(
      paymentService.verify(
        paymentId,
        { status: PAYMENT_STATUSES.COMPLETED },
        { userId: "admin-1", role: ROLES.ADMIN },
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: PAYMENT_MESSAGES.COD_AMOUNT_CHANGED,
    });

    expect(transaction.abortTransaction).toHaveBeenCalled();
  });

  it("rejects remittance verification when a COD order no longer exists", async () => {
    mocks.findById.mockResolvedValue({
      _id: paymentId,
      payerType: PAYER_TYPES.DRIVER,
      paymentStatus: PAYMENT_STATUSES.PENDING,
      codOrders: [
        {
          orderId,
          collectedAmount: 0,
          remittedAmount: 5000,
        },
      ],
    });
    mocks.updateById.mockResolvedValue({
      _id: paymentId,
      paymentStatus: PAYMENT_STATUSES.COMPLETED,
    });
    mocks.findOrdersForRemittance.mockResolvedValue([]);

    await expect(
      paymentService.verify(
        paymentId,
        { status: PAYMENT_STATUSES.COMPLETED },
        { userId: "admin-1", role: ROLES.ADMIN },
      ),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: ORDER_MESSAGES.NOT_FOUND,
    });

    expect(mocks.bulkUpdateOrders).not.toHaveBeenCalled();
    expect(transaction.commitTransaction).not.toHaveBeenCalled();
    expect(transaction.abortTransaction).toHaveBeenCalled();
  });
});

describe("paymentService.getAll", () => {
  it("applies pagination offsets and returns pagination metadata", async () => {
    const payments = [{ _id: paymentId }];
    mocks.findAll.mockResolvedValue(payments);
    mocks.countAll.mockResolvedValue(21);

    const result = await paymentService.getAll({
      filter: { paymentStatus: PAYMENT_STATUSES.PENDING },
      page: 2,
      limit: 10,
    });

    expect(mocks.findAll).toHaveBeenCalledWith({
      filter: { paymentStatus: PAYMENT_STATUSES.PENDING },
      skip: 10,
      limit: 10,
      sort: { createdAt: -1 },
    });
    expect(mocks.countAll).toHaveBeenCalledWith({
      filter: { paymentStatus: PAYMENT_STATUSES.PENDING },
    });
    expect(result).toEqual({
      data: payments,
      pagination: { page: 2, limit: 10, total: 21, totalPages: 3 },
    });
  });
});

describe("paymentService.createDriverRemittance", () => {
  const driverUser = { driverId: "driver-1" };
  const deliveredCodOrder = {
    _id: orderId,
    status: "delivered",
    codSettled: false,
    codAmount: 5000,
    codCollected: true,
    codCollectedAmount: 5000,
    codRemittedAmount: 0,
    tripId: {
      _id: "trip-1",
      driverId: { _id: "driver-1" },
    },
  };

  it("rejects remittance when duplicate orderIds are provided", async () => {
    await expect(
      paymentService.createDriverRemittance(
        {
          orderIds: [orderId, orderId],
          paymentAmount: 5000,
          paymentMethod: PAYMENT_METHODS.CASH,
        },
        driverUser,
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: PAYMENT_MESSAGES.DUPLICATE_COD_ORDER,
    });

    expect(mocks.findOrdersForRemittance).not.toHaveBeenCalled();
  });

  it("rejects remittance when an order is not found", async () => {
    mocks.findOrdersForRemittance.mockResolvedValue([]);

    await expect(
      paymentService.createDriverRemittance(
        {
          orderIds: [orderId],
          paymentAmount: 5000,
          paymentMethod: PAYMENT_METHODS.CASH,
        },
        driverUser,
      ),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: ORDER_MESSAGES.NOT_FOUND,
    });

    expect(mocks.findOrdersForRemittance).toHaveBeenCalledWith([orderId]);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects remittance when an order already has a pending remittance payment", async () => {
    mocks.findOrdersForRemittance.mockResolvedValue([deliveredCodOrder]);
    mocks.findPendingRemittanceByOrderIds.mockResolvedValue({
      _id: "existing-payment-id",
      paymentCode: "PAY-PENDING-01",
    });

    await expect(
      paymentService.createDriverRemittance(
        {
          orderIds: [orderId],
          paymentAmount: 5000,
          paymentMethod: PAYMENT_METHODS.CASH,
        },
        driverUser,
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: PAYMENT_MESSAGES.PENDING_REMITTANCE_EXISTS("PAY-PENDING-01"),
    });

    expect(mocks.findPendingRemittanceByOrderIds).toHaveBeenCalledWith([
      orderId,
    ]);

    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects remittance when paymentAmount does not match total expected COD", async () => {
    mocks.findOrdersForRemittance.mockResolvedValue([deliveredCodOrder]);
    mocks.findPendingRemittanceByOrderIds.mockResolvedValue(null);
  mocks.recordTransaction.mockResolvedValue({
    _id: "wallet-transaction-1",
    transactionCode: "WTRX-0001",
    direction: "credit",
    amount: 1000,
  });

    await expect(
      paymentService.createDriverRemittance(
        {
          orderIds: [orderId],
          paymentAmount: 3000,
          paymentMethod: PAYMENT_METHODS.CASH,
        },
        driverUser,
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: PAYMENT_MESSAGES.REMITTANCE_AMOUNT_MISMATCH(5000),
    });

    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects remittance when an order is already fully remitted", async () => {
    mocks.findOrdersForRemittance.mockResolvedValue([
      {
        ...deliveredCodOrder,
        codRemittedAmount: 5000,
      },
    ]);

    await expect(
      paymentService.createDriverRemittance(
        {
          orderIds: [orderId],
          paymentAmount: 5000,
          paymentMethod: PAYMENT_METHODS.CASH,
        },
        driverUser,
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: PAYMENT_MESSAGES.COD_ALREADY_REMITTED,
    });

    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("creates a pending remittance when no pending remittance exists", async () => {
    mocks.findOrdersForRemittance.mockResolvedValue([deliveredCodOrder]);
    mocks.findPendingRemittanceByOrderIds.mockResolvedValue(null);
  mocks.recordTransaction.mockResolvedValue({
    _id: "wallet-transaction-1",
    transactionCode: "WTRX-0001",
    direction: "credit",
    amount: 1000,
  });

    const result = await paymentService.createDriverRemittance(
      {
        orderIds: [orderId],
        paymentAmount: 5000,
        paymentMethod: PAYMENT_METHODS.CASH,
      },
      driverUser,
    );

    expect(mocks.findOrdersForRemittance).toHaveBeenCalledWith([orderId]);
    expect(mocks.findPendingRemittanceByOrderIds).toHaveBeenCalledWith([
      orderId,
    ]);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentStatus: PAYMENT_STATUSES.PENDING,
        payerType: PAYER_TYPES.DRIVER,
        paymentAmount: 5000,
      }),
    );
    expect(result).toMatchObject({
      paymentStatus: PAYMENT_STATUSES.PENDING,
      paymentAmount: 5000,
    });
    expect(mocks.notifyDriverRemittanceCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        payment: result,
      }),
    );
  });
});

describe("paymentService.refund", () => {
  const basePayment = {
    _id: paymentId,
    paymentStatus: PAYMENT_STATUSES.COMPLETED,
    paymentAmount: 10000,
    refundedAmount: 0,
    paymentMethod: PAYMENT_METHODS.CASH,
    payerType: PAYER_TYPES.CUSTOMER,
    customerId,
    orderId,
    invoiceId: null,
  };

  it("reverses recognized spending when refunding a delivered order payment", async () => {
    mocks.findById.mockResolvedValue(basePayment);
    mocks.updateById.mockResolvedValue({ _id: paymentId });
    mocks.getOrderById.mockResolvedValue({
      _id: orderId,
      status: "delivered",
      shippingFee: 10000,
      shippingFeePaid: true,
      shippingFeePaidAmount: 10000,
    });
    mocks.getCustomerById.mockResolvedValue({
      _id: customerId,
      totalSpent: 10000,
      walletBalance: 0,
    });
    mocks.updateCustomerById.mockResolvedValue({ _id: customerId });

    await paymentService.refund(
      paymentId,
      { reason: "Damaged goods", refundAmount: 4000 },
      { role: ROLES.ACCOUNTANT, userId: "user-9" },
    );

    expect(mocks.updateCustomerById).toHaveBeenCalledWith(
      customerId,
      { $inc: { totalSpent: -4000 } },
      transaction,
      { totalSpent: { $gte: 4000 } },
    );
    expect(mocks.notifyRefundCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        refundAmount: 4000,
      }),
    );
  });

  it("does not reverse spending when refunding an order that was not delivered", async () => {
    mocks.findById.mockResolvedValue(basePayment);
    mocks.updateById.mockResolvedValue({ _id: paymentId });
    mocks.getOrderById.mockResolvedValue({
      _id: orderId,
      status: "transporting",
      shippingFee: 10000,
      shippingFeePaid: true,
      shippingFeePaidAmount: 10000,
    });
    mocks.getCustomerById.mockResolvedValue({
      _id: customerId,
      totalSpent: 0,
      walletBalance: 0,
    });

    await paymentService.refund(
      paymentId,
      { reason: "Customer request", refundAmount: 4000 },
      { role: ROLES.ACCOUNTANT, userId: "user-9" },
    );

    expect(mocks.updateCustomerById).not.toHaveBeenCalled();
  });

  it("notifies the customer when a wallet top-up is refunded", async () => {
    const customer = {
      _id: customerId,
      userId: { _id: "customer-user-1" },
      walletBalance: 5000,
    };
    const walletPayment = {
      ...basePayment,
      orderId: null,
      invoiceId: null,
      purpose: PAYMENT_PURPOSES.WALLET_TOP_UP,
      customerId: customer,
      paymentMethod: PAYMENT_METHODS.BANK,
    };
    const updatedPayment = {
      ...walletPayment,
      paymentStatus: PAYMENT_STATUSES.REFUNDED,
    };
    const walletTransaction = {
      _id: "wallet-transaction-2",
      transactionCode: "WTRX-0002",
      direction: "debit",
    };
    mocks.findById.mockResolvedValue(walletPayment);
    mocks.updateById.mockResolvedValue(updatedPayment);
    mocks.getCustomerById.mockResolvedValue(customer);
    mocks.debitWallet.mockResolvedValue({
      ...customer,
      walletBalance: 4000,
    });
    mocks.recordTransaction.mockResolvedValue(walletTransaction);

    await paymentService.refund(
      paymentId,
      { reason: "Top-up reversed", refundAmount: 1000 },
      { role: ROLES.ACCOUNTANT, userId: "user-9" },
    );

    expect(mocks.debitWallet).toHaveBeenCalledWith(
      customerId,
      1000,
      transaction,
    );
    expect(mocks.notifyTopUpRefunded).toHaveBeenCalledWith(
      expect.objectContaining({
        payment: updatedPayment,
        customer,
        walletTransaction,
        amount: 1000,
        balanceBefore: 5000,
        balanceAfter: 4000,
        notes: "Top-up reversed",
      }),
    );
    expect(mocks.notifyRefundCompleted).not.toHaveBeenCalled();
  });
});

describe("paymentService multi-order invoices", () => {
  it("allocates a completed invoice payment across all linked orders", async () => {
    const multiInvoice = {
      _id: "invoice-1",
      orderIds: [orderId, "order-2"],
      customerId,
      status: "issued",
      paidAmount: 0,
      remainingAmount: 4000,
      pendingAmount: 0,
    };
    mocks.getInvoiceById.mockResolvedValue(multiInvoice);
    mocks.getOrderById.mockResolvedValue({
      _id: orderId,
      customerId,
      status: "delivered",
      shippingFee: 2500,
      shippingFeePaid: false,
    });
    mocks.updatePaymentProgress.mockResolvedValue({ _id: "invoice-1" });
    mocks.getCustomerById.mockResolvedValue({
      _id: customerId,
      walletBalance: 5000,
    });
    mocks.updateCustomerById.mockResolvedValue({
      _id: customerId,
      walletBalance: 3000,
    });
    mocks.applyInvoicePayment.mockResolvedValue(2);

    await paymentService.create(
      {
        invoiceId: "invoice-1",
        paymentAmount: 2000,
        paymentMethod: PAYMENT_METHODS.WALLET_BALANCE,
      },
      { role: ROLES.CUSTOMER, customerId },
    );

    expect(mocks.updatePaymentProgress).toHaveBeenCalledWith(
      "invoice-1",
      expect.objectContaining({ paidAmount: 2000, remainingAmount: 2000 }),
      transaction,
      expect.any(Object),
    );
    expect(mocks.applyInvoicePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        orderIds: [orderId, "order-2"],
        paidAmount: 2000,
        paymentMethod: PAYMENT_METHODS.WALLET_BALANCE,
        session: transaction,
      }),
    );
  });
});
