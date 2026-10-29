import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findAll: vi.fn(),
  countAll: vi.fn(),
  findIdsByOrderIds: vi.fn(),
  findById: vi.fn(),
  findByCode: vi.fn(),
  findByOrderId: vi.fn(),
  updateById: vi.fn(),
  getStats: vi.fn(),
  getOrderById: vi.fn(),
  getOrderIdsByWarehouseId: vi.fn(),
  getCustomerById: vi.fn(),
  generateCode: vi.fn(),
}));

vi.mock("../../../src/modules/invoice/invoice.repository.js", () => ({
  default: {
    create: mocks.create,
    findAll: mocks.findAll,
    countAll: mocks.countAll,
    findIdsByOrderIds: mocks.findIdsByOrderIds,
    findById: mocks.findById,
    findByCode: mocks.findByCode,
    findByOrderId: mocks.findByOrderId,
    updateById: mocks.updateById,
    getStats: mocks.getStats,
  },
}));

vi.mock("../../../src/modules/order/order.service.js", () => ({
  default: {
    getById: mocks.getOrderById,
    getIdsByWarehouseId: mocks.getOrderIdsByWarehouseId,
  },
}));

vi.mock("../../../src/modules/customer/customer.service.js", () => ({
  default: { getById: mocks.getCustomerById },
}));

vi.mock("../../../src/utils/generateCode.js", () => ({
  default: mocks.generateCode,
}));

import {
  INVOICE_MESSAGES,
  ORDER_MESSAGES,
} from "../../../src/constants/messages.js";
import INVOICE_STATUSES from "../../../src/constants/invoiceStatuses.js";
import ROLES from "../../../src/constants/roles.js";
import invoiceService from "../../../src/modules/invoice/invoice.service.js";

const invoiceId = "invoice-1";
const invoiceCode = "INV-0001";
const customerId = "customer-1";
const orderId = "order-1";
const warehouseId = "warehouse-1";

const linkedOrder = {
  _id: orderId,
  orderCode: "ORD-0001",
  customerId,
  status: "created",
  shippingFee: 2500,
  shippingFeePaid: false,
};

const draftInvoice = {
  _id: invoiceId,
  invoiceCode,
  customerId,
  orderId,
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
  mocks.findByCode.mockResolvedValue({ ...draftInvoice });
  mocks.findByOrderId.mockResolvedValue(null);
  mocks.updateById.mockResolvedValue({ ...draftInvoice });
  mocks.getOrderById.mockResolvedValue(linkedOrder);
  mocks.getOrderIdsByWarehouseId.mockResolvedValue([orderId]);
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
        orderId,
        subTotal: linkedOrder.shippingFee,
        totalAmount: linkedOrder.shippingFee,
        remainingAmount: linkedOrder.shippingFee,
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
        orderId: null,
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
      { customerId, subTotal: 100, discount: 101 },
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

  it("requires dispatcher-created invoices to be linked to an order", async () => {
    await expect(
      invoiceService.create({ customerId }, null, { role: ROLES.DISPATCHER }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: INVOICE_MESSAGES.DISPATCHER_ORDER_REQUIRED,
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("maps duplicate-order database conflicts to an invoice conflict", async () => {
    mocks.create.mockRejectedValue({
      code: 11000,
      keyPattern: { orderId: 1 },
    });

    await expect(invoiceService.create({ orderId })).rejects.toMatchObject({
      statusCode: 409,
      message: INVOICE_MESSAGES.ALREADY_EXISTS,
    });
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

  it("limits dispatcher queries to orders in their warehouse", async () => {
    await invoiceService.getAll({
      filter: { status: INVOICE_STATUSES.ISSUED },
      actor: { role: ROLES.DISPATCHER, warehouseId },
    });

    expect(mocks.getOrderIdsByWarehouseId).toHaveBeenCalledWith(warehouseId);
    expect(mocks.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: {
          $and: [
            { status: INVOICE_STATUSES.ISSUED },
            { orderId: { $in: [orderId] } },
          ],
        },
      }),
    );
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

  it("requires dispatcher invoices to link to an accessible order", async () => {
    mocks.findById.mockResolvedValue({ ...draftInvoice, orderId: null });
    const actor = { role: ROLES.DISPATCHER, warehouseId };

    await expect(
      invoiceService.getById(invoiceId, actor),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: INVOICE_MESSAGES.DISPATCHER_ORDER_LINK_REQUIRED,
    });
    expect(mocks.getOrderById).not.toHaveBeenCalled();
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
});
