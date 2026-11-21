import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  startSession: vi.fn(),
  getDriverById: vi.fn(),
  getDriverByUserId: vi.fn(),
  ensureLicenseIsValid: vi.fn(),
  getDriverIdsByWarehouseId: vi.fn(),
  getVehicleById: vi.fn(),
  assignVehicleToWarehouse: vi.fn(),
  getVehicleIdsByWarehouseId: vi.fn(),
  getUsageLogsByTripId: vi.fn(),
  createUsageLog: vi.fn(),
  updateUsageLogById: vi.fn(),
  changeVehicleStatus: vi.fn(),
  getRouteById: vi.fn(),
  getUserById: vi.fn(),
  countRouteMismatchesByTripId: vi.fn(),
  countOrdersByTripId: vi.fn(),
  countAllOrders: vi.fn(),
  countUnfinishedOrdersByTrip: vi.fn(),
  handleOrdersOnTripCompletion: vi.fn(),
  handleOrdersOnTripCancellation: vi.fn(),
  findByCode: vi.fn(),
  findOverlappingTrip: vi.fn(),
  lockScheduleResources: vi.fn(),
  createTrip: vi.fn(),
  findAll: vi.fn(),
  countAll: vi.fn(),
  findById: vi.fn(),
  updateById: vi.fn(),
  deleteById: vi.fn(),
  findIdsByWarehouseId: vi.fn(),
  createAuditLog: vi.fn(),
  findAuditLogsByTripId: vi.fn(),
  countAuditLogsByTripId: vi.fn(),
  getTripIdsByWarehouseId: vi.fn(),
  generateCode: vi.fn(),
}));

vi.mock("mongoose", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: { ...actual.default, startSession: mocks.startSession },
  };
});

vi.mock("../../../src/modules/driver/driver.service.js", () => ({
  default: {
    getById: mocks.getDriverById,
    getByUserId: mocks.getDriverByUserId,
    ensureLicenseIsValid: mocks.ensureLicenseIsValid,
    getIdsByWarehouseId: mocks.getDriverIdsByWarehouseId,
  },
}));

vi.mock("../../../src/modules/vehicle/vehicle.service.js", () => ({
  default: {
    getById: mocks.getVehicleById,
    assignToWarehouse: mocks.assignVehicleToWarehouse,
    getIdsByWarehouseId: mocks.getVehicleIdsByWarehouseId,
    changeStatus: mocks.changeVehicleStatus,
  },
}));

vi.mock("../../../src/modules/vehicle/vehicleUsageLog.service.js", () => ({
  default: {
    getByTripId: mocks.getUsageLogsByTripId,
    create: mocks.createUsageLog,
    updateById: mocks.updateUsageLogById,
  },
}));

vi.mock("../../../src/modules/route/route.service.js", () => ({
  default: { getById: mocks.getRouteById },
}));

vi.mock("../../../src/modules/user/user.service.js", () => ({
  default: { getById: mocks.getUserById },
}));

vi.mock("../../../src/modules/order/order.service.js", () => ({
  default: {
    countRouteMismatchesByTripId: mocks.countRouteMismatchesByTripId,
    countAll: mocks.countAllOrders,
    countByTripId: mocks.countOrdersByTripId,
    countUnfinishedOrdersByTrip: mocks.countUnfinishedOrdersByTrip,
    handleOrdersOnTripCompletion: mocks.handleOrdersOnTripCompletion,
    handleOrdersOnTripCancellation: mocks.handleOrdersOnTripCancellation,
  },
}));

vi.mock("../../../src/modules/trip/trip.repository.js", () => ({
  default: {
    findByCode: mocks.findByCode,
    findOverlappingTrip: mocks.findOverlappingTrip,
    lockScheduleResources: mocks.lockScheduleResources,
    create: mocks.createTrip,
    findAll: mocks.findAll,
    countAll: mocks.countAll,
    findById: mocks.findById,
    updateById: mocks.updateById,
    deleteById: mocks.deleteById,
    findIdsByWarehouseId: mocks.findIdsByWarehouseId,
    getIdsByWarehouseId: mocks.getTripIdsByWarehouseId,
  },
}));

vi.mock("../../../src/modules/trip/tripAuditLog.repository.js", () => ({
  default: {
    create: mocks.createAuditLog,
    findByTripId: mocks.findAuditLogsByTripId,
    countByTripId: mocks.countAuditLogsByTripId,
  },
}));

vi.mock("../../../src/utils/generateCode.js", () => ({
  generateCode: mocks.generateCode,
}));

import { TRIP_MESSAGES } from "../../../src/constants/messages.js";
import { COMMON_MESSAGES } from "../../../src/constants/messages.js";
import { ROLES } from "../../../src/constants/roles.js";
import tripService from "../../../src/modules/trip/trip.service.js";

const warehouseId = "warehouse-1";
const driverId = "driver-1";
const vehicleId = "vehicle-1";
const routeId = "route-1";
const validStart = "2030-04-01T08:00:00.000Z";
const validEnd = "2030-04-01T12:00:00.000Z";

const transaction = {
  startTransaction: vi.fn(),
  commitTransaction: vi.fn().mockResolvedValue(undefined),
  abortTransaction: vi.fn().mockResolvedValue(undefined),
  endSession: vi.fn(),
  withTransaction: vi.fn().mockImplementation((cb) => cb()),
};

const plannedTrip = {
  _id: "trip-1",
  tripCode: "TRIP-0001",
  status: "planned",
  deletedAt: null,
  driverId,
  vehicleId,
  routeId,
  warehouseId,
  plannedStart: new Date(validStart),
  plannedEnd: new Date(validEnd),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.startSession.mockResolvedValue(transaction);
  mocks.getDriverById.mockResolvedValue({
    _id: driverId,
    status: "active",
    licenseExpiryDate: new Date("2035-01-01T00:00:00.000Z"),
    warehouseId,
    userId: "user-1",
  });
  mocks.getDriverByUserId.mockResolvedValue({ _id: driverId });
  mocks.getVehicleById.mockResolvedValue({
    _id: vehicleId,
    status: "available",
    warehouseId,
    currentOdometer: 100,
  });
  mocks.getRouteById.mockResolvedValue({ originWarehouseId: warehouseId });
  mocks.ensureLicenseIsValid.mockReturnValue(undefined);
  mocks.findByCode.mockResolvedValue(null);
  mocks.generateCode.mockReturnValue("TRIP-0001");
  mocks.findOverlappingTrip.mockResolvedValue(null);
  mocks.lockScheduleResources.mockResolvedValue(true);
  mocks.createTrip.mockResolvedValue({ ...plannedTrip, tripCode: "TRIP-0001" });
  mocks.findAll.mockResolvedValue([]);
  mocks.countAll.mockResolvedValue(0);
  mocks.countRouteMismatchesByTripId.mockResolvedValue(0);
  mocks.countAllOrders.mockResolvedValue(0);
  mocks.countUnfinishedOrdersByTrip.mockResolvedValue(0);
  mocks.handleOrdersOnTripCompletion.mockResolvedValue();
  mocks.handleOrdersOnTripCancellation.mockResolvedValue();
  mocks.findById.mockResolvedValue(plannedTrip);
  mocks.updateById.mockResolvedValue(plannedTrip);
  mocks.createAuditLog.mockResolvedValue({ _id: "audit-1" });
  mocks.findAuditLogsByTripId.mockResolvedValue([]);
  mocks.countAuditLogsByTripId.mockResolvedValue(0);
  mocks.getUsageLogsByTripId.mockResolvedValue([]);
  mocks.createUsageLog.mockResolvedValue({ _id: "usage-1" });
});

describe("tripService.create", () => {
  const createPayload = {
    vehicleId,
    driverId,
    routeId,
    plannedStart: validStart,
    plannedEnd: validEnd,
  };

  it("rejects an inactive driver", async () => {
    mocks.getDriverById.mockResolvedValue({
      _id: driverId,
      status: "inactive",
      warehouseId,
    });

    await expect(tripService.create(createPayload)).rejects.toMatchObject({
      statusCode: 400,
      message: TRIP_MESSAGES.DRIVER_NOT_ACTIVE,
    });
    expect(mocks.startSession).not.toHaveBeenCalled();
  });

  it("rejects when the route origin is not the driver's warehouse", async () => {
    mocks.getRouteById.mockResolvedValue({ originWarehouseId: "warehouse-2" });

    await expect(tripService.create(createPayload)).rejects.toMatchObject({
      statusCode: 400,
      message: TRIP_MESSAGES.ROUTE_ORIGIN_WAREHOUSE_MISMATCH,
    });
    expect(mocks.startSession).not.toHaveBeenCalled();
  });

  it("rejects a vehicle that is in maintenance", async () => {
    mocks.getVehicleById.mockResolvedValue({
      status: "maintenance",
      warehouseId,
    });

    await expect(tripService.create(createPayload)).rejects.toMatchObject({
      statusCode: 400,
      message: TRIP_MESSAGES.VEHICLE_STATUS_INVALID("maintenance"),
    });
  });

  it("rejects when a driver is not assigned to the requested warehouse", async () => {
    await expect(
      tripService.create({
        ...createPayload,
        user: {
          role: ROLES.DISPATCHER,
          warehouseId: "warehouse-2",
        },
      }),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(mocks.startSession).not.toHaveBeenCalled();
  });

  it("allows creating a delivery trip without a routeId", async () => {
    mocks.createTrip.mockResolvedValue({
      ...plannedTrip,
      type: "delivery",
      routeId: null,
    });

    const result = await tripService.create({
      ...createPayload,
      type: "delivery",
      routeId: null,
    });

    expect(mocks.getRouteById).not.toHaveBeenCalled();
    expect(result.routeId).toBeNull();
  });

  it("requires routeId when creating a transfer trip", async () => {
    await expect(
      tripService.create({
        ...createPayload,
        type: "transfer",
        routeId: null,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: TRIP_MESSAGES.ROUTE_REQUIRED,
    });
    expect(mocks.startSession).not.toHaveBeenCalled();
  });
});

describe("tripService.getAll and getById", () => {
  it("paginates the trip list and excludes deleted trips", async () => {
    mocks.findAll.mockResolvedValue([plannedTrip]);
    mocks.countAll.mockResolvedValue(21);

    await expect(
      tripService.getAll({ filter: { status: "planned" }, page: 2, limit: 10 }),
    ).resolves.toEqual({
      data: [plannedTrip],
      pagination: { page: 2, limit: 10, total: 21, totalPages: 3 },
    });
    expect(mocks.findAll).toHaveBeenCalledWith({
      filter: { deletedAt: null, status: "planned" },
      skip: 10,
      limit: 10,
      sort: { createdAt: -1 },
    });
  });

  it("scopes a driver's trip list to their driver profile", async () => {
    await tripService.getAll({
      user: { role: ROLES.DRIVER, _id: "user-1" },
    });

    expect(mocks.getDriverByUserId).toHaveBeenCalledWith("user-1");
    expect(mocks.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: { $and: [{ deletedAt: null }, { driverId }] },
      }),
    );
  });

  it("rejects when a driver tries to read another driver's trip", async () => {
    mocks.findById.mockResolvedValue(plannedTrip);
    mocks.getDriverByUserId.mockResolvedValue({ _id: "another-driver" });

    await expect(
      tripService.getById("trip-1", true, {
        role: ROLES.DRIVER,
        _id: "user-2",
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: TRIP_MESSAGES.NOT_ASSIGNED_DRIVER,
    });
  });

  it("rejects missing trips and trips that are deleted by default", async () => {
    mocks.findById.mockResolvedValue(null);
    await expect(tripService.getById("missing")).rejects.toMatchObject({
      statusCode: 404,
      message: TRIP_MESSAGES.NOT_FOUND,
    });

    mocks.findById.mockResolvedValue({
      ...plannedTrip,
      deletedAt: new Date(),
    });
    await expect(tripService.getById("trip-1")).rejects.toMatchObject({
      statusCode: 400,
      message: TRIP_MESSAGES.ALREADY_DELETED,
    });
  });
});

describe("tripService.updateById", () => {
  it("does not allow changing a trip type while orders are assigned", async () => {
    mocks.countAllOrders.mockResolvedValue(1);

    await expect(
      tripService.updateById("trip-1", { type: "pickup" }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: TRIP_MESSAGES.TRIP_TYPE_HAS_ORDERS,
    });

    expect(mocks.updateById).not.toHaveBeenCalled();
  });
});

describe("tripService.updateById and deleteById", () => {
  it("prevents clients from changing the system-managed total order count", async () => {
    await expect(
      tripService.updateById("trip-1", { totalOrder: 99 }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: TRIP_MESSAGES.TOTAL_ORDER_SYSTEM_MANAGED,
    });
    expect(mocks.updateById).not.toHaveBeenCalled();
  });

  it("requires the reassignment operation to change a driver or vehicle", async () => {
    await expect(
      tripService.updateById("trip-1", { driverId: "driver-2" }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: TRIP_MESSAGES.REASSIGN_ENDPOINT_REQUIRED,
    });
    expect(mocks.updateById).not.toHaveBeenCalled();
  });

  it("rejects an invalid schedule update", async () => {
    await expect(
      tripService.updateById("trip-1", { plannedEnd: validStart }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: TRIP_MESSAGES.START_BEFORE_END,
    });
    expect(mocks.updateById).not.toHaveBeenCalled();
  });

  it("does not delete a trip that still has active orders", async () => {
    mocks.countAllOrders.mockResolvedValue(2);

    await expect(tripService.deleteById("trip-1")).rejects.toMatchObject({
      statusCode: 400,
      message: TRIP_MESSAGES.CANNOT_DELETE_ACTIVE_ORDERS(2),
    });
    expect(mocks.deleteById).not.toHaveBeenCalled();
  });

  it("does not delete an in-progress trip", async () => {
    mocks.findById.mockResolvedValue({ ...plannedTrip, status: "in_progress" });

    await expect(tripService.deleteById("trip-1")).rejects.toMatchObject({
      statusCode: 400,
      message: TRIP_MESSAGES.CANNOT_DELETE_IN_PROGRESS,
    });
    expect(mocks.countAllOrders).not.toHaveBeenCalled();
  });
});
