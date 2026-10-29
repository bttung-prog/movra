import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createType: vi.fn(),
  findActiveTypes: vi.fn(),
  countActiveTypes: vi.fn(),
  findTypeById: vi.fn(),
  findTypeByName: vi.fn(),
  updateType: vi.fn(),
  create: vi.fn(),
  findAll: vi.fn(),
  countAll: vi.fn(),
  findIds: vi.fn(),
  findById: vi.fn(),
  findByPlateNumber: vi.fn(),
  updateById: vi.fn(),
  setWarehouseIdIfUnassigned: vi.fn(),
  countOpenUsageLogsByVehicleId: vi.fn(),
  getVehicleIdsByWarehouseId: vi.fn(),
  getByCurrentVehicleId: vi.fn(),
  getByUserId: vi.fn(),
  getDriverById: vi.fn(),
  getDriverIdsByWarehouseId: vi.fn(),
  countTrips: vi.fn(),
  getTripIdsByWarehouseId: vi.fn(),
  getTripById: vi.fn(),
  getWarehouseById: vi.fn(),
}));

vi.mock("../../../src/modules/vehicle/vehicle.repository.js", () => ({
  default: {
    createType: mocks.createType,
    findActiveTypes: mocks.findActiveTypes,
    countActiveTypes: mocks.countActiveTypes,
    findTypeById: mocks.findTypeById,
    findTypeByName: mocks.findTypeByName,
    updateType: mocks.updateType,
    create: mocks.create,
    findAll: mocks.findAll,
    countAll: mocks.countAll,
    findIds: mocks.findIds,
    findById: mocks.findById,
    findByPlateNumber: mocks.findByPlateNumber,
    updateById: mocks.updateById,
    setWarehouseIdIfUnassigned: mocks.setWarehouseIdIfUnassigned,
    countOpenUsageLogsByVehicleId: mocks.countOpenUsageLogsByVehicleId,
  },
}));

vi.mock("../../../src/modules/driver/driver.service.js", () => ({
  default: {
    getVehicleIdsByWarehouseId: mocks.getVehicleIdsByWarehouseId,
    getByCurrentVehicleId: mocks.getByCurrentVehicleId,
    getByUserId: mocks.getByUserId,
    getById: mocks.getDriverById,
    getIdsByWarehouseId: mocks.getDriverIdsByWarehouseId,
  },
}));

vi.mock("../../../src/modules/trip/trip.service.js", () => ({
  default: {
    countAll: mocks.countTrips,
    getIdsByWarehouseId: mocks.getTripIdsByWarehouseId,
    getById: mocks.getTripById,
  },
}));

vi.mock("../../../src/modules/warehouse/warehouse.service.js", () => ({
  default: { getById: mocks.getWarehouseById },
}));

import {
  VEHICLE_MESSAGES,
  WAREHOUSE_MESSAGES,
} from "../../../src/constants/messages.js";
import ROLES from "../../../src/constants/roles.js";
import vehicleService from "../../../src/modules/vehicle/vehicle.service.js";

const vehicleId = "vehicle-1";
const vehicleTypeId = "type-1";
const warehouseId = "warehouse-1";

const existingVehicle = {
  _id: vehicleId,
  plateNumber: "51A-123.45",
  vehicleTypeId,
  warehouseId: null,
  currentOdometer: 1000,
  status: "available",
};

const validVehiclePayload = {
  plateNumber: "51A-123.45",
  vehicleTypeId,
  brand: "Toyota",
  model: "Hilux",
  yearManufactured: 2022,
  capacityWeight: 1000,
  capacityVolume: 10,
  registrationExpiryDate: "2035-01-01",
  insuranceExpiryDate: "2035-01-01",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findTypeById.mockResolvedValue({ _id: vehicleTypeId, deletedAt: null });
  mocks.findTypeByName.mockResolvedValue(null);
  mocks.findByPlateNumber.mockResolvedValue(null);
  mocks.findById.mockResolvedValue(existingVehicle);
  mocks.create.mockResolvedValue({ _id: vehicleId });
  mocks.createType.mockResolvedValue({ _id: vehicleTypeId });
  mocks.findActiveTypes.mockResolvedValue([]);
  mocks.countActiveTypes.mockResolvedValue(0);
  mocks.findAll.mockResolvedValue([]);
  mocks.countAll.mockResolvedValue(0);
  mocks.updateById.mockResolvedValue(existingVehicle);
  mocks.getVehicleIdsByWarehouseId.mockResolvedValue([]);
  mocks.getByCurrentVehicleId.mockResolvedValue(null);
  mocks.countOpenUsageLogsByVehicleId.mockResolvedValue(0);
});

describe("vehicleService vehicle types", () => {
  it("creates a vehicle type when its name is not in use", async () => {
    const payload = {
      name: "Truck",
      description: "Cargo truck",
      maxWeight: 1000,
      maxVolume: 15,
    };

    const result = await vehicleService.createType(payload);

    expect(result).toEqual({ _id: vehicleTypeId });
    expect(mocks.createType).toHaveBeenCalledWith(payload);
  });

  it("rejects an active vehicle type with a duplicate name", async () => {
    mocks.findTypeByName.mockResolvedValue({
      _id: vehicleTypeId,
      deletedAt: null,
    });

    await expect(
      vehicleService.createType({
        name: "Truck",
        description: "Cargo truck",
        maxWeight: 1000,
        maxVolume: 15,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: VEHICLE_MESSAGES.TYPE_EXISTS,
    });
    expect(mocks.createType).not.toHaveBeenCalled();
  });

  it("reactivates a deleted vehicle type with the requested values", async () => {
    mocks.findTypeByName.mockResolvedValue({
      _id: vehicleTypeId,
      deletedAt: new Date("2024-01-01"),
    });
    mocks.updateType.mockResolvedValue({ _id: vehicleTypeId, deletedAt: null });

    const result = await vehicleService.createType({
      name: "Truck",
      description: "Updated description",
      maxWeight: 1200,
      maxVolume: 18,
    });

    expect(mocks.updateType).toHaveBeenCalledWith(vehicleTypeId, {
      description: "Updated description",
      maxWeight: 1200,
      maxVolume: 18,
      deletedAt: null,
    });
    expect(result.deletedAt).toBeNull();
    expect(mocks.createType).not.toHaveBeenCalled();
  });

  it("paginates active types and calculates total pages", async () => {
    mocks.findActiveTypes.mockResolvedValue([{ _id: vehicleTypeId }]);
    mocks.countActiveTypes.mockResolvedValue(21);

    const result = await vehicleService.getActiveTypes({ page: 2, limit: 10 });

    expect(mocks.findActiveTypes).toHaveBeenCalledWith({ skip: 10, limit: 10 });
    expect(result).toEqual({
      data: [{ _id: vehicleTypeId }],
      pagination: { page: 2, limit: 10, total: 21, totalPages: 3 },
    });
  });
});

describe("vehicleService.create", () => {
  it("creates a vehicle after checking its type and optional warehouse", async () => {
    mocks.create.mockResolvedValue({ _id: vehicleId });

    const result = await vehicleService.create({
      ...validVehiclePayload,
      warehouseId,
    });

    expect(result).toEqual({ _id: vehicleId });
    expect(mocks.getWarehouseById).toHaveBeenCalledWith(
      warehouseId,
      true,
      true,
    );
    expect(mocks.create).toHaveBeenCalledWith({
      ...validVehiclePayload,
      warehouseId,
    });
  });

  it("rejects duplicate plate numbers before creating a vehicle", async () => {
    mocks.findByPlateNumber.mockResolvedValue(existingVehicle);

    await expect(
      vehicleService.create(validVehiclePayload),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: VEHICLE_MESSAGES.PLATE_EXISTS,
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects a missing vehicle type", async () => {
    mocks.findTypeById.mockResolvedValue(null);

    await expect(
      vehicleService.create(validVehiclePayload),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: VEHICLE_MESSAGES.TYPE_NOT_FOUND,
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

describe("vehicleService vehicle access and updates", () => {
  it("returns paginated vehicles using the provided filter", async () => {
    const filter = { status: "available" };
    mocks.findAll.mockResolvedValue([existingVehicle]);
    mocks.countAll.mockResolvedValue(11);

    const result = await vehicleService.getAll({ filter, page: 2, limit: 5 });

    expect(mocks.findAll).toHaveBeenCalledWith({ filter, skip: 5, limit: 5 });
    expect(mocks.countAll).toHaveBeenCalledWith(filter);
    expect(result.pagination).toEqual({
      page: 2,
      limit: 5,
      total: 11,
      totalPages: 3,
    });
  });

  it("limits a dispatcher to vehicles in or assigned to their warehouse", async () => {
    const assignedVehicleIds = ["assigned-vehicle"];
    const user = { role: ROLES.DISPATCHER, warehouseId };
    mocks.getVehicleIdsByWarehouseId.mockResolvedValue(assignedVehicleIds);

    await vehicleService.getAll({ user });

    expect(mocks.findAll).toHaveBeenCalledWith({
      filter: {
        $and: [
          {
            $or: [
              { warehouseId },
              { _id: { $in: assignedVehicleIds }, warehouseId: null },
            ],
          },
        ],
      },
      skip: 0,
      limit: 10,
    });
  });

  it("rejects a dispatcher without a warehouse", async () => {
    await expect(
      vehicleService.getAll({ user: { role: ROLES.DISPATCHER } }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: WAREHOUSE_MESSAGES.DISPATCHER_NOT_ASSIGNED,
    });
    expect(mocks.findAll).not.toHaveBeenCalled();
  });

  it("rejects lookup of an unknown vehicle", async () => {
    mocks.findById.mockResolvedValue(null);

    await expect(vehicleService.getById(vehicleId)).rejects.toMatchObject({
      statusCode: 404,
      message: VEHICLE_MESSAGES.NOT_FOUND,
    });
  });

  it("does not allow a dispatcher to access an unassigned vehicle outside their assignments", async () => {
    const user = { role: ROLES.DISPATCHER, warehouseId };

    await expect(vehicleService.getById(vehicleId, user)).rejects.toMatchObject(
      {
        statusCode: 403,
        message: WAREHOUSE_MESSAGES.ACCESS_DENIED,
      },
    );
  });

  it("rejects decreasing the odometer", async () => {
    await expect(
      vehicleService.updateOdometer(vehicleId, 999),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: VEHICLE_MESSAGES.ODO_LESS_THAN_CURRENT,
    });
    expect(mocks.updateById).not.toHaveBeenCalled();
  });

  it("updates the odometer when the new value is not lower", async () => {
    await vehicleService.updateOdometer(vehicleId, 1200);

    expect(mocks.updateById).toHaveBeenCalledWith(
      vehicleId,
      { currentOdometer: 1200 },
      null,
    );
  });

  it("does not mark a vehicle available while it has an open usage log", async () => {
    const session = {};
    mocks.countOpenUsageLogsByVehicleId.mockResolvedValue(1);

    await expect(
      vehicleService.changeStatus(vehicleId, "available", session),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: VEHICLE_MESSAGES.VEHICLE_IN_USE,
    });
    expect(mocks.updateById).not.toHaveBeenCalled();
  });

  it("updates a non-available status without opening a transaction", async () => {
    const session = {};

    await vehicleService.changeStatus(vehicleId, "maintenance", session);

    expect(mocks.updateById).toHaveBeenCalledWith(
      vehicleId,
      { status: "maintenance" },
      session,
    );
    expect(mocks.countOpenUsageLogsByVehicleId).not.toHaveBeenCalled();
  });
});
