import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getWarehouseById: vi.fn(),
  countTrips: vi.fn(),
  countOrders: vi.fn(),
  findByWarehousePair: vi.fn(),
  createRoute: vi.fn(),
  findAllRoutes: vi.fn(),
  countAllRoutes: vi.fn(),
  findRouteById: vi.fn(),
  updateRouteById: vi.fn(),
  deleteRouteById: vi.fn(),
  restoreRouteById: vi.fn(),
}));

vi.mock("../../../src/modules/warehouse/warehouse.service.js", () => ({
  default: { getById: mocks.getWarehouseById },
}));

vi.mock("../../../src/modules/trip/trip.service.js", () => ({
  default: { countAll: mocks.countTrips },
}));

vi.mock("../../../src/modules/order/order.service.js", () => ({
  default: { countAll: mocks.countOrders },
}));

vi.mock("../../../src/modules/route/route.repository.js", () => ({
  default: {
    findByWarehousePair: mocks.findByWarehousePair,
    create: mocks.createRoute,
    findAll: mocks.findAllRoutes,
    countAll: mocks.countAllRoutes,
    findById: mocks.findRouteById,
    updateById: mocks.updateRouteById,
    deleteById: mocks.deleteRouteById,
    restoreById: mocks.restoreRouteById,
  },
}));

import { ROUTE_MESSAGES } from "../../../src/constants/messages.js";
import routeService from "../../../src/modules/route/route.service.js";

const originWarehouseId = "507f1f77bcf86cd799439011";
const destinationWarehouseId = "507f1f77bcf86cd799439012";
const routeId = "507f1f77bcf86cd799439013";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getWarehouseById.mockImplementation(async (id) => ({
    _id: id,
    warehouseName: id === originWarehouseId ? "Warehouse A" : "Warehouse B",
  }));
  mocks.countTrips.mockResolvedValue(0);
  mocks.countOrders.mockResolvedValue(0);
});

describe("routeService.create", () => {
  it("creates a route with valid warehouse pair and values", async () => {
    mocks.findByWarehousePair.mockResolvedValue(null);
    mocks.createRoute.mockResolvedValue({
      _id: routeId,
      originWarehouseId,
      destinationWarehouseId,
      distance: 150,
      expectedDuration: 8,
      deletedAt: null,
    });

    const route = await routeService.create({
      originWarehouseId,
      destinationWarehouseId,
      distance: 150,
      expectedDuration: 8,
    });

    expect(route).toMatchObject({
      _id: routeId,
      originWarehouseId,
      destinationWarehouseId,
      distance: 150,
      expectedDuration: 8,
    });
    expect(mocks.getWarehouseById).toHaveBeenCalledTimes(2);
    expect(mocks.createRoute).toHaveBeenCalledWith({
      originWarehouseId,
      destinationWarehouseId,
      distance: 150,
      expectedDuration: 8,
    });
  });

  it("rejects identical origin and destination warehouses", async () => {
    await expect(
      routeService.create({
        originWarehouseId,
        destinationWarehouseId: originWarehouseId,
        distance: 100,
        expectedDuration: 4,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: ROUTE_MESSAGES.IDENTICAL_ORIGIN_DEST,
    });
    expect(mocks.createRoute).not.toHaveBeenCalled();
  });

  it("reuses a soft-deleted route instead of creating a duplicate", async () => {
    mocks.findByWarehousePair.mockResolvedValue({
      _id: routeId,
      deletedAt: new Date("2024-01-01"),
    });
    mocks.updateRouteById.mockResolvedValue({
      _id: routeId,
      originWarehouseId,
      destinationWarehouseId,
      distance: 120,
      expectedDuration: 6,
      deletedAt: null,
    });

    await expect(
      routeService.create({
        originWarehouseId,
        destinationWarehouseId,
        distance: 120,
        expectedDuration: 6,
      }),
    ).resolves.toMatchObject({
      _id: routeId,
      distance: 120,
      expectedDuration: 6,
    });
    expect(mocks.updateRouteById).toHaveBeenCalledWith(routeId, {
      originWarehouseId,
      destinationWarehouseId,
      distance: 120,
      expectedDuration: 6,
      deletedAt: null,
    });
  });

  it("rejects an already active route for the same warehouse pair", async () => {
    mocks.findByWarehousePair.mockResolvedValue({
      _id: "another-route",
      deletedAt: null,
    });

    await expect(
      routeService.create({
        originWarehouseId,
        destinationWarehouseId,
        distance: 100,
        expectedDuration: 5,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: ROUTE_MESSAGES.ALREADY_EXISTS("Warehouse A", "Warehouse B"),
    });
    expect(mocks.createRoute).not.toHaveBeenCalled();
  });
});

describe("routeService.getAll", () => {
  it("returns paginated route data and total pages", async () => {
    mocks.findAllRoutes.mockResolvedValue([{ _id: routeId }]);
    mocks.countAllRoutes.mockResolvedValue(30);

    const result = await routeService.getAll({
      page: 2,
      limit: 5,
      filter: { deletedAt: null },
    });

    expect(result).toMatchObject({
      data: [{ _id: routeId }],
      pagination: {
        page: 2,
        limit: 5,
        total: 30,
        totalPages: 6,
      },
    });
    expect(mocks.findAllRoutes).toHaveBeenCalledWith({
      filter: { deletedAt: null },
      skip: 5,
      limit: 5,
      sort: { createdAt: -1 },
    });
  });
});

describe("routeService.getById", () => {
  it("returns the route when it exists and is not deleted", async () => {
    mocks.findRouteById.mockResolvedValue({
      _id: routeId,
      originWarehouseId,
      destinationWarehouseId,
      deletedAt: null,
    });

    await expect(routeService.getById(routeId)).resolves.toMatchObject({
      _id: routeId,
      deletedAt: null,
    });
  });

  it("throws 404 when the route is missing", async () => {
    mocks.findRouteById.mockResolvedValue(null);

    await expect(routeService.getById(routeId)).rejects.toMatchObject({
      statusCode: 404,
      message: ROUTE_MESSAGES.NOT_FOUND,
    });
  });
});

describe("routeService.updateById", () => {
  it("updates a valid route without causing a duplicate pair", async () => {
    mocks.findRouteById.mockResolvedValue({
      _id: routeId,
      originWarehouseId,
      destinationWarehouseId,
      distance: 100,
      expectedDuration: 5,
      deletedAt: null,
    });
    mocks.findByWarehousePair.mockResolvedValue(null);
    mocks.updateRouteById.mockResolvedValue({
      _id: routeId,
      distance: 120,
      expectedDuration: 6,
    });

    const result = await routeService.updateById(routeId, {
      distance: 120,
      expectedDuration: 6,
    });

    expect(result).toMatchObject({
      _id: routeId,
      distance: 120,
      expectedDuration: 6,
    });
    expect(mocks.updateRouteById).toHaveBeenCalledWith(routeId, {
      distance: 120,
      expectedDuration: 6,
    });
  });

  it("rejects update if the new pair already belongs to a different active route", async () => {
    const newOrigin = "507f1f77bcf86cd799439014";
    const newDestination = "507f1f77bcf86cd799439015";
    mocks.findRouteById.mockResolvedValue({
      _id: routeId,
      originWarehouseId,
      destinationWarehouseId,
      deletedAt: null,
    });
    mocks.findByWarehousePair.mockResolvedValue({
      _id: "other-route",
      deletedAt: null,
    });

    await expect(
      routeService.updateById(routeId, {
        originWarehouseId: newOrigin,
        destinationWarehouseId: newDestination,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});

describe("routeService.deleteById", () => {
  it("deletes when no active trips or orders exist for the route", async () => {
    mocks.findRouteById.mockResolvedValue({
      _id: routeId,
      deletedAt: null,
    });
    mocks.deleteRouteById.mockResolvedValue({
      _id: routeId,
      deletedAt: new Date(),
    });

    await expect(routeService.deleteById(routeId)).resolves.toMatchObject({
      _id: routeId,
      deletedAt: expect.any(Date),
    });
    expect(mocks.deleteRouteById).toHaveBeenCalledWith(routeId);
  });

  it("blocks deletion when active trips or orders are linked", async () => {
    mocks.findRouteById.mockResolvedValue({
      _id: routeId,
      deletedAt: null,
    });
    mocks.countTrips.mockResolvedValue(2);

    await expect(routeService.deleteById(routeId)).rejects.toMatchObject({
      statusCode: 400,
      message: ROUTE_MESSAGES.CANNOT_DELETE_ACTIVE_TRIPS(2),
    });
    expect(mocks.deleteRouteById).not.toHaveBeenCalled();
  });
});

describe("routeService.restoreById", () => {
  it("restores a soft-deleted route", async () => {
    mocks.findRouteById.mockResolvedValue({
      _id: routeId,
      deletedAt: new Date(),
    });
    mocks.restoreRouteById.mockResolvedValue({
      _id: routeId,
      deletedAt: null,
    });

    await expect(routeService.restoreById(routeId)).resolves.toMatchObject({
      _id: routeId,
      deletedAt: null,
    });
    expect(mocks.restoreRouteById).toHaveBeenCalledWith(routeId);
  });
});
