import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserById: vi.fn(),
  getWarehouseById: vi.fn(),
  findByUserId: vi.fn(),
  findByCode: vi.fn(),
  createStaff: vi.fn(),
  findAllStaff: vi.fn(),
  countAllStaff: vi.fn(),
  findStaffById: vi.fn(),
  countActiveByWarehouseId: vi.fn(),
  updateStaffById: vi.fn(),
  deleteStaffById: vi.fn(),
  restoreStaffById: vi.fn(),
  transferWarehouse: vi.fn(),
  generateCode: vi.fn(),
}));

vi.mock("../../../src/modules/user/user.service.js", () => ({
  default: { getById: mocks.getUserById },
}));

vi.mock("../../../src/modules/warehouse/warehouse.service.js", () => ({
  default: { getById: mocks.getWarehouseById },
}));

vi.mock("../../../src/modules/staff/staff.repository.js", () => ({
  default: {
    findByUserId: mocks.findByUserId,
    findByCode: mocks.findByCode,
    create: mocks.createStaff,
    findAll: mocks.findAllStaff,
    countAll: mocks.countAllStaff,
    findById: mocks.findStaffById,
    countActiveByWarehouseId: mocks.countActiveByWarehouseId,
    updateById: mocks.updateStaffById,
    deleteById: mocks.deleteStaffById,
    restoreById: mocks.restoreStaffById,
    transferWarehouse: mocks.transferWarehouse,
  },
}));

vi.mock("../../../src/utils/generateCode.js", () => ({
  default: mocks.generateCode,
}));

import { STAFF_MESSAGES } from "../../../src/constants/messages.js";
import staffService from "../../../src/modules/staff/staff.service.js";

const userId = "507f1f77bcf86cd799439011";
const warehouseId = "507f1f77bcf86cd799439012";
const staffId = "507f1f77bcf86cd799439013";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUserById.mockResolvedValue({ _id: userId });
  mocks.getWarehouseById.mockResolvedValue({
    _id: warehouseId,
    warehouseName: "Warehouse A",
  });
  mocks.findByUserId.mockResolvedValue({
    _id: staffId,
    userId,
    warehouseId,
    staffCode: "ST-0001",
    status: "active",
  });
  mocks.findByCode.mockResolvedValue(null);
  mocks.generateCode.mockReturnValue("ST-0001");
  mocks.createStaff.mockResolvedValue({
    _id: staffId,
    userId,
    warehouseId,
    staffCode: "ST-0001",
    status: "active",
  });
  mocks.findAllStaff.mockResolvedValue([
    { _id: staffId, staffCode: "ST-0001" },
  ]);
  mocks.countAllStaff.mockResolvedValue(12);
  mocks.findStaffById.mockResolvedValue({
    _id: staffId,
    userId,
    warehouseId,
    status: "active",
  });
  mocks.countActiveByWarehouseId.mockResolvedValue(3);
  mocks.updateStaffById.mockResolvedValue({
    _id: staffId,
    userId,
    warehouseId,
    status: "inactive",
  });
  mocks.deleteStaffById.mockResolvedValue({
    _id: staffId,
    status: "inactive",
  });
  mocks.restoreStaffById.mockResolvedValue({
    _id: staffId,
    status: "active",
  });
  mocks.transferWarehouse.mockResolvedValue({
    _id: staffId,
    warehouseId: "507f1f77bcf86cd799439014",
    status: "active",
  });
});

describe("staffService.create", () => {
  it("creates a warehouse staff profile with a generated code", async () => {
    mocks.findByUserId.mockResolvedValue(null);

    const result = await staffService.create({ userId, warehouseId });

    expect(result).toMatchObject({
      _id: staffId,
      userId,
      warehouseId,
      staffCode: "ST-0001",
    });
    expect(mocks.getUserById).toHaveBeenCalledWith(userId, null);
    expect(mocks.getWarehouseById).toHaveBeenCalledWith(
      warehouseId,
      true,
      true,
    );
    expect(mocks.findByUserId).toHaveBeenCalledWith(userId, null);
    expect(mocks.generateCode).toHaveBeenCalledWith("ST-");
    expect(mocks.createStaff).toHaveBeenCalledWith(
      { userId, warehouseId, staffCode: "ST-0001" },
      null,
    );
  });

  it("rejects duplicate warehouse staff record for the same user", async () => {
    mocks.findByUserId.mockResolvedValue({ _id: staffId });

    await expect(
      staffService.create({ userId, warehouseId }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: STAFF_MESSAGES.ALREADY_EXISTS,
    });
    expect(mocks.createStaff).not.toHaveBeenCalled();
  });

  it("fails when a unique code cannot be generated after 5 attempts", async () => {
    mocks.findByUserId.mockResolvedValue(null);
    mocks.findByCode.mockResolvedValue({ _id: "another-staff" });

    await expect(
      staffService.create({ userId, warehouseId }),
    ).rejects.toMatchObject({
      statusCode: 500,
      message: STAFF_MESSAGES.CODE_GEN_FAILED,
    });
    expect(mocks.createStaff).not.toHaveBeenCalled();
  });
});

describe("staffService.getAll", () => {
  it("returns a paginated staff list and supports search by code", async () => {
    const result = await staffService.getAll({
      page: 2,
      limit: 5,
      search: "ST-0001",
    });

    expect(result).toMatchObject({
      data: [{ _id: staffId, staffCode: "ST-0001" }],
      pagination: {
        page: 2,
        limit: 5,
        total: 12,
        totalPages: 3,
      },
    });
    expect(mocks.findAllStaff).toHaveBeenCalledWith({
      filter: { staffCode: { $regex: "ST\\-0001", $options: "i" } },
      skip: 5,
      limit: 5,
    });
  });
});

describe("staffService.getById and lookups", () => {
  it("returns the staff by id", async () => {
    await expect(staffService.getById(staffId)).resolves.toMatchObject({
      _id: staffId,
      userId,
    });
  });

  it("throws when staff is not found by userId or code", async () => {
    mocks.findByUserId.mockResolvedValue(null);
    mocks.findByCode.mockResolvedValue(null);

    await expect(staffService.getByUserId(userId)).rejects.toMatchObject({
      statusCode: 404,
      message: STAFF_MESSAGES.NOT_FOUND,
    });

    await expect(staffService.getByCode("ST-0001")).rejects.toMatchObject({
      statusCode: 404,
      message: STAFF_MESSAGES.NOT_FOUND,
    });
  });
});

describe("staffService.updateById and delete/restore/transfer", () => {
  it("updates staff and validates warehouse when provided", async () => {
    const result = await staffService.updateById(staffId, {
      status: "inactive",
    });

    expect(result).toMatchObject({
      _id: staffId,
      status: "inactive",
    });
    expect(mocks.updateStaffById).toHaveBeenCalledWith(
      staffId,
      { status: "inactive" },
      null,
    );
  });

  it("deletes and restores a staff profile", async () => {
    await expect(staffService.deleteById(staffId)).resolves.toMatchObject({
      _id: staffId,
      status: "inactive",
    });

    await expect(staffService.restoreById(staffId)).resolves.toMatchObject({
      _id: staffId,
      status: "active",
    });
  });

  it("transfers warehouse assignment to a valid warehouse", async () => {
    const newWarehouseId = "507f1f77bcf86cd799439014";

    await expect(
      staffService.transferWarehouse(staffId, newWarehouseId),
    ).resolves.toMatchObject({
      _id: staffId,
      warehouseId: newWarehouseId,
    });
    expect(mocks.getWarehouseById).toHaveBeenCalledWith(
      newWarehouseId,
      true,
      true,
    );
    expect(mocks.transferWarehouse).toHaveBeenCalledWith(
      staffId,
      newWarehouseId,
    );
  });
});

describe("staffService.profile helpers", () => {
  it("returns the current staff profile by userId", async () => {
    await expect(staffService.getMyProfile(userId)).resolves.toMatchObject({
      _id: staffId,
      userId,
    });
  });

  it("counts active staff in a warehouse", async () => {
    await expect(
      staffService.countActiveByWarehouseId(warehouseId),
    ).resolves.toBe(3);
    expect(mocks.countActiveByWarehouseId).toHaveBeenCalledWith(warehouseId);
  });
});
