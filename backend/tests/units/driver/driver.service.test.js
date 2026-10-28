import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserById: vi.fn(),
  updateUserStatus: vi.fn(),
  getWarehouseById: vi.fn(),
  getVehicleById: vi.fn(),
  assignVehicleToWarehouse: vi.fn(),
  countActiveTripsByDriverId: vi.fn(),
  checkIdentityConflict: vi.fn(),
  findByCode: vi.fn(),
  create: vi.fn(),
  findAll: vi.fn(),
  countAll: vi.fn(),
  findById: vi.fn(),
  updateById: vi.fn(),
  deleteById: vi.fn(),
  findByUserId: vi.fn(),
  findByCurrentVehicleId: vi.fn(),
  findVehicleIdsByWarehouseId: vi.fn(),
  findIdsByWarehouseId: vi.fn(),
  countActiveByWarehouseId: vi.fn(),
  renewLicense: vi.fn(),
  generateCode: vi.fn(),
}));

vi.mock("../../../src/modules/user/user.service.js", () => ({
  default: {
    getById: mocks.getUserById,
    updateStatus: mocks.updateUserStatus,
  },
}));

vi.mock("../../../src/modules/warehouse/warehouse.service.js", () => ({
  default: { getById: mocks.getWarehouseById },
}));

vi.mock("../../../src/modules/vehicle/vehicle.service.js", () => ({
  default: {
    getById: mocks.getVehicleById,
    assignToWarehouse: mocks.assignVehicleToWarehouse,
  },
}));

vi.mock("../../../src/modules/trip/trip.service.js", () => ({
  default: { countActiveByDriverId: mocks.countActiveTripsByDriverId },
}));

vi.mock("../../../src/modules/driver/driver.repository.js", () => ({
  default: {
    checkIdentityConflict: mocks.checkIdentityConflict,
    findByCode: mocks.findByCode,
    create: mocks.create,
    findAll: mocks.findAll,
    countAll: mocks.countAll,
    findById: mocks.findById,
    updateById: mocks.updateById,
    deleteById: mocks.deleteById,
    findByUserId: mocks.findByUserId,
    findByCurrentVehicleId: mocks.findByCurrentVehicleId,
    findVehicleIdsByWarehouseId: mocks.findVehicleIdsByWarehouseId,
    findIdsByWarehouseId: mocks.findIdsByWarehouseId,
    countActiveByWarehouseId: mocks.countActiveByWarehouseId,
    renewLicense: mocks.renewLicense,
  },
}));

vi.mock("../../../src/utils/generateCode.js", () => ({
  default: mocks.generateCode,
}));

import {
  DRIVER_MESSAGES,
  USER_MESSAGES,
  WAREHOUSE_MESSAGES,
} from "../../../src/constants/messages.js";
import ROLES from "../../../src/constants/roles.js";
import USER_STATUSES from "../../../src/constants/userStatuses.js";
import driverService from "../../../src/modules/driver/driver.service.js";

const driverId = "driver-1";
const warehouseId = "warehouse-1";
const validExpiryDate = "2035-01-01T00:00:00.000Z";

const validCreatePayload = {
  userId: "user-1",
  warehouseId,
  idCardNumber: "012345678901",
  dateOfBirth: "1990-01-01",
  gender: "female",
  address: "123 Main Street",
  licenseNumber: "LIC-123456",
  licenseType: "B",
  licenseExpiryDate: validExpiryDate,
};

const existingDriver = {
  _id: driverId,
  userId: "user-1",
  warehouseId,
  currentVehicleId: null,
  status: "active",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUserById.mockResolvedValue({ role: ROLES.DRIVER });
  mocks.getWarehouseById.mockResolvedValue({ _id: warehouseId });
  mocks.checkIdentityConflict.mockResolvedValue(null);
  mocks.findByCode.mockResolvedValue(null);
  mocks.generateCode.mockReturnValue("DR-0001");
  mocks.create.mockResolvedValue({ _id: driverId, driverCode: "DR-0001" });
  mocks.findById.mockResolvedValue(existingDriver);
  mocks.findAll.mockResolvedValue([]);
  mocks.countAll.mockResolvedValue(0);
  mocks.countActiveTripsByDriverId.mockResolvedValue(0);
});

describe("driverService.create", () => {
  it("creates a driver profile with a unique generated code", async () => {
    const session = { id: "transaction" };
    const createdDriver = await driverService.create(
      validCreatePayload,
      session,
    );

    expect(createdDriver).toEqual({ _id: driverId, driverCode: "DR-0001" });
    expect(mocks.getUserById).toHaveBeenCalledWith("user-1", session);
    expect(mocks.getWarehouseById).toHaveBeenCalledWith(
      warehouseId,
      true,
      true,
    );
    expect(mocks.checkIdentityConflict).toHaveBeenCalledWith(
      {
        userId: "user-1",
        idCardNumber: "012345678901",
        licenseNumber: "LIC-123456",
      },
      session,
    );
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ...validCreatePayload,
        driverCode: "DR-0001",
      }),
      session,
    );
  });

  it("rejects a user whose role is not driver", async () => {
    mocks.getUserById.mockResolvedValue({ role: ROLES.CUSTOMER });

    await expect(
      driverService.create(validCreatePayload),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: USER_MESSAGES.DRIVER_ROLE_INVALID,
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects an expired license before making service calls", async () => {
    await expect(
      driverService.create({
        ...validCreatePayload,
        licenseExpiryDate: "2020-01-01",
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: DRIVER_MESSAGES.EXPIRY_MUST_BE_FUTURE,
    });
    expect(mocks.getUserById).not.toHaveBeenCalled();
  });

  it("rejects duplicate identity data", async () => {
    mocks.checkIdentityConflict.mockResolvedValue({
      userId: "another-user",
      idCardNumber: validCreatePayload.idCardNumber,
      licenseNumber: "OTHER-LICENSE",
    });

    await expect(
      driverService.create(validCreatePayload),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: DRIVER_MESSAGES.ID_CARD_EXISTS,
    });
    expect(mocks.findByCode).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("fails when a unique driver code cannot be generated after five attempts", async () => {
    mocks.findByCode.mockResolvedValue({ _id: "existing-driver" });

    await expect(
      driverService.create(validCreatePayload),
    ).rejects.toMatchObject({
      statusCode: 500,
      message: DRIVER_MESSAGES.CODE_GEN_FAILED,
    });
    expect(mocks.findByCode).toHaveBeenCalledTimes(5);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

describe("driverService.getAll", () => {
  it("paginates driver results and restricts dispatchers to their warehouse", async () => {
    const drivers = [{ _id: driverId }];
    mocks.findAll.mockResolvedValue(drivers);
    mocks.countAll.mockResolvedValue(21);

    await expect(
      driverService.getAll({
        filter: { status: "active" },
        page: 2,
        limit: 10,
        user: { role: ROLES.DISPATCHER, warehouseId },
      }),
    ).resolves.toEqual({
      data: drivers,
      pagination: { page: 2, limit: 10, totalDrivers: 21, totalPages: 3 },
    });
    expect(mocks.findAll).toHaveBeenCalledWith({
      filter: { status: "active", warehouseId },
      skip: 10,
      limit: 10,
    });
    expect(mocks.countAll).toHaveBeenCalledWith({
      status: "active",
      warehouseId,
    });
  });

  it("rejects a dispatcher without an assigned warehouse", async () => {
    await expect(
      driverService.getAll({ user: { role: ROLES.DISPATCHER } }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: WAREHOUSE_MESSAGES.DISPATCHER_NOT_ASSIGNED,
    });
    expect(mocks.findAll).not.toHaveBeenCalled();
  });
});

describe("driverService.getById and updateById", () => {
  it("returns not found when the driver does not exist", async () => {
    mocks.findById.mockResolvedValue(null);

    await expect(driverService.getById(driverId)).rejects.toMatchObject({
      statusCode: 404,
      message: DRIVER_MESSAGES.NOT_FOUND,
    });
  });

  it("blocks deactivation while the driver has active trips", async () => {
    mocks.countActiveTripsByDriverId.mockResolvedValue(1);

    await expect(
      driverService.updateById(driverId, { status: "inactive" }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: DRIVER_MESSAGES.CANNOT_DEACTIVATE_ACTIVE_TRIPS,
    });
    expect(mocks.updateById).not.toHaveBeenCalled();
  });

  it("blocks assigning a vehicle from another warehouse", async () => {
    mocks.getVehicleById.mockResolvedValue({
      warehouseId: "another-warehouse",
      status: "active",
      plateNumber: "ABC-123",
    });

    await expect(
      driverService.updateById(driverId, { currentVehicleId: "vehicle-1" }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: WAREHOUSE_MESSAGES.ACCESS_DENIED,
    });
    expect(mocks.assignVehicleToWarehouse).not.toHaveBeenCalled();
    expect(mocks.updateById).not.toHaveBeenCalled();
  });

  it("updates driver data when there are no active trips to prevent the change", async () => {
    const update = { address: "Updated address" };
    mocks.updateById.mockResolvedValue({ ...existingDriver, ...update });

    await expect(driverService.updateById(driverId, update)).resolves.toEqual({
      ...existingDriver,
      ...update,
    });
    expect(mocks.updateById).toHaveBeenCalledWith(driverId, update, null);
    expect(mocks.countActiveTripsByDriverId).not.toHaveBeenCalled();
  });
});

describe("driverService.deleteById and renewLicense", () => {
  it("blocks deleting a driver with active trips", async () => {
    mocks.countActiveTripsByDriverId.mockResolvedValue(1);

    await expect(driverService.deleteById(driverId)).rejects.toMatchObject({
      statusCode: 400,
      message: DRIVER_MESSAGES.CANNOT_DEACTIVATE_ACTIVE_TRIPS,
    });
    expect(mocks.deleteById).not.toHaveBeenCalled();
  });

  it("rejects renewing a license with a past expiry date", async () => {
    await expect(
      driverService.renewLicense(driverId, "2020-01-01"),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: DRIVER_MESSAGES.EXPIRY_MUST_BE_FUTURE,
    });
    expect(mocks.renewLicense).not.toHaveBeenCalled();
  });

  it("renews the license using a Date value", async () => {
    const renewedDriver = {
      ...existingDriver,
      licenseExpiryDate: new Date(validExpiryDate),
    };
    mocks.renewLicense.mockResolvedValue(renewedDriver);

    await expect(
      driverService.renewLicense(driverId, validExpiryDate),
    ).resolves.toEqual(renewedDriver);
    expect(mocks.renewLicense).toHaveBeenCalledWith(
      driverId,
      new Date(validExpiryDate),
    );
  });
});
