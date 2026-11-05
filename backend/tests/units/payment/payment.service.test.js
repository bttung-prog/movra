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
  getStats: vi.fn(),
  getByOrderId: vi.fn(),
  getInvoiceById: vi.fn(),
  issueInvoice: vi.fn(),
  reservePendingPayment: vi.fn(),
  releasePendingPayment: vi.fn(),
  updatePaymentProgress: vi.fn(),
  getInvoiceIdsByWarehouseId: vi.fn(),
  getOrderById: vi.fn(),
  getOrderIdsByWarehouseId: vi.fn(),
  updateOrderById: vi.fn(),
  getTripById: vi.fn(),
  getTripIdsByWarehouseId: vi.fn(),
  getCustomerById: vi.fn(),
  updateCustomerById: vi.fn(),
  debitWallet: vi.fn(),
  recordTransaction: vi.fn(),
  generateCode: vi.fn(),
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
    getStats: mocks.getStats,
  },
}));

vi.mock("../../../src/modules/invoice/invoice.service.js", () => ({
  default: {
    getByOrderId: mocks.getByOrderId,
    getById: mocks.getInvoiceById,
    issueInvoice: mocks.issueInvoice,
    reservePendingPayment: mocks.reservePendingPayment,
    releasePendingPayment: mocks.releasePendingPayment,
    updatePaymentProgress: mocks.updatePaymentProgress,
    getIdsByWarehouseId: mocks.getInvoiceIdsByWarehouseId,
  },
}));

vi.mock("../../../src/modules/order/order.service.js", () => ({
  default: {
    getById: mocks.getOrderById,
    getIdsByWarehouseId: mocks.getOrderIdsByWarehouseId,
    updateById: mocks.updateOrderById,
  },
}));

vi.mock("../../../src/modules/trip/trip.service.js", () => ({
  default: {
    getById: mocks.getTripById,
    getIdsByWarehouseId: mocks.getTripIdsByWarehouseId,
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
  default: mocks.generateCode,
}));

import PAYMENT_METHODS, {
  PAYER_TYPES,
} from "../../../src/constants/paymentMethods.js";
import PAYMENT_STATUSES from "../../../src/constants/paymentStatuses.js";
import {
  INVOICE_MESSAGES,
  PAYMENT_MESSAGES,
} from "../../../src/constants/messages.js";
import ROLES from "../../../src/constants/roles.js";
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
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("paymentService.create", () => {
  it("completes wallet payments through the linked invoice and updates the order", async () => {
    const invoice = {
      _id: "invoice-1",
      orderId,
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

  it("awards loyalty points and totalSpent when paying for an already delivered order", async () => {
    const invoice = {
      _id: "invoice-1",
      orderId,
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
      loyaltyPointsAwarded: false,
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
        $inc: {
          walletBalance: -10000,
          totalSpent: 10000,
          loyaltyPoints: 1,
        },
      }),
      transaction,
      { walletBalance: { $gte: 10000 } },
    );
    expect(mocks.updateOrderById).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId,
        updateData: expect.objectContaining({
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
      orderId,
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
  });

  it("issues a draft invoice and reserves its balance for a pending bank payment", async () => {
    vi.stubEnv("VIETQR_BANK_ID", "970422");
    vi.stubEnv("VIETQR_ACCOUNT_NUMBER", "1234567890");
    mocks.getInvoiceById.mockResolvedValue({
      _id: "invoice-1",
      customerId,
      orderId: null,
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
      orderId: null,
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
      orderId: "another-order",
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

describe("paymentService.verifyPayment", () => {
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
      paymentService.verifyPayment(
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
      orderId: "another-order",
      status: "issued",
      paidAmount: 0,
      remainingAmount: 1000,
    });
    mocks.updateById.mockResolvedValue({
      _id: paymentId,
      paymentStatus: PAYMENT_STATUSES.COMPLETED,
    });

    await expect(
      paymentService.verifyPayment(
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

    const result = await paymentService.verifyPayment(
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

    await paymentService.verifyPayment(
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

    await paymentService.verifyPayment(
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
      paymentService.verifyPayment(
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
