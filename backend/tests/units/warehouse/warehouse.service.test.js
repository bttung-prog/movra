import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findAll: vi.fn(),
  countAll: vi.fn(),
  findById: vi.fn(),
  findActive: vi.fn(),
  findByName: vi.fn(),
  updateById: vi.fn(),
  getUserById: vi.fn(),
  countInventory: vi.fn(),
  countActiveDispatchers: vi.fn(),
  countActiveDrivers: vi.fn(),
  countActiveStaff: vi.fn(),
}));

vi.mock("../../../src/modules/warehouse/warehouse.repository.js", () => ({
  default: {
    create: mocks.create,
    findAll: mocks.findAll,
    countAll: mocks.countAll,
    findById: mocks.findById,
    findActive: mocks.findActive,
    findByName: mocks.findByName,
    updateById: mocks.updateById,
  },
}));

vi.mock("../../../src/modules/user/user.service.js", () => ({
  default: { getById: mocks.getUserById },
}));

vi.mock("../../../src/modules/inventory/inventory.service.js", () => ({
  default: { countAll: mocks.countInventory },
}));

vi.mock("../../../src/modules/dispatcher/dispatcher.service.js", () => ({
  default: { countActiveByWarehouseId: mocks.countActiveDispatchers },
}));

vi.mock("../../../src/modules/driver/driver.service.js", () => ({
  default: { countActiveByWarehouseId: mocks.countActiveDrivers },
}));

vi.mock("../../../src/modules/staff/staff.service.js", () => ({
  default: { countActiveByWarehouseId: mocks.countActiveStaff },
}));

import { WAREHOUSE_MESSAGES } from "../../../src/constants/messages.js";
import ROLES from "../../../src/constants/roles.js";
import USER_STATUSES from "../../../src/constants/userStatuses.js";
import WAREHOUSE_STATUSES from "../../../src/constants/warehouseStatuses.js";
import warehouseService from "../../../src/modules/warehouse/warehouse.service.js";

const warehouseId = "warehouse-1";
const managerId = "manager-1";
const warehouse = {
  _id: warehouseId,
  warehouseName: "Central",
  warehouseAddress: "1 Main Street",
  managerId: null,
  status: WAREHOUSE_STATUSES.ACTIVE,
  deletedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findByName.mockResolvedValue(null);
  mocks.findById.mockResolvedValue(warehouse);
  mocks.findActive.mockResolvedValue([
    { ...warehouse, latitude: 10.78, longitude: 106.69 },
  ]);
  mocks.create.mockResolvedValue(warehouse);
  mocks.findAll.mockResolvedValue([warehouse]);
  mocks.countAll.mockResolvedValue(21);
  mocks.updateById.mockResolvedValue(warehouse);
  mocks.getUserById.mockResolvedValue({
    _id: managerId,
    role: ROLES.WAREHOUSE_STAFF,
    status: USER_STATUSES.ACTIVE,
  });
  mocks.countInventory.mockResolvedValue(0);
  mocks.countActiveDispatchers.mockResolvedValue(0);
  mocks.countActiveDrivers.mockResolvedValue(0);
  mocks.countActiveStaff.mockResolvedValue(0);
});

describe("warehouseService.create", () => {
  it("trims warehouse fields, applies defaults, and validates a manager", async () => {
    await warehouseService.create({
      warehouseName: "  Central ",
      warehouseAddress: "  1 Main Street ",
      latitude: 10.78,
      longitude: 106.69,
      managerId,
    });

    expect(mocks.getUserById).toHaveBeenCalledWith(managerId);
    expect(mocks.create).toHaveBeenCalledWith({
      warehouseName: "Central",
      warehouseAddress: "1 Main Street",
      latitude: 10.78,
      longitude: 106.69,
      managerId,
      status: WAREHOUSE_STATUSES.ACTIVE,
    });
  });

  it("rejects duplicate names and invalid manager users", async () => {
    mocks.findByName.mockResolvedValueOnce(warehouse);
    await expect(
      warehouseService.create({
        warehouseName: "Central",
        warehouseAddress: "Address",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: WAREHOUSE_MESSAGES.ALREADY_EXISTS,
    });

    mocks.getUserById.mockResolvedValueOnce({
      status: USER_STATUSES.INACTIVE,
      role: ROLES.WAREHOUSE_STAFF,
    });
    await expect(
      warehouseService.create({
        warehouseName: "Other",
        warehouseAddress: "Address",
        managerId,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: WAREHOUSE_MESSAGES.MANAGER_NOT_ACTIVE,
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

describe("warehouseService.getNearestActiveWarehouse", () => {
  it("selects the nearest active warehouse using haversine distance", async () => {
    mocks.findActive.mockResolvedValue([
      { _id: "far", latitude: 11, longitude: 106.69 },
      { _id: "near", latitude: 10.781, longitude: 106.69 },
    ]);

    const result = await warehouseService.getNearestActiveWarehouse(
      10.78,
      106.69,
    );

    expect(result.warehouse._id).toBe("near");
    expect(result.distanceKm).toBeGreaterThan(0);
    expect(result.distanceKm).toBeLessThan(1);
  });

  it("fails explicitly if warehouses are missing coordinates", async () => {
    mocks.findActive.mockResolvedValue([
      { _id: "warehouse-1", latitude: 10.78 },
    ]);

    await expect(
      warehouseService.getNearestActiveWarehouse(10.78, 106.69),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: WAREHOUSE_MESSAGES.COORDINATES_NOT_CONFIGURED,
    });
  });
});

describe("warehouseService.getAll", () => {
  it("paginates, searches escaped name/address text, and filters deleted records", async () => {
    const result = await warehouseService.getAll({
      page: 2,
      limit: 5,
      search: "  A+B ",
      status: WAREHOUSE_STATUSES.ACTIVE,
    });

    const query = mocks.findAll.mock.calls[0][0];
    expect(query).toMatchObject({
      skip: 5,
      limit: 5,
      filter: {
        deletedAt: null,
        status: WAREHOUSE_STATUSES.ACTIVE,
      },
    });
    expect(query.filter.$or[0].warehouseName).toBeInstanceOf(RegExp);
    expect(query.filter.$or[0].warehouseName.test("A+B")).toBe(true);
    expect(query.filter.$or[0].warehouseName.test("AAAB")).toBe(false);
    expect(mocks.countAll).toHaveBeenCalledWith({ filter: query.filter });
    expect(result.pagination).toEqual({
      page: 2,
      limit: 5,
      total: 21,
      totalPages: 5,
    });
  });

  it("restricts dispatcher and warehouse staff queries to their warehouse", async () => {
    for (const role of [ROLES.DISPATCHER, ROLES.WAREHOUSE_STAFF]) {
      await warehouseService.getAll({}, { role, warehouseId });
      expect(mocks.findAll).toHaveBeenLastCalledWith(
        expect.objectContaining({
          filter: { deletedAt: null, _id: warehouseId },
        }),
      );
    }
  });
});

describe("warehouseService.getById and updateById", () => {
  it("returns active warehouses and enforces warehouse-scoped access", async () => {
    await expect(
      warehouseService.getById(warehouseId, true, true),
    ).resolves.toBe(warehouse);

    await expect(
      warehouseService.getById(warehouseId, true, false, {
        role: ROLES.DISPATCHER,
        warehouseId: "another-warehouse",
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: WAREHOUSE_MESSAGES.ACCESS_DENIED,
    });
  });

  it("rejects missing, deleted, or inactive warehouses when required", async () => {
    mocks.findById.mockResolvedValueOnce(null);
    await expect(warehouseService.getById(warehouseId)).rejects.toMatchObject({
      statusCode: 404,
      message: WAREHOUSE_MESSAGES.NOT_FOUND,
    });

    mocks.findById.mockResolvedValueOnce({
      ...warehouse,
      deletedAt: new Date(),
    });
    await expect(warehouseService.getById(warehouseId)).rejects.toMatchObject({
      statusCode: 400,
      message: WAREHOUSE_MESSAGES.ALREADY_DELETED,
    });

    mocks.findById.mockResolvedValueOnce({
      ...warehouse,
      status: WAREHOUSE_STATUSES.INACTIVE,
    });
    await expect(
      warehouseService.getById(warehouseId, true, true),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: WAREHOUSE_MESSAGES.NOT_ACTIVE,
    });
  });

  it("trims update fields and rejects a name used by another warehouse", async () => {
    await warehouseService.updateById(warehouseId, {
      warehouseName: "  Central  ",
      warehouseAddress: "  New address ",
    });
    expect(mocks.updateById).toHaveBeenCalledWith(warehouseId, {
      warehouseName: "Central",
      warehouseAddress: "New address",
    });

    mocks.findByName.mockResolvedValueOnce({
      _id: "another-warehouse",
      warehouseName: "Other",
    });
    await expect(
      warehouseService.updateById(warehouseId, { warehouseName: "Other" }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: WAREHOUSE_MESSAGES.NAME_EXISTS,
    });
  });
});

describe("warehouseService status, delete, and restore operations", () => {
  it("blocks deactivation when active personnel or stock remains", async () => {
    mocks.countActiveDispatchers.mockResolvedValueOnce(1);
    await expect(
      warehouseService.changeStatus(
        warehouseId,
        WAREHOUSE_STATUSES.MAINTENANCE,
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: WAREHOUSE_MESSAGES.CANNOT_DEACTIVATE_HAS_ACTIVE_PERSONNEL(
        1,
        0,
        0,
      ),
    });

    mocks.countInventory.mockResolvedValueOnce(2);
    await expect(
      warehouseService.changeStatus(warehouseId, WAREHOUSE_STATUSES.INACTIVE),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: WAREHOUSE_MESSAGES.CANNOT_DEACTIVATE_HAS_STOCK(2),
    });
    expect(mocks.updateById).not.toHaveBeenCalled();
  });

  it("soft deletes an empty warehouse and refuses deletion with stock", async () => {
    await warehouseService.softDelete(warehouseId);
    expect(mocks.updateById).toHaveBeenCalledWith(
      warehouseId,
      expect.objectContaining({
        status: WAREHOUSE_STATUSES.INACTIVE,
        deletedAt: expect.any(Date),
      }),
    );

    mocks.countInventory.mockResolvedValueOnce(3);
    await expect(
      warehouseService.softDelete(warehouseId),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: WAREHOUSE_MESSAGES.CANNOT_DELETE_HAS_STOCK(3),
    });
  });

  it("restores deleted warehouses and rejects active name conflicts", async () => {
    mocks.findById.mockResolvedValueOnce({
      ...warehouse,
      deletedAt: new Date(),
      status: WAREHOUSE_STATUSES.INACTIVE,
    });
    await warehouseService.restore(warehouseId);
    expect(mocks.updateById).toHaveBeenCalledWith(warehouseId, {
      deletedAt: null,
      status: WAREHOUSE_STATUSES.ACTIVE,
    });

    mocks.findById.mockResolvedValueOnce({
      ...warehouse,
      deletedAt: new Date(),
    });
    mocks.findByName.mockResolvedValueOnce({
      _id: "another-warehouse",
      warehouseName: warehouse.warehouseName,
    });
    await expect(warehouseService.restore(warehouseId)).rejects.toMatchObject({
      statusCode: 409,
      message: WAREHOUSE_MESSAGES.CANNOT_RESTORE_NAME_EXISTS,
    });
  });
});
