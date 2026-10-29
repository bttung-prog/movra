import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findAll: vi.fn(),
  countAll: vi.fn(),
  findById: vi.fn(),
  findByName: vi.fn(),
  updateById: vi.fn(),
  deleteById: vi.fn(),
  restoreById: vi.fn(),
  countInventory: vi.fn(),
  countOrders: vi.fn(),
}));

vi.mock(
  "../../../src/modules/goodsCategory/goodsCategory.repository.js",
  () => ({
    default: {
      create: mocks.create,
      findAll: mocks.findAll,
      countAll: mocks.countAll,
      findById: mocks.findById,
      findByName: mocks.findByName,
      updateById: mocks.updateById,
      deleteById: mocks.deleteById,
      restoreById: mocks.restoreById,
    },
  }),
);

vi.mock("../../../src/modules/inventory/inventory.service.js", () => ({
  default: { countAll: mocks.countInventory },
}));

vi.mock("../../../src/modules/order/order.service.js", () => ({
  default: { countAll: mocks.countOrders },
}));

import { GOODS_CATEGORY_MESSAGES } from "../../../src/constants/messages.js";
import { INVENTORY_STATUSES } from "../../../src/constants/inventoryStatuses.js";
import goodsCategoryService from "../../../src/modules/goodsCategory/goodsCategory.service.js";

const categoryId = "category-1";
const category = {
  _id: categoryId,
  goodsCategoryName: "Electronics",
  description: "Devices",
  deletedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findByName.mockResolvedValue(null);
  mocks.findById.mockResolvedValue(category);
  mocks.create.mockResolvedValue(category);
  mocks.findAll.mockResolvedValue([category]);
  mocks.countAll.mockResolvedValue(21);
  mocks.updateById.mockResolvedValue(category);
  mocks.deleteById.mockResolvedValue({ ...category, deletedAt: new Date() });
  mocks.restoreById.mockResolvedValue(category);
  mocks.countInventory.mockResolvedValue(0);
  mocks.countOrders.mockResolvedValue(0);
});

describe("goodsCategoryService.create", () => {
  it("normalizes category fields before creating", async () => {
    await goodsCategoryService.create({
      goodsCategoryName: "  Electronics ",
      description: "  Devices  ",
    });

    expect(mocks.findByName).toHaveBeenNthCalledWith(
      1,
      "Electronics",
      { deletedAt: null },
      null,
    );
    expect(mocks.create).toHaveBeenCalledWith(
      { goodsCategoryName: "Electronics", description: "Devices" },
      null,
    );
  });

  it("rejects names already used by active or deleted categories", async () => {
    mocks.findByName.mockResolvedValueOnce(category);
    await expect(
      goodsCategoryService.create({ goodsCategoryName: "Electronics" }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: GOODS_CATEGORY_MESSAGES.NAME_EXISTS,
    });

    mocks.findByName
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...category, deletedAt: new Date() });
    await expect(
      goodsCategoryService.create({ goodsCategoryName: "Electronics" }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: GOODS_CATEGORY_MESSAGES.PREVIOUSLY_DELETED,
    });

    expect(mocks.create).not.toHaveBeenCalled();
  });
});

describe("goodsCategoryService.getAll", () => {
  it("filters active/deleted records, escapes search, and returns pagination", async () => {
    const result = await goodsCategoryService.getAll({
      page: 2,
      limit: 5,
      search: "  A+B ",
      status: "active",
      sortBy: "goodsCategoryName",
      sortOrder: "asc",
    });

    const filter = mocks.findAll.mock.calls[0][0].filter;
    expect(filter).toEqual({
      deletedAt: null,
      goodsCategoryName: { $regex: "A\\+B", $options: "i" },
    });
    expect(mocks.findAll).toHaveBeenCalledWith({
      filter,
      skip: 5,
      limit: 5,
      sort: { goodsCategoryName: 1 },
      session: null,
    });
    expect(mocks.countAll).toHaveBeenCalledWith({ filter, session: null });
    expect(result.pagination).toEqual({
      page: 2,
      limit: 5,
      total: 21,
      totalPages: 5,
    });

    await goodsCategoryService.getAll({ status: "deleted" });
    expect(mocks.findAll.mock.calls[1][0].filter).toEqual({
      deletedAt: { $ne: null },
    });

    await goodsCategoryService.getAll({ status: "all" });
    expect(mocks.findAll.mock.calls[2][0].filter).toEqual({});
  });
});

describe("goodsCategoryService.getById and updateById", () => {
  it("rejects missing and soft-deleted categories when active is required", async () => {
    mocks.findById.mockResolvedValueOnce(null);
    await expect(
      goodsCategoryService.getById(categoryId),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: GOODS_CATEGORY_MESSAGES.NOT_FOUND,
    });

    mocks.findById.mockResolvedValueOnce({
      ...category,
      deletedAt: new Date(),
    });
    await expect(
      goodsCategoryService.getById(categoryId),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: GOODS_CATEGORY_MESSAGES.ALREADY_DELETED,
    });
  });

  it("trims updates and permits the current name regardless of case", async () => {
    await goodsCategoryService.updateById(categoryId, {
      goodsCategoryName: "  ELECTRONICS ",
      description: "  Updated devices  ",
    });

    expect(mocks.findByName).not.toHaveBeenCalled();
    expect(mocks.updateById).toHaveBeenCalledWith(
      categoryId,
      {
        goodsCategoryName: "ELECTRONICS",
        description: "Updated devices",
      },
      null,
    );
  });

  it("rejects a name used by a different active category", async () => {
    mocks.findByName.mockResolvedValueOnce({
      _id: "another-category",
      goodsCategoryName: "Books",
      deletedAt: null,
    });

    await expect(
      goodsCategoryService.updateById(categoryId, {
        goodsCategoryName: "Books",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: GOODS_CATEGORY_MESSAGES.NAME_EXISTS,
    });
    expect(mocks.updateById).not.toHaveBeenCalled();
  });
});

describe("goodsCategoryService.deleteById", () => {
  it("blocks deletion while inventory stock exists", async () => {
    mocks.countInventory.mockResolvedValue(3);

    await expect(
      goodsCategoryService.deleteById(categoryId),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: GOODS_CATEGORY_MESSAGES.CANNOT_DELETE_HAS_STOCK(3),
    });

    expect(mocks.countInventory).toHaveBeenCalledWith({
      filter: {
        goodsCategoryId: categoryId,
        status: INVENTORY_STATUSES.IN_STOCK,
      },
      session: null,
    });
    expect(mocks.deleteById).not.toHaveBeenCalled();
  });

  it("blocks deletion while active orders reference the category", async () => {
    mocks.countOrders.mockResolvedValue(2);

    await expect(
      goodsCategoryService.deleteById(categoryId),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: GOODS_CATEGORY_MESSAGES.CANNOT_DELETE_ACTIVE_ORDERS(2),
    });

    expect(mocks.countOrders).toHaveBeenCalledWith({
      filter: {
        goodCategory: categoryId,
        status: { $nin: ["delivered", "returned", "cancelled"] },
      },
    });
    expect(mocks.deleteById).not.toHaveBeenCalled();
  });

  it("deletes an active category only when no stock or active orders remain", async () => {
    await goodsCategoryService.deleteById(categoryId);

    expect(mocks.deleteById).toHaveBeenCalledWith(categoryId, null);
  });
});

describe("goodsCategoryService.restoreById", () => {
  it("rejects active categories and prevents restoring a duplicate active name", async () => {
    await expect(
      goodsCategoryService.restoreById(categoryId),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: GOODS_CATEGORY_MESSAGES.NOT_DELETED,
    });
    expect(mocks.restoreById).not.toHaveBeenCalled();

    mocks.findById.mockResolvedValueOnce({
      ...category,
      deletedAt: new Date(),
    });
    mocks.findByName.mockResolvedValueOnce({
      _id: "another-category",
      goodsCategoryName: category.goodsCategoryName,
      deletedAt: null,
    });

    await expect(
      goodsCategoryService.restoreById(categoryId),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: GOODS_CATEGORY_MESSAGES.CANNOT_RESTORE_NAME_EXISTS,
    });
    expect(mocks.restoreById).not.toHaveBeenCalled();
  });

  it("restores a deleted category when its name is available", async () => {
    mocks.findById.mockResolvedValueOnce({
      ...category,
      deletedAt: new Date(),
    });

    await goodsCategoryService.restoreById(categoryId);

    expect(mocks.restoreById).toHaveBeenCalledWith(categoryId, null);
  });
});
