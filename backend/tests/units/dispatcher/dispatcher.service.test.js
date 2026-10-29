import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findAll: vi.fn(),
  countAll: vi.fn(),
  countActiveByWarehouseId: vi.fn(),
  findById: vi.fn(),
  findByUserId: vi.fn(),
  findByCode: vi.fn(),
  updateById: vi.fn(),
  getUserById: vi.fn(),
  getWarehouseById: vi.fn(),
  getDriverIdsByWarehouseId: vi.fn(),
  getDriverById: vi.fn(),
  getDriverByUserId: vi.fn(),
  getDriverAll: vi.fn(),
  getVehicleAll: vi.fn(),
  getTripCountAll: vi.fn(),
  getTripById: vi.fn(),
  getOrderCountAll: vi.fn(),
  generateCode: vi.fn(),
}));

vi.mock("../../../src/modules/dispatcher/dispatcher.repository.js", () => ({
  default: {
    create: mocks.create,
    findAll: mocks.findAll,
    countAll: mocks.countAll,
    countActiveByWarehouseId: mocks.countActiveByWarehouseId,
    findById: mocks.findById,
    findByUserId: mocks.findByUserId,
    findByCode: mocks.findByCode,
    updateById: mocks.updateById,
  },
}));

vi.mock("../../../src/modules/user/user.service.js", () => ({
  default: { getById: mocks.getUserById },
}));

vi.mock("../../../src/modules/warehouse/warehouse.service.js", () => ({
  default: { getById: mocks.getWarehouseById },
}));

vi.mock("../../../src/modules/driver/driver.service.js", () => ({
  default: {
    getIdsByWarehouseId: mocks.getDriverIdsByWarehouseId,
    getById: mocks.getDriverById,
    getByUserId: mocks.getDriverByUserId,
    getAll: mocks.getDriverAll,
  },
}));

vi.mock("../../../src/modules/vehicle/vehicle.service.js", () => ({
  default: { getAll: mocks.getVehicleAll },
}));

vi.mock("../../../src/modules/trip/trip.service.js", () => ({
  default: {
    countAll: mocks.getTripCountAll,
    getById: mocks.getTripById,
  },
}));

vi.mock("../../../src/modules/order/order.service.js", () => ({
  default: { countAll: mocks.getOrderCountAll },
}));

vi.mock("../../../src/utils/generateCode.js", () => ({
  default: mocks.generateCode,
}));

import {
  DISPATCHER_MESSAGES,
  USER_MESSAGES,
} from "../../../src/constants/messages.js";
import ROLES from "../../../src/constants/roles.js";
import USER_STATUSES from "../../../src/constants/userStatuses.js";
import dispatcherService from "../../../src/modules/dispatcher/dispatcher.service.js";

const dispatcherId = "dispatcher-1";
const userId = "user-1";
const warehouseId = "warehouse-1";
const dispatcher = {
  _id: dispatcherId,
  userId,
  warehouseId,
  dispatcherCode: "DIS-0001",
  status: "active",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUserById.mockResolvedValue({
    _id: userId,
    role: ROLES.DISPATCHER,
    status: USER_STATUSES.ACTIVE,
  });
  mocks.getWarehouseById.mockResolvedValue({ _id: warehouseId });
  mocks.findByUserId.mockResolvedValue(null);
  mocks.findByCode.mockResolvedValue(null);
  mocks.generateCode.mockReturnValue("DIS-0001");
  mocks.create.mockResolvedValue(dispatcher);
  mocks.findAll.mockResolvedValue([dispatcher]);
  mocks.countAll.mockResolvedValue(21);
  mocks.findById.mockResolvedValue(dispatcher);
  mocks.updateById.mockResolvedValue(dispatcher);
  mocks.getDriverAll.mockResolvedValue({
    data: [],
    pagination: { totalDrivers: 0 },
  });
  mocks.getVehicleAll.mockResolvedValue({
    data: [],
    pagination: { total: 0 },
  });
  mocks.getTripCountAll.mockResolvedValue(0);
  mocks.getOrderCountAll.mockResolvedValue(0);
});

describe("dispatcherService.create", () => {
  it("validates the user and warehouse and creates a unique dispatcher code", async () => {
    const session = { id: "session-1" };
    await dispatcherService.create({ userId, warehouseId }, session);

    expect(mocks.getUserById).toHaveBeenCalledWith(userId, session);
    expect(mocks.getWarehouseById).toHaveBeenCalledWith(
      warehouseId,
      true,
      true,
    );
    expect(mocks.findByUserId).toHaveBeenCalledWith(userId, session);
    expect(mocks.findByCode).toHaveBeenCalledWith("DIS-0001");
    expect(mocks.create).toHaveBeenCalledWith(
      { userId, warehouseId, dispatcherCode: "DIS-0001" },
      session,
    );
  });

  it("rejects users with the wrong role or inactive status", async () => {
    mocks.getUserById.mockResolvedValueOnce({
      role: ROLES.ADMIN,
      status: USER_STATUSES.ACTIVE,
    });
    await expect(
      dispatcherService.create({ userId, warehouseId }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: USER_MESSAGES.DISPATCHER_ROLE_INVALID,
    });

    mocks.getUserById.mockResolvedValueOnce({
      role: ROLES.DISPATCHER,
      status: USER_STATUSES.INACTIVE,
    });
    await expect(
      dispatcherService.create({ userId, warehouseId }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: USER_MESSAGES.DISPATCHER_USER_NOT_ACTIVE,
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects duplicate user profiles and maps duplicate key conflicts", async () => {
    mocks.findByUserId.mockResolvedValueOnce(dispatcher);
    await expect(
      dispatcherService.create({ userId, warehouseId }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: DISPATCHER_MESSAGES.ALREADY_EXISTS,
    });

    mocks.create.mockRejectedValueOnce({
      code: 11000,
      keyPattern: { dispatcherCode: 1 },
    });
    await expect(
      dispatcherService.create({ userId, warehouseId }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: DISPATCHER_MESSAGES.CODE_ALREADY_EXISTS,
    });
  });
});

describe("dispatcherService.getAll", () => {
  it("searches dispatcher codes with an escaped regex and returns pagination", async () => {
    const result = await dispatcherService.getAll({
      filter: { status: "active" },
      page: 2,
      limit: 5,
      search: "  DIS+1 ",
    });

    const filter = {
      status: "active",
      dispatcherCode: { $regex: "DIS\\+1", $options: "i" },
    };
    expect(mocks.findAll).toHaveBeenCalledWith({
      filter,
      skip: 5,
      limit: 5,
    });
    expect(mocks.countAll).toHaveBeenCalledWith(filter);
    expect(result).toEqual({
      data: [dispatcher],
      pagination: { page: 2, limit: 5, total: 21, totalPages: 5 },
    });
  });
});

describe("dispatcherService profile lookups and updates", () => {
  it("returns dispatcher records and reports missing profiles", async () => {
    mocks.findByUserId.mockResolvedValue(dispatcher);
    mocks.findByCode.mockResolvedValue(dispatcher);

    await expect(dispatcherService.getById(dispatcherId)).resolves.toBe(
      dispatcher,
    );
    await expect(dispatcherService.getByUserId(userId)).resolves.toBe(
      dispatcher,
    );
    await expect(dispatcherService.getByCode("DIS-0001")).resolves.toBe(
      dispatcher,
    );

    mocks.findById.mockResolvedValueOnce(null);
    await expect(dispatcherService.getById(dispatcherId)).rejects.toMatchObject(
      {
        statusCode: 404,
        message: DISPATCHER_MESSAGES.NOT_FOUND,
      },
    );
  });

  it("validates dispatcher user and warehouse before activation", async () => {
    await dispatcherService.updateStatus(dispatcherId, "active");

    expect(mocks.getUserById).toHaveBeenCalledWith(userId, null);
    expect(mocks.getWarehouseById).toHaveBeenCalledWith(
      warehouseId,
      true,
      true,
    );
    expect(mocks.updateById).toHaveBeenCalledWith(
      dispatcherId,
      { status: "active" },
      null,
    );
  });

  it("deactivates, restores, and transfers dispatcher profiles", async () => {
    await dispatcherService.deleteById(dispatcherId);
    expect(mocks.updateById).toHaveBeenCalledWith(
      dispatcherId,
      { status: "inactive" },
      null,
    );

    await dispatcherService.transferWarehouse(dispatcherId, "warehouse-2");
    expect(mocks.getWarehouseById).toHaveBeenCalledWith(
      "warehouse-2",
      true,
      true,
    );
    expect(mocks.updateById).toHaveBeenLastCalledWith(
      dispatcherId,
      { warehouseId: "warehouse-2" },
      null,
    );
  });
});

describe("dispatcherService dispatcher dashboard and resources", () => {
  it("aggregates counts into dashboard stats and scopes dependent service calls", async () => {
    const user = { userId, role: ROLES.DISPATCHER, warehouseId };
    mocks.findByUserId.mockResolvedValue(dispatcher);
    mocks.getDriverAll
      .mockResolvedValueOnce({ pagination: { totalDrivers: 20 } })
      .mockResolvedValueOnce({ pagination: { totalDrivers: 12 } });
    mocks.getVehicleAll.mockResolvedValueOnce({ pagination: { total: 8 } });
    mocks.getTripCountAll.mockResolvedValueOnce(3).mockResolvedValueOnce(4);
    mocks.getOrderCountAll.mockResolvedValueOnce(5);

    const result = await dispatcherService.getDashboardStats(userId, user);

    expect(result).toEqual({
      dispatcher: {
        _id: dispatcherId,
        dispatcherCode: "DIS-0001",
        status: "active",
        warehouse: warehouseId,
        user: userId,
      },
      stats: {
        drivers: { total: 20, active: 12 },
        vehicles: { available: 8 },
        trips: { planned: 4, inProgress: 3 },
        orders: { unassigned: 5 },
      },
    });
    expect(mocks.getDriverAll).toHaveBeenNthCalledWith(1, {
      filter: { warehouseId },
      limit: 1,
    });
    expect(mocks.getTripCountAll).toHaveBeenCalledWith({
      filter: { status: "in_progress", deletedAt: null },
      user,
    });
  });

  it("returns resource lists with pagination for drivers and vehicles", async () => {
    const drivers = [{ _id: "driver-1" }];
    const vehicles = [{ _id: "vehicle-1" }];
    const user = { role: ROLES.DISPATCHER, warehouseId };
    mocks.findByUserId.mockResolvedValue(dispatcher);
    mocks.getDriverAll.mockResolvedValueOnce({
      data: drivers,
      pagination: { totalDrivers: 1 },
    });
    mocks.getVehicleAll.mockResolvedValueOnce({
      data: vehicles,
      pagination: { total: 1 },
    });

    const result = await dispatcherService.getResources(userId, user, {
      page: 2,
      limit: 10,
    });

    expect(result).toEqual({
      drivers,
      vehicles,
      pagination: {
        drivers: { totalDrivers: 1 },
        vehicles: { total: 1 },
      },
    });
    expect(mocks.getDriverAll).toHaveBeenCalledWith({
      filter: { warehouseId, status: "active" },
      page: 2,
      limit: 10,
      user,
    });
    expect(mocks.getVehicleAll).toHaveBeenCalledWith({
      filter: { status: "available" },
      page: 2,
      limit: 10,
      user,
    });
  });

  it("rejects dashboard and resource requests without a dispatcher profile", async () => {
    mocks.findByUserId.mockResolvedValue(null);

    await expect(
      dispatcherService.getDashboardStats(userId),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: DISPATCHER_MESSAGES.NOT_FOUND,
    });
    await expect(dispatcherService.getResources(userId)).rejects.toMatchObject({
      statusCode: 404,
      message: DISPATCHER_MESSAGES.NOT_FOUND,
    });
  });
});
