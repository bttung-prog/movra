import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  startSession: vi.fn(),
  create: vi.fn(),
  createInventory: vi.fn(),
  addOrderTrackingLog: vi.fn(),
  findAll: vi.fn(),
  countAll: vi.fn(),
  findById: vi.fn(),
  findByReceiptCode: vi.fn(),
  findByOrderId: vi.fn(),
  updateById: vi.fn(),
  cancelAtomic: vi.fn(),
  getOrderById: vi.fn(),
  getCategoryById: vi.fn(),
  getWarehouseById: vi.fn(),
  getUserById: vi.fn(),
  getInStockByOrderId: vi.fn(),
  generateCode: vi.fn(),
  syncTripTotalOrder: vi.fn(),
}));

vi.mock("mongoose", async (importOriginal) => {
  const actual = await importOriginal();

  return {
    ...actual,
    default: { ...actual.default, startSession: mocks.startSession },
  };
});

vi.mock("../../../src/modules/receipt/receipt.repository.js", () => ({
  default: {
    create: mocks.create,
    findAll: mocks.findAll,
    countAll: mocks.countAll,
    findById: mocks.findById,
    findByReceiptCode: mocks.findByReceiptCode,
    findByOrderId: mocks.findByOrderId,
    updateById: mocks.updateById,
    cancelAtomic: mocks.cancelAtomic,
  },
}));

vi.mock("../../../src/modules/order/order.service.js", () => ({
  default: {
    getById: mocks.getOrderById,
    addTrackingLog: mocks.addOrderTrackingLog,
  },
}));

vi.mock("../../../src/modules/goodsCategory/goodsCategory.service.js", () => ({
  default: { getById: mocks.getCategoryById },
}));

vi.mock("../../../src/modules/warehouse/warehouse.service.js", () => ({
  default: { getById: mocks.getWarehouseById },
}));

vi.mock("../../../src/modules/user/user.service.js", () => ({
  default: { getById: mocks.getUserById },
}));

vi.mock("../../../src/modules/inventory/inventory.service.js", () => ({
  default: {
    create: mocks.createInventory,
    getInStockByOrderId: mocks.getInStockByOrderId,
  },
}));

vi.mock("../../../src/modules/trip/trip.service.js", () => ({
  default: { syncTotalOrder: mocks.syncTripTotalOrder },
}));

vi.mock("../../../src/utils/generateCode.js", () => ({
  default: mocks.generateCode,
}));

import {
  RECEIPT_MESSAGES,
  WAREHOUSE_MESSAGES,
} from "../../../src/constants/messages.js";
import ROLES from "../../../src/constants/roles.js";
import receiptService from "../../../src/modules/receipt/receipt.service.js";
import RECEIPT_STATUSES from "../../../src/constants/receiptStatuses.js";

const receiptId = "receipt-1";
const orderId = "order-1";
const warehouseId = "warehouse-1";
const categoryId = "category-1";
const receivedBy = "user-1";
const receipt = {
  _id: receiptId,
  receiptCode: "RC-0001",
  orderId,
  warehouseId,
  goodsCategoryId: categoryId,
  receivedBy,
  quantity: 2,
  condition: "good",
  status: RECEIPT_STATUSES.COMPLETED,
  note: "",
};

const transaction = {
  startTransaction: vi.fn(),
  commitTransaction: vi.fn().mockResolvedValue(undefined),
  abortTransaction: vi.fn().mockResolvedValue(undefined),
  inTransaction: vi.fn().mockReturnValue(true),
  endSession: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.startSession.mockResolvedValue(transaction);
  mocks.findById.mockResolvedValue(receipt);
  mocks.findByReceiptCode.mockResolvedValue(receipt);
  mocks.findByOrderId.mockResolvedValue(receipt);
  mocks.findAll.mockResolvedValue([receipt]);
  mocks.countAll.mockResolvedValue(21);
  mocks.getOrderById.mockResolvedValue({
    _id: orderId,
    status: "picked_up",
    quantity: 2,
    goodCategory: { _id: categoryId },
    warehouseId: null,
  });
  mocks.getCategoryById.mockResolvedValue({ _id: categoryId });
  mocks.getWarehouseById.mockResolvedValue({
    _id: warehouseId,
    warehouseName: "Central",
  });
  mocks.getUserById.mockResolvedValue({ _id: receivedBy });
  mocks.getInStockByOrderId.mockResolvedValue(null);
  mocks.create.mockResolvedValue(receipt);
  mocks.createInventory.mockResolvedValue({ _id: "inventory-1" });
  mocks.addOrderTrackingLog.mockResolvedValue({ _id: "tracking-1" });
  mocks.syncTripTotalOrder.mockResolvedValue(undefined);
  mocks.generateCode.mockReturnValue("RC-0001");
});

describe("receiptService.create", () => {
  it("rejects non-positive quantities before loading related records", async () => {
    await expect(
      receiptService.create({
        orderId,
        warehouseId,
        receivedBy,
        quantity: 0,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: RECEIPT_MESSAGES.QTY_GREATER_THAN_ZERO,
    });
    expect(mocks.getOrderById).not.toHaveBeenCalled();
  });

  it("enforces warehouse staff assignment", async () => {
    await expect(
      receiptService.create(
        { orderId, warehouseId, receivedBy, quantity: 2 },
        { role: ROLES.WAREHOUSE_STAFF },
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: RECEIPT_MESSAGES.STAFF_NOT_ASSIGNED,
    });

    await expect(
      receiptService.create(
        { orderId, warehouseId, receivedBy, quantity: 2 },
        {
          role: ROLES.WAREHOUSE_STAFF,
          warehouseId: "another-warehouse",
        },
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: RECEIPT_MESSAGES.NOT_AUTHORIZED_WAREHOUSE,
    });
    expect(mocks.getOrderById).not.toHaveBeenCalled();
  });

  it("rejects ineligible orders and quantity or category mismatches", async () => {
    mocks.getOrderById.mockResolvedValueOnce({
      status: "delivered",
      quantity: 2,
    });
    await expect(
      receiptService.create({ orderId, warehouseId, receivedBy, quantity: 2 }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: RECEIPT_MESSAGES.ORDER_STATUS_INVALID("delivered"),
    });

    mocks.getOrderById.mockResolvedValueOnce({
      status: "picked_up",
      quantity: 3,
      goodCategory: { _id: categoryId },
    });
    await expect(
      receiptService.create({ orderId, warehouseId, receivedBy, quantity: 2 }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: RECEIPT_MESSAGES.QTY_MISMATCH(2, 3),
    });

    mocks.getOrderById.mockResolvedValueOnce({
      status: "picked_up",
      quantity: 2,
      goodCategory: { _id: "other-category" },
    });
    await expect(
      receiptService.create({
        orderId,
        warehouseId,
        goodsCategoryId: categoryId,
        receivedBy,
        quantity: 2,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: RECEIPT_MESSAGES.CATEGORY_MISMATCH,
    });
  });

  it("requires pickup confirmation before receiving an order", async () => {
    mocks.getOrderById.mockResolvedValueOnce({
      status: "pickup_scheduled",
      quantity: 2,
    });

    await expect(
      receiptService.create({ orderId, warehouseId, receivedBy, quantity: 2 }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: RECEIPT_MESSAGES.ORDER_STATUS_INVALID("pickup_scheduled"),
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("stores confirmed pickup orders and detaches them from the pickup trip", async () => {
    mocks.findByReceiptCode.mockResolvedValue(null);
    mocks.getOrderById.mockResolvedValue({
      _id: orderId,
      status: "picked_up",
      quantity: 2,
      goodCategory: { _id: categoryId },
      warehouseId: null,
      tripId: { _id: "pickup-trip-1" },
    });

    await receiptService.create(
      {
        orderId,
        warehouseId,
        receivedBy,
        quantity: 2,
      },
      null,
      transaction,
    );

    expect(mocks.addOrderTrackingLog).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId,
        tripId: "pickup-trip-1",
        status: "stored",
        clearTrip: true,
        session: transaction,
      }),
    );
    expect(mocks.syncTripTotalOrder).toHaveBeenCalledWith(
      "pickup-trip-1",
      transaction,
    );
    expect(mocks.create).toHaveBeenCalledWith(expect.any(Object), transaction);
  });

  it("rejects orders already in stock or missing a receiver", async () => {
    await expect(
      receiptService.create({ orderId, warehouseId, quantity: 2 }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: RECEIPT_MESSAGES.RECEIVED_BY_REQUIRED,
    });

    mocks.getInStockByOrderId.mockResolvedValueOnce({
      warehouseId: { _id: warehouseId },
    });
    await expect(
      receiptService.create({ orderId, warehouseId, receivedBy, quantity: 2 }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: RECEIPT_MESSAGES.ORDER_ALREADY_IN_STOCK,
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

describe("receiptService.getAll", () => {
  it("builds filters, date bounds, sorting, and pagination", async () => {
    const result = await receiptService.getAll({
      page: 2,
      limit: 5,
      receiptCode: "  RC+1 ",
      warehouseId,
      orderId,
      condition: "good",
      fromDate: "2026-01-01",
      toDate: "2026-01-31",
      sortBy: "quantity",
      sortOrder: "asc",
    });

    const filter = mocks.findAll.mock.calls[0][0].filter;
    expect(filter).toMatchObject({
      warehouseId,
      orderId,
      condition: "good",
      receiptCode: { $regex: "RC\\+1", $options: "i" },
      receivedAt: {
        $gte: new Date("2026-01-01T00:00:00.000Z"),
        $lte: new Date("2026-01-31T23:59:59.999Z"),
      },
    });
    expect(mocks.findAll).toHaveBeenCalledWith({
      filter,
      skip: 5,
      limit: 5,
      sort: { quantity: 1 },
    });
    expect(mocks.countAll).toHaveBeenCalledWith({ filter });
    expect(result.pagination).toEqual({
      page: 2,
      limit: 5,
      total: 21,
      totalPages: 5,
    });
  });

  it("scopes warehouse staff results to their assigned warehouse", async () => {
    await receiptService.getAll(
      {},
      {
        role: ROLES.WAREHOUSE_STAFF,
        warehouseId,
      },
    );

    expect(mocks.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: { warehouseId },
      }),
    );
  });

  it("requires warehouse assignment for scoped users", async () => {
    await expect(
      receiptService.getAll({}, { role: ROLES.WAREHOUSE_STAFF }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: WAREHOUSE_MESSAGES.STAFF_NOT_ASSIGNED,
    });
    expect(mocks.findAll).not.toHaveBeenCalled();
  });
});

describe("receiptService lookup and update access", () => {
  it("returns receipts by ID, code, and order ID", async () => {
    await expect(receiptService.getById(receiptId)).resolves.toBe(receipt);
    await expect(receiptService.getByCode("RC-0001")).resolves.toBe(receipt);
    await expect(receiptService.getByOrderId(orderId)).resolves.toBe(receipt);
  });

  it("rejects missing receipts", async () => {
    mocks.findById.mockResolvedValueOnce(null);
    await expect(receiptService.getById(receiptId)).rejects.toMatchObject({
      statusCode: 404,
      message: RECEIPT_MESSAGES.NOT_FOUND,
    });
  });

  it("rejects warehouse staff access to a receipt from another warehouse", async () => {
    await expect(
      receiptService.getById(receiptId, {
        role: ROLES.WAREHOUSE_STAFF,
        warehouseId: "another-warehouse",
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: WAREHOUSE_MESSAGES.ACCESS_DENIED,
    });
  });

  it("prevents updates to cancelled receipts and core receipt fields", async () => {
    mocks.findById.mockResolvedValueOnce({
      ...receipt,
      status: RECEIPT_STATUSES.CANCELLED,
    });
    await expect(
      receiptService.updateById(receiptId, { note: "Updated" }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: RECEIPT_MESSAGES.CANNOT_UPDATE_CANCELLED,
    });

    await expect(
      receiptService.updateById(receiptId, { quantity: 3 }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: RECEIPT_MESSAGES.CANNOT_MODIFY_CORE,
    });
  });
});

describe("receiptService.cancel", () => {
  it("rejects warehouse staff who did not create the receipt or manage its warehouse", async () => {
    mocks.getWarehouseById.mockResolvedValue({
      _id: warehouseId,
      managerId: "manager-1",
    });
    await expect(
      receiptService.cancel(
        receiptId,
        {},
        {
          role: ROLES.WAREHOUSE_STAFF,
          userId: "other-staff",
          warehouseId,
        },
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: RECEIPT_MESSAGES.CANCEL_NOT_AUTHORIZED,
    });
    expect(mocks.cancelAtomic).not.toHaveBeenCalled();
  });

  it("rejects receipts that are already cancelled", async () => {
    mocks.findById.mockResolvedValueOnce({
      ...receipt,
      status: RECEIPT_STATUSES.CANCELLED,
    });
    await expect(
      receiptService.cancel(receiptId, {}, { role: ROLES.ADMIN }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: RECEIPT_MESSAGES.ALREADY_CANCELLED,
    });
  });
});
