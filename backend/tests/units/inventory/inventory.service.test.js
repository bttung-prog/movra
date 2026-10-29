import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findAll: vi.fn(),
  countAll: vi.fn(),
  findById: vi.fn(),
  findByOrderId: vi.fn(),
  findInStockByOrderId: vi.fn(),
  findByWarehouseAndOrder: vi.fn(),
  updateById: vi.fn(),
  updateConditionByOrderId: vi.fn(),
  updateConditionById: vi.fn(),
  markAsIssuedAtomic: vi.fn(),
  markAsInStockAtomic: vi.fn(),
  deleteById: vi.fn(),
  softDeleteInStockByWarehouseAndOrder: vi.fn(),
  aggregateStockByWarehouse: vi.fn(),
  getWarehouseById: vi.fn(),
  getGoodsCategoryById: vi.fn(),
  getOrderById: vi.fn(),
}));

vi.mock("../../../src/modules/inventory/inventory.repository.js", () => ({
  default: {
    create: mocks.create,
    findAll: mocks.findAll,
    countAll: mocks.countAll,
    findById: mocks.findById,
    findByOrderId: mocks.findByOrderId,
    findInStockByOrderId: mocks.findInStockByOrderId,
    findByWarehouseAndOrder: mocks.findByWarehouseAndOrder,
    updateById: mocks.updateById,
    updateConditionByOrderId: mocks.updateConditionByOrderId,
    updateConditionById: mocks.updateConditionById,
    markAsIssuedAtomic: mocks.markAsIssuedAtomic,
    markAsInStockAtomic: mocks.markAsInStockAtomic,
    deleteById: mocks.deleteById,
    softDeleteInStockByWarehouseAndOrder:
      mocks.softDeleteInStockByWarehouseAndOrder,
    aggregateStockByWarehouse: mocks.aggregateStockByWarehouse,
  },
}));

vi.mock("../../../src/modules/warehouse/warehouse.service.js", () => ({
  default: { getById: mocks.getWarehouseById },
}));

vi.mock("../../../src/modules/goodsCategory/goodsCategory.service.js", () => ({
  default: { getById: mocks.getGoodsCategoryById },
}));

vi.mock("../../../src/modules/order/order.service.js", () => ({
  default: { getById: mocks.getOrderById },
}));

import {
  INVENTORY_MESSAGES,
  WAREHOUSE_MESSAGES,
} from "../../../src/constants/messages.js";
import ROLES from "../../../src/constants/roles.js";
import inventoryService from "../../../src/modules/inventory/inventory.service.js";

const inventoryId = "inventory-1";
const warehouseId = "warehouse-1";
const orderId = "order-1";
const goodsCategoryId = "category-1";

const existingInventory = {
  _id: inventoryId,
  warehouseId,
  orderId,
  goodsCategoryId,
  quantity: 4,
  location: "A-01",
  status: "in_stock",
  condition: "good",
  deletedAt: null,
};

const validCreatePayload = {
  warehouseId,
  orderId,
  goodsCategoryId,
  quantity: 4,
  location: "A-01",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.create.mockResolvedValue(existingInventory);
  mocks.findAll.mockResolvedValue([existingInventory]);
  mocks.countAll.mockResolvedValue(1);
  mocks.findById.mockResolvedValue(existingInventory);
  mocks.findByOrderId.mockResolvedValue(existingInventory);
  mocks.findByWarehouseAndOrder.mockResolvedValue(null);
  mocks.updateById.mockResolvedValue(existingInventory);
  mocks.updateConditionByOrderId.mockResolvedValue(existingInventory);
  mocks.updateConditionById.mockResolvedValue(existingInventory);
  mocks.markAsIssuedAtomic.mockResolvedValue({
    ...existingInventory,
    status: "issued",
  });
  mocks.deleteById.mockResolvedValue({
    ...existingInventory,
    deletedAt: new Date(),
  });
  mocks.getWarehouseById.mockResolvedValue({ _id: warehouseId });
  mocks.getGoodsCategoryById.mockResolvedValue({ _id: goodsCategoryId });
  mocks.getOrderById.mockResolvedValue({ _id: orderId });
  mocks.aggregateStockByWarehouse.mockResolvedValue([]);
});

describe("inventoryService.create", () => {
  it("validates related records and creates inventory with default values", async () => {
    await inventoryService.create(validCreatePayload);

    expect(mocks.getWarehouseById).toHaveBeenCalledWith(
      warehouseId,
      true,
      true,
    );
    expect(mocks.getGoodsCategoryById).toHaveBeenCalledWith(
      goodsCategoryId,
      true,
      null,
    );
    expect(mocks.getOrderById).toHaveBeenCalledWith(orderId, true);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ...validCreatePayload,
        condition: "good",
        status: "in_stock",
      }),
      null,
    );
  });

  it("rejects non-positive quantities before querying related records", async () => {
    await expect(
      inventoryService.create({ ...validCreatePayload, quantity: 0 }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: INVENTORY_MESSAGES.QTY_MUST_BE_GREATER_THAN_ZERO,
    });
    expect(mocks.getWarehouseById).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects an item already in stock at the same warehouse", async () => {
    mocks.findByWarehouseAndOrder.mockResolvedValue(existingInventory);

    await expect(
      inventoryService.create(validCreatePayload),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: INVENTORY_MESSAGES.ALREADY_IN_STOCK,
    });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.updateById).not.toHaveBeenCalled();
  });

  it("reuses a previously issued record as in-stock inventory", async () => {
    mocks.findByWarehouseAndOrder.mockResolvedValue({
      ...existingInventory,
      status: "issued",
    });

    await inventoryService.create(validCreatePayload);

    expect(mocks.updateById).toHaveBeenCalledWith(
      inventoryId,
      expect.objectContaining({
        warehouseId,
        goodsCategoryId,
        quantity: 4,
        location: "A-01",
        condition: "good",
        status: "in_stock",
        deletedAt: null,
      }),
      null,
    );
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

describe("inventoryService.getAll", () => {
  it("builds filters, escaped location search, sort and pagination", async () => {
    const result = await inventoryService.getAll({
      page: "2",
      limit: "5",
      status: "in_stock",
      condition: "good",
      location: " A-01 (fragile) ",
      sortBy: "quantity",
      sortOrder: "asc",
    });

    const expectedFilter = {
      deletedAt: null,
      status: "in_stock",
      condition: "good",
      location: { $regex: "A\\-01 \\(fragile\\)", $options: "i" },
    };
    expect(mocks.findAll).toHaveBeenCalledWith({
      filter: expectedFilter,
      skip: 5,
      limit: 5,
      sort: { quantity: 1 },
    });
    expect(mocks.countAll).toHaveBeenCalledWith({ filter: expectedFilter });
    expect(result.pagination).toEqual({
      page: 2,
      limit: 5,
      total: 1,
      totalPages: 1,
    });
  });

  it("scopes warehouse staff to their assigned warehouse", async () => {
    await inventoryService.getAll(
      {},
      {
        role: ROLES.WAREHOUSE_STAFF,
        warehouseId,
      },
    );

    expect(mocks.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: { deletedAt: null, warehouseId },
      }),
    );
  });

  it("rejects warehouse-scoped users without an assigned warehouse", async () => {
    await expect(
      inventoryService.getAll({}, { role: ROLES.WAREHOUSE_STAFF }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: WAREHOUSE_MESSAGES.STAFF_NOT_ASSIGNED,
    });
    expect(mocks.findAll).not.toHaveBeenCalled();
  });
});

describe("inventoryService inventory lookup and access", () => {
  it("returns a non-deleted inventory record", async () => {
    const result = await inventoryService.getById(inventoryId);

    expect(result).toBe(existingInventory);
    expect(mocks.findById).toHaveBeenCalledWith(inventoryId, null);
  });

  it("returns not found when the inventory record does not exist", async () => {
    mocks.findById.mockResolvedValue(null);

    await expect(inventoryService.getById(inventoryId)).rejects.toMatchObject({
      statusCode: 404,
      message: INVENTORY_MESSAGES.NOT_FOUND,
    });
  });

  it("rejects access to inventory belonging to another warehouse", async () => {
    const user = { role: ROLES.WAREHOUSE_STAFF, warehouseId: "warehouse-2" };

    await expect(
      inventoryService.getById(inventoryId, true, null, user),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: INVENTORY_MESSAGES.UNAUTHORIZED_VIEW_DIFFERENT_WAREHOUSE,
    });
  });

  it("scopes lookup by order to the warehouse of warehouse staff", async () => {
    await inventoryService.getByOrderId(orderId, null, {
      role: ROLES.WAREHOUSE_STAFF,
      warehouseId,
    });

    expect(mocks.findByOrderId).toHaveBeenCalledWith(
      orderId,
      warehouseId,
      null,
    );
  });
});

describe("inventoryService updates", () => {
  it("trims location and performs a conditional update for in-stock records", async () => {
    await inventoryService.updateLocation(inventoryId, "  B-02  ");

    expect(mocks.updateById).toHaveBeenCalledWith(
      inventoryId,
      { location: "B-02" },
      null,
      { status: "in_stock" },
    );
  });

  it("rejects empty location and non-in-stock location updates", async () => {
    await expect(
      inventoryService.updateLocation(inventoryId, "   "),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: INVENTORY_MESSAGES.LOCATION_EMPTY,
    });

    mocks.findById.mockResolvedValue({
      ...existingInventory,
      status: "issued",
    });
    await expect(
      inventoryService.updateLocation(inventoryId, "B-02"),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: INVENTORY_MESSAGES.CANNOT_UPDATE_NOT_IN_STOCK,
    });
    expect(mocks.updateById).not.toHaveBeenCalled();
  });

  it("reports concurrent modification when a conditional location update misses", async () => {
    mocks.updateById.mockResolvedValue(null);

    await expect(
      inventoryService.updateLocation(inventoryId, "B-02"),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: INVENTORY_MESSAGES.CONCURRENT_MODIFICATION,
    });
  });

  it("validates status and quantity before updating", async () => {
    await expect(
      inventoryService.updateStatus(inventoryId, "reserved"),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: INVENTORY_MESSAGES.INVALID_STATUS,
    });
    await expect(
      inventoryService.updateQuantity(inventoryId, -1),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: INVENTORY_MESSAGES.QTY_MUST_BE_NON_NEGATIVE,
    });
    expect(mocks.updateById).not.toHaveBeenCalled();
  });

  it("updates a valid status and non-negative quantity", async () => {
    await inventoryService.updateStatus(inventoryId, "issued");
    await inventoryService.updateQuantity(inventoryId, 0);

    expect(mocks.updateById).toHaveBeenNthCalledWith(
      1,
      inventoryId,
      { status: "issued" },
      null,
    );
    expect(mocks.updateById).toHaveBeenNthCalledWith(
      2,
      inventoryId,
      { quantity: 0 },
      null,
    );
  });

  it("validates condition before updating by order or inventory ID", async () => {
    await expect(
      inventoryService.updateCondition(orderId, "excellent"),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: INVENTORY_MESSAGES.INVALID_CONDITION,
    });
    await expect(
      inventoryService.updateConditionById(inventoryId, "excellent"),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: INVENTORY_MESSAGES.INVALID_CONDITION,
    });
    expect(mocks.updateConditionByOrderId).not.toHaveBeenCalled();
    expect(mocks.updateConditionById).not.toHaveBeenCalled();
  });
});

describe("inventoryService issue and delete operations", () => {
  it("returns the atomically issued record", async () => {
    const issued = { ...existingInventory, status: "issued" };
    mocks.markAsIssuedAtomic.mockResolvedValue(issued);

    await expect(
      inventoryService.markAsIssuedByOrderId(orderId, warehouseId),
    ).resolves.toBe(issued);
    expect(mocks.markAsIssuedAtomic).toHaveBeenCalledWith(
      orderId,
      warehouseId,
      null,
    );
  });

  it("distinguishes an already issued record from a concurrent update", async () => {
    mocks.markAsIssuedAtomic.mockResolvedValue(null);
    mocks.findByOrderId.mockResolvedValue({
      ...existingInventory,
      status: "issued",
    });

    await expect(
      inventoryService.markAsIssuedByOrderId(orderId),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: INVENTORY_MESSAGES.ALREADY_ISSUED,
    });

    mocks.findByOrderId.mockResolvedValue(existingInventory);
    await expect(
      inventoryService.markAsIssuedByOrderId(orderId),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: INVENTORY_MESSAGES.CONCURRENT_UPDATE_ERROR,
    });
  });

  it("soft deletes a record only after checking it exists", async () => {
    await inventoryService.softDelete(inventoryId);

    expect(mocks.deleteById).toHaveBeenCalledWith(inventoryId, null);
  });

  it("returns the stock summary scoped to warehouse staff", async () => {
    mocks.aggregateStockByWarehouse.mockResolvedValue([{ totalQuantity: 4 }]);
    mocks.countAll.mockResolvedValueOnce(2).mockResolvedValueOnce(3);
    const user = { role: ROLES.WAREHOUSE_STAFF, warehouseId };

    const summary = await inventoryService.getSummary(null, user);

    expect(summary).toEqual({
      totalInStockOrders: 2,
      totalIssuedOrders: 3,
      warehouseStock: [{ totalQuantity: 4 }],
    });
    expect(mocks.aggregateStockByWarehouse).toHaveBeenCalledWith(
      warehouseId,
      null,
    );
    expect(mocks.countAll).toHaveBeenNthCalledWith(1, {
      filter: { status: "in_stock", warehouseId },
      session: null,
    });
    expect(mocks.countAll).toHaveBeenNthCalledWith(2, {
      filter: { status: "issued", warehouseId },
      session: null,
    });
  });
});
