import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findAll: vi.fn(),
  countAll: vi.fn(),
  findIdsByOrderIds: vi.fn(),
  findActiveOrderLinksByCustomer: vi.fn(),
  findActiveByOrderIds: vi.fn(),
  findById: vi.fn(),
  findByIds: vi.fn(),
  findByCode: vi.fn(),
  findByOrderId: vi.fn(),
  updateById: vi.fn(),
  updateMany: vi.fn(),
  getStats: vi.fn(),
  getOrderById: vi.fn(),
  getOrderByIds: vi.fn(),
  getBillableOrdersForInvoice: vi.fn(),
  getCustomerById: vi.fn(),
  generateCode: vi.fn(),
  findOverdueCandidates: vi.fn(),
  markOverdueInvoices: vi.fn(),
  createNotification: vi.fn(),
  createManyNotifications: vi.fn(),
}));

vi.mock("../../../src/modules/invoice/invoice.repository.js", () => ({
  default: {
    create: mocks.create,
    findAll: mocks.findAll,
    countAll: mocks.countAll,
    findIdsByOrderIds: mocks.findIdsByOrderIds,
    findActiveOrderLinksByCustomer: mocks.findActiveOrderLinksByCustomer,
    findActiveByOrderIds: mocks.findActiveByOrderIds,
    findById: mocks.findById,
    findByIds: mocks.findByIds,
    findByCode: mocks.findByCode,
    findByOrderId: mocks.findByOrderId,
    updateById: mocks.updateById,
    updateMany: mocks.updateMany,
    getStats: mocks.getStats,
    findOverdueCandidates: mocks.findOverdueCandidates,
    markOverdueInvoices: mocks.markOverdueInvoices,
  },
}));

vi.mock("../../../src/modules/notification/notification.service.js", () => ({
  default: {
    create: mocks.createNotification,
    createMany: mocks.createManyNotifications,
  },
}));

vi.mock("../../../src/modules/order/order.service.js", () => ({
  default: {
    getById: mocks.getOrderById,
    getByIds: mocks.getOrderByIds,
    getBillableOrdersForInvoice: mocks.getBillableOrdersForInvoice,
  },
}));

vi.mock("../../../src/modules/customer/customer.service.js", () => ({
  default: { getById: mocks.getCustomerById },
}));

vi.mock("../../../src/utils/generateCode.js", () => ({
  generateCode: mocks.generateCode,
}));

import {
  INVOICE_MESSAGES,
  ORDER_MESSAGES,
} from "../../../src/constants/messages.js";
import { INVOICE_STATUSES } from "../../../src/constants/invoiceStatuses.js";
import { ROLES } from "../../../src/constants/roles.js";
import invoiceService from "../../../src/modules/invoice/invoice.service.js";

const invoiceId = "invoice-1";
const invoiceCode = "INV-0001";
const customerId = "customer-1";
const orderId = "order-1";

const linkedOrder = {
  _id: orderId,
  orderCode: "ORD-0001",
  customerId,
  status: "created",
  shippingFee: 2500,
  shippingFeePaid: false,
};

const secondOrderId = "order-2";
const secondOrder = {
  _id: secondOrderId,
  orderCode: "ORD-0002",
  customerId,
  status: "created",
  shippingFee: 1500,
  shippingFeePaid: false,
};

const draftInvoice = {
  _id: invoiceId,
  invoiceCode,
  customerId,
  orderIds: [orderId],
  status: INVOICE_STATUSES.DRAFT,
  subTotal: 3000,
  tax: 0,
  discount: 0,
  totalAmount: 3000,
  paidAmount: 0,
  remainingAmount: 3000,
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  notes: "",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.create.mockResolvedValue({ ...draftInvoice });
  mocks.findAll.mockResolvedValue([]);
  mocks.countAll.mockResolvedValue(0);
  mocks.findById.mockResolvedValue({ ...draftInvoice });
  mocks.findByIds.mockResolvedValue([]);
  mocks.findByCode.mockResolvedValue({ ...draftInvoice });
  mocks.findByOrderId.mockResolvedValue(null);
  mocks.findActiveOrderLinksByCustomer.mockResolvedValue([]);
  mocks.findActiveByOrderIds.mockResolvedValue(null);
  mocks.updateById.mockResolvedValue({ ...draftInvoice });
  mocks.updateMany.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
  mocks.createManyNotifications.mockResolvedValue([]);
  mocks.getOrderById.mockResolvedValue(linkedOrder);
  mocks.getOrderByIds.mockResolvedValue([linkedOrder]);
  mocks.getBillableOrdersForInvoice.mockResolvedValue([]);
  mocks.getCustomerById.mockResolvedValue({ _id: customerId });
  mocks.generateCode.mockReturnValue(invoiceCode);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("invoiceService.create", () => {
  it("creates an invoice from an order and derives customer, subtotal and item", async () => {
    const result = await invoiceService.create({ orderId });

    expect(result).toEqual({ ...draftInvoice });
    expect(mocks.getOrderById).toHaveBeenCalledWith(orderId, true, null);
    expect(mocks.getCustomerById).toHaveBeenCalledWith(customerId);
    expect(mocks.generateCode).toHaveBeenCalledWith("INV");
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceCode,
        customerId,
        orderIds: [orderId],
        subTotal: linkedOrder.shippingFee,
        tax: 250,
        vatRate: 10,
        totalAmount: 2750,
        remainingAmount: 2750,
        status: INVOICE_STATUSES.DRAFT,
        items: [
          {
            description: `Cước vận chuyển cho đơn hàng ${linkedOrder.orderCode}`,
            quantity: 1,
            unitPrice: linkedOrder.shippingFee,
            amount: linkedOrder.shippingFee,
          },
        ],
      }),
      null,
    );
  });

  it("creates a consolidated invoice from multiple orders with VAT and company snapshot", async () => {
    mocks.getOrderByIds.mockResolvedValue([linkedOrder, secondOrder]);
    mocks.getCustomerById.mockResolvedValue({
      _id: customerId,
      companyName: "Movra JSC",
      taxCode: "0312345678",
      companyAddress: "12 Nguyen Hue",
    });

    await invoiceService.create({ orderIds: [orderId, secondOrderId] });

    expect(mocks.getOrderByIds).toHaveBeenCalledWith([orderId, secondOrderId]);
    expect(mocks.findActiveByOrderIds).toHaveBeenCalledWith([
      orderId,
      secondOrderId,
    ]);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId,
        orderIds: [orderId, secondOrderId],
        companyName: "Movra JSC",
        taxCode: "0312345678",
        companyAddress: "12 Nguyen Hue",
        subTotal: 4000,
        tax: 400,
        vatRate: 10,
        totalAmount: 4400,
        remainingAmount: 4400,
        items: [
          expect.objectContaining({
            description: "Cước vận chuyển cho đơn hàng ORD-0001",
            unitPrice: 2500,
          }),
          expect.objectContaining({
            description: "Cước vận chuyển cho đơn hàng ORD-0002",
            unitPrice: 1500,
          }),
        ],
      }),
      null,
    );
  });

  it("collects billable orders in a billing period and excludes invoiced orders", async () => {
    const fromDate = new Date("2026-01-01T00:00:00.000Z");
    const toDate = new Date("2026-01-31T00:00:00.000Z");
    mocks.findActiveOrderLinksByCustomer.mockResolvedValue([
      { orderIds: ["order-9"] },
    ]);
    mocks.getBillableOrdersForInvoice.mockResolvedValue([
      linkedOrder,
      secondOrder,
    ]);

    await invoiceService.create({
      customerId,
      billingPeriod: { fromDate, toDate },
    });

    expect(mocks.findActiveOrderLinksByCustomer).toHaveBeenCalledWith(
      customerId,
    );
    expect(mocks.getBillableOrdersForInvoice).toHaveBeenCalledWith({
      customerId,
      fromDate,
      toDate,
      excludeOrderIds: ["order-9"],
    });
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        orderIds: [orderId, secondOrderId],
        billingPeriod: { fromDate, toDate },
        subTotal: 4000,
        tax: 400,
        totalAmount: 4400,
      }),
      null,
    );
  });

  it("rejects a billing period with no eligible orders", async () => {
    mocks.getBillableOrdersForInvoice.mockResolvedValue([]);

    await expect(
      invoiceService.create({
        customerId,
        billingPeriod: {
          fromDate: new Date("2026-01-01T00:00:00.000Z"),
          toDate: new Date("2026-01-31T00:00:00.000Z"),
        },
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: INVOICE_MESSAGES.NO_ELIGIBLE_ORDERS,
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects orders that already belong to another active invoice", async () => {
    mocks.getOrderByIds.mockResolvedValue([linkedOrder, secondOrder]);
    mocks.findActiveByOrderIds.mockResolvedValue({
      invoiceCode: "INV-EXISTING",
    });

    await expect(
      invoiceService.create({ orderIds: [orderId, secondOrderId] }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: INVOICE_MESSAGES.ALREADY_EXISTS,
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("applies an explicit VAT rate to the invoice", async () => {
    mocks.getCustomerById.mockResolvedValue({ _id: customerId });

    await invoiceService.create({ orderId, vatRate: 8 });

    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        subTotal: 2500,
        tax: 200,
        vatRate: 8,
        totalAmount: 2700,
        remainingAmount: 2700,
      }),
      null,
    );
  });

  it("creates a standalone invoice with calculated item totals and due date", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const items = [
      { description: "Service", quantity: 2, unitPrice: 1500, amount: 3000 },
    ];

    await invoiceService.create({
      customerId,
      items,
      tax: 500,
      discount: 200,
      paymentTerms: "net_15",
    });

    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId,
        orderIds: [],
        items,
        subTotal: 3000,
        tax: 500,
        discount: 200,
        totalAmount: 3300,
        remainingAmount: 3300,
        paymentTerms: "net_15",
        dueDate: new Date("2026-01-16T00:00:00.000Z"),
      }),
      null,
    );
  });

  it.each([
    [
      "mismatched item amount",
      {
        customerId,
        items: [
          { description: "Service", quantity: 2, unitPrice: 10, amount: 19 },
        ],
      },
      INVOICE_MESSAGES.ITEM_AMOUNT_MISMATCH,
    ],
    [
      "discount greater than subtotal and tax",
      { customerId, subTotal: 100, discount: 111 },
      INVOICE_MESSAGES.DISCOUNT_EXCEEDS_TOTAL,
    ],
    ["missing customer", { subTotal: 100 }, INVOICE_MESSAGES.CUSTOMER_REQUIRED],
  ])("rejects %s", async (_case, payload, message) => {
    await expect(invoiceService.create(payload)).rejects.toMatchObject({
      statusCode: 400,
      message,
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects a cancelled order or an order whose shipping fee is paid", async () => {
    mocks.getOrderById.mockResolvedValueOnce({
      ...linkedOrder,
      status: "cancelled",
    });
    await expect(invoiceService.create({ orderId })).rejects.toMatchObject({
      statusCode: 400,
      message: ORDER_MESSAGES.CANCELLED_ORDER_CANNOT_BE_BILLED,
    });

    mocks.getOrderById.mockResolvedValueOnce({
      ...linkedOrder,
      shippingFeePaid: true,
    });
    await expect(invoiceService.create({ orderId })).rejects.toMatchObject({
      statusCode: 400,
      message: ORDER_MESSAGES.SHIPPING_FEE_ALREADY_PAID,
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("maps duplicate-order database conflicts to an invoice conflict", async () => {
    mocks.create.mockRejectedValue({
      code: 11000,
      keyPattern: { orderIds: 1 },
    });

    await expect(invoiceService.create({ orderId })).rejects.toMatchObject({
      statusCode: 409,
      message: INVOICE_MESSAGES.ALREADY_EXISTS,
    });
  });
});

describe("invoiceService.getActiveOrderIdsByCustomer", () => {
  it("flattens and deduplicates orderIds across active invoices", async () => {
    mocks.findActiveOrderLinksByCustomer.mockResolvedValue([
      { orderIds: ["order-1", "order-2"] },
      { orderIds: ["order-2", "order-3"] },
    ]);

    const result = await invoiceService.getActiveOrderIdsByCustomer(customerId);

    expect(mocks.findActiveOrderLinksByCustomer).toHaveBeenCalledWith(
      customerId,
    );
    expect(result).toEqual(["order-1", "order-2", "order-3"]);
  });
});

describe("invoiceService.getAll", () => {
  it("paginates invoices using the supplied filter", async () => {
    mocks.findAll.mockResolvedValue([draftInvoice]);
    mocks.countAll.mockResolvedValue(21);

    const result = await invoiceService.getAll({
      filter: { status: INVOICE_STATUSES.DRAFT },
      page: 2,
      limit: 10,
    });

    expect(mocks.findAll).toHaveBeenCalledWith({
      filter: { status: INVOICE_STATUSES.DRAFT },
      skip: 10,
      limit: 10,
      sort: { createdAt: -1 },
    });
    expect(result.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 21,
      totalPages: 3,
    });
  });
});

describe("invoiceService invoice access", () => {
  it("returns an existing invoice by ID or code", async () => {
    await expect(invoiceService.getById(invoiceId)).resolves.toEqual(
      draftInvoice,
    );
    await expect(invoiceService.getByCode(invoiceCode)).resolves.toEqual(
      draftInvoice,
    );
  });

  it("rejects unknown invoices", async () => {
    mocks.findById.mockResolvedValue(null);
    mocks.findByCode.mockResolvedValue(null);

    await expect(invoiceService.getById(invoiceId)).rejects.toMatchObject({
      statusCode: 404,
      message: INVOICE_MESSAGES.NOT_FOUND,
    });
    await expect(invoiceService.getByCode(invoiceCode)).rejects.toMatchObject({
      statusCode: 404,
      message: INVOICE_MESSAGES.NOT_FOUND,
    });
  });

  it("restricts customer access to invoices belonging to that customer", async () => {
    await expect(
      invoiceService.getById(invoiceId, {
        role: ROLES.CUSTOMER,
        customerId: "customer-2",
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: INVOICE_MESSAGES.ACCESS_DENIED,
    });
  });
});

describe("invoiceService issue, update and cancel", () => {
  it("issues a draft invoice with a conditional state update", async () => {
    const issuedInvoice = { ...draftInvoice, status: INVOICE_STATUSES.ISSUED };
    mocks.updateById.mockResolvedValue(issuedInvoice);

    await expect(
      invoiceService.issueInvoice(invoiceId, "user-1"),
    ).resolves.toEqual(issuedInvoice);
    expect(mocks.updateById).toHaveBeenCalledWith(
      invoiceId,
      expect.objectContaining({
        status: INVOICE_STATUSES.ISSUED,
        issuedBy: "user-1",
        issueDate: expect.any(Date),
      }),
      null,
      { status: INVOICE_STATUSES.DRAFT, updatedAt: draftInvoice.updatedAt },
    );
  });

  it("issues a draft invoice inside the caller's transaction", async () => {
    const session = { transactionId: "transaction-1" };
    mocks.updateById.mockResolvedValue({
      ...draftInvoice,
      status: INVOICE_STATUSES.ISSUED,
    });

    await invoiceService.issueInvoice(invoiceId, null, session);

    expect(mocks.findById).toHaveBeenCalledWith(invoiceId, session);
    expect(mocks.updateById).toHaveBeenCalledWith(
      invoiceId,
      expect.objectContaining({ status: INVOICE_STATUSES.ISSUED }),
      session,
      expect.objectContaining({ status: INVOICE_STATUSES.DRAFT }),
    );
  });

  it("reserves and releases pending payment amounts conditionally", async () => {
    const session = { transactionId: "transaction-1" };
    await invoiceService.reservePendingPayment(invoiceId, 1000, session);

    expect(mocks.updateById).toHaveBeenCalledWith(
      invoiceId,
      { $inc: { pendingAmount: 1000 } },
      session,
      expect.objectContaining({
        status: {
          $in: [
            INVOICE_STATUSES.ISSUED,
            INVOICE_STATUSES.PARTIALLY_PAID,
            INVOICE_STATUSES.OVERDUE,
          ],
        },
        $expr: expect.any(Object),
      }),
    );

    await invoiceService.releasePendingPayment(invoiceId, 1000, session);
    expect(mocks.updateById).toHaveBeenLastCalledWith(
      invoiceId,
      { $inc: { pendingAmount: -1000 } },
      session,
      { pendingAmount: { $gte: 1000 } },
    );
  });

  it("rejects issuing a non-draft invoice and reports concurrent changes", async () => {
    mocks.findById.mockResolvedValue({
      ...draftInvoice,
      status: INVOICE_STATUSES.ISSUED,
    });
    await expect(invoiceService.issueInvoice(invoiceId)).rejects.toMatchObject({
      statusCode: 400,
      message: INVOICE_MESSAGES.CANNOT_UPDATE_STATUS(INVOICE_STATUSES.ISSUED),
    });

    mocks.findById.mockResolvedValue({ ...draftInvoice });
    mocks.updateById.mockResolvedValue(null);
    await expect(invoiceService.issueInvoice(invoiceId)).rejects.toMatchObject({
      statusCode: 409,
      message: INVOICE_MESSAGES.STATE_CHANGED,
    });
  });

  it("recalculates invoice totals on update", async () => {
    const updatedInvoice = {
      ...draftInvoice,
      subTotal: 3000,
      tax: 100,
      totalAmount: 3100,
    };
    mocks.updateById.mockResolvedValue(updatedInvoice);

    await expect(
      invoiceService.updateById(invoiceId, {
        items: [
          {
            description: "Service",
            quantity: 2,
            unitPrice: 1500,
            amount: 3000,
          },
        ],
        tax: 100,
      }),
    ).resolves.toEqual(updatedInvoice);

    expect(mocks.updateById).toHaveBeenCalledWith(
      invoiceId,
      expect.objectContaining({
        subTotal: 3000,
        tax: 100,
        discount: 0,
        totalAmount: 3100,
        remainingAmount: 3100,
      }),
      null,
      { status: INVOICE_STATUSES.DRAFT, updatedAt: draftInvoice.updatedAt },
    );
  });

  it("rejects editing a non-draft invoice and mismatched subtotal", async () => {
    mocks.findById.mockResolvedValue({
      ...draftInvoice,
      status: INVOICE_STATUSES.ISSUED,
    });
    await expect(
      invoiceService.updateById(invoiceId, { tax: 100 }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: INVOICE_MESSAGES.CANNOT_UPDATE_STATUS(INVOICE_STATUSES.ISSUED),
    });

    mocks.findById.mockResolvedValue({ ...draftInvoice });
    await expect(
      invoiceService.updateById(invoiceId, {
        subTotal: 100,
        items: [
          { description: "Service", quantity: 1, unitPrice: 200, amount: 200 },
        ],
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: INVOICE_MESSAGES.SUBTOTAL_ITEMS_MISMATCH,
    });
  });

  it("cancels unpaid invoices while preserving the reason in notes", async () => {
    const cancelledInvoice = {
      ...draftInvoice,
      status: INVOICE_STATUSES.CANCELLED,
      notes: "Lý do hủy: Duplicate",
    };
    mocks.updateById.mockResolvedValue(cancelledInvoice);

    await expect(
      invoiceService.cancelInvoice(invoiceId, "Duplicate"),
    ).resolves.toEqual(cancelledInvoice);
    expect(mocks.updateById).toHaveBeenCalledWith(
      invoiceId,
      {
        status: INVOICE_STATUSES.CANCELLED,
        notes: "Lý do hủy: Duplicate",
      },
      null,
      expect.objectContaining({
        paidAmount: { $in: [0, null] },
        updatedAt: draftInvoice.updatedAt,
      }),
    );
  });

  it("prevents cancelling paid or already-cancelled invoices", async () => {
    mocks.findById.mockResolvedValue({
      ...draftInvoice,
      status: INVOICE_STATUSES.PARTIALLY_PAID,
      paidAmount: 500,
    });

    await expect(
      invoiceService.cancelInvoice(invoiceId, "Duplicate"),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: INVOICE_MESSAGES.CANNOT_CANCEL_PAID(500),
    });

    mocks.findById.mockResolvedValue({
      ...draftInvoice,
      status: INVOICE_STATUSES.CANCELLED,
    });
    await expect(
      invoiceService.cancelInvoice(invoiceId, "Duplicate"),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: INVOICE_MESSAGES.CANNOT_CANCEL_STATUS(
        INVOICE_STATUSES.CANCELLED,
      ),
    });
  });

  it("prevents cancelling invoices with pending payments", async () => {
    mocks.findById.mockResolvedValue({
      ...draftInvoice,
      status: INVOICE_STATUSES.ISSUED,
      pendingAmount: 1000,
    });

    await expect(
      invoiceService.cancelInvoice(invoiceId, "Duplicate"),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: INVOICE_MESSAGES.CANNOT_CANCEL_PENDING,
    });
  });

  describe("processOverdueInvoices", () => {
    const buildCandidate = (overrides = {}) => ({
      _id: "inv-overdue-1",
      invoiceCode: "INV-OD-001",
      status: INVOICE_STATUSES.ISSUED,
      dueDate: new Date("2026-01-01"),
      remainingAmount: 50000,
      orderIds: ["order-1"],
      customerId: {
        _id: "cust-1",
        userId: { _id: "user-cust-1" },
      },
      ...overrides,
    });

    it("returns early when no candidates are found", async () => {
      mocks.findOverdueCandidates.mockResolvedValue([]);

      const result = await invoiceService.processOverdueInvoices();

      expect(result).toEqual({
        scannedCount: 0,
        updatedCount: 0,
        invoices: [],
      });
      expect(mocks.updateMany).not.toHaveBeenCalled();
      expect(mocks.createManyNotifications).not.toHaveBeenCalled();
    });

    it("returns early when no candidate could be transitioned", async () => {
      mocks.findOverdueCandidates.mockResolvedValue([buildCandidate()]);
      mocks.updateMany.mockResolvedValue({ matchedCount: 1, modifiedCount: 0 });

      const result = await invoiceService.processOverdueInvoices();

      expect(result).toEqual({
        scannedCount: 1,
        updatedCount: 0,
        invoices: [],
      });
      expect(mocks.findByIds).not.toHaveBeenCalled();
      expect(mocks.createManyNotifications).not.toHaveBeenCalled();
    });

    it("updates overdue invoices and notifies customers in one batch", async () => {
      const candidate = buildCandidate();

      mocks.findOverdueCandidates.mockResolvedValue([candidate]);
      mocks.findByIds.mockResolvedValue([
        { ...candidate, status: INVOICE_STATUSES.OVERDUE },
      ]);

      const result = await invoiceService.processOverdueInvoices();

      expect(result.scannedCount).toBe(1);
      expect(result.updatedCount).toBe(1);
      expect(result.invoices[0].status).toBe(INVOICE_STATUSES.OVERDUE);

      expect(mocks.updateMany).toHaveBeenCalledWith(
        {
          _id: { $in: [candidate._id] },
          status: {
            $in: [INVOICE_STATUSES.ISSUED, INVOICE_STATUSES.PARTIALLY_PAID],
          },
        },
        { $set: { status: INVOICE_STATUSES.OVERDUE } },
      );
      expect(mocks.findByIds).toHaveBeenCalledWith([candidate._id]);
      expect(mocks.createManyNotifications).toHaveBeenCalledWith([
        expect.objectContaining({
          userId: "user-cust-1",
          type: "PAYMENT",
          title: "Hóa đơn quá hạn thanh toán",
          data: expect.objectContaining({
            invoiceId: candidate._id,
            invoiceCode: candidate.invoiceCode,
            orderIds: candidate.orderIds,
          }),
        }),
      ]);
    });

    it("notifies every updated invoice in a single batch", async () => {
      const first = buildCandidate();
      const second = buildCandidate({
        _id: "inv-overdue-2",
        invoiceCode: "INV-OD-002",
        customerId: { _id: "cust-2", userId: "user-cust-2" },
      });

      mocks.findOverdueCandidates.mockResolvedValue([first, second]);
      mocks.findByIds.mockResolvedValue([
        { ...first, status: INVOICE_STATUSES.OVERDUE },
        { ...second, status: INVOICE_STATUSES.OVERDUE },
      ]);

      const result = await invoiceService.processOverdueInvoices();

      expect(result.updatedCount).toBe(2);
      expect(mocks.createManyNotifications).toHaveBeenCalledTimes(1);
      const [notifications] = mocks.createManyNotifications.mock.calls[0];
      expect(notifications).toHaveLength(2);
      expect(notifications.map((item) => item.userId)).toEqual([
        "user-cust-1",
        "user-cust-2",
      ]);
    });

    it("handles notification error gracefully without failing the batch", async () => {
      const candidate = buildCandidate({
        _id: "inv-overdue-3",
        status: INVOICE_STATUSES.PARTIALLY_PAID,
      });

      mocks.findOverdueCandidates.mockResolvedValue([candidate]);
      mocks.findByIds.mockResolvedValue([
        { ...candidate, status: INVOICE_STATUSES.OVERDUE },
      ]);
      mocks.createManyNotifications.mockRejectedValue(
        new Error("Notification failed"),
      );

      const result = await invoiceService.processOverdueInvoices();

      expect(result.scannedCount).toBe(1);
      expect(result.updatedCount).toBe(1);
    });

    it("handles candidates without a customer user gracefully", async () => {
      const candidate = buildCandidate({
        _id: "inv-overdue-4",
        customerId: { _id: "cust-4" },
      });

      mocks.findOverdueCandidates.mockResolvedValue([candidate]);
      mocks.findByIds.mockResolvedValue([
        { ...candidate, status: INVOICE_STATUSES.OVERDUE },
      ]);

      const result = await invoiceService.processOverdueInvoices();

      expect(result.updatedCount).toBe(1);
      expect(mocks.createManyNotifications).not.toHaveBeenCalled();
    });
  });
});
