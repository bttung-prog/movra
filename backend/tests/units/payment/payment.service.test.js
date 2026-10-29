import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findAll: vi.fn(),
  countAll: vi.fn(),
  findById: vi.fn(),
  findByCode: vi.fn(),
  updateById: vi.fn(),
  findTopUpByReference: vi.fn(),
  getStats: vi.fn(),
  getByOrderId: vi.fn(),
  getInvoiceById: vi.fn(),
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
import { PAYMENT_MESSAGES } from "../../../src/constants/messages.js";
import ROLES from "../../../src/constants/roles.js";
import paymentService from "../../../src/modules/payment/payment.service.js";

const orderId = "order-1";
const customerId = "customer-1";
const paymentId = "payment-1";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.generateCode.mockReturnValue("PAY-0001");
  mocks.getByOrderId.mockResolvedValue(null);
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

describe("paymentService.create", () => {
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

  it("rejects a direct order payment above the remaining shipping balance", async () => {
    await expect(
      paymentService.create(
        {
          orderId,
          paymentAmount: 1001,
          paymentMethod: PAYMENT_METHODS.CASH,
        },
        { role: ROLES.CUSTOMER, customerId },
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: PAYMENT_MESSAGES.EXCEEDS_ORDER_SHIPPING_BALANCE(1000),
    });

    expect(mocks.create).not.toHaveBeenCalled();
  });
});

describe("paymentService.verifyPayment", () => {
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
