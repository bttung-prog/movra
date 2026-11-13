import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findAll: vi.fn(),
  countAll: vi.fn(),
  findById: vi.fn(),
  findActiveByServiceType: vi.fn(),
  updateById: vi.fn(),
  deleteById: vi.fn(),
  getRouteById: vi.fn(),
  getGoodsCategoryById: vi.fn(),
}));

vi.mock("../../../src/modules/pricing/pricing.repository.js", () => ({
  default: {
    create: mocks.create,
    findAll: mocks.findAll,
    countAll: mocks.countAll,
    findById: mocks.findById,
    findActiveByServiceType: mocks.findActiveByServiceType,
    updateById: mocks.updateById,
    deleteById: mocks.deleteById,
  },
}));

vi.mock("../../../src/modules/route/route.service.js", () => ({
  default: {
    getById: mocks.getRouteById,
    getActiveByWarehousePair: vi.fn(),
  },
}));

vi.mock("../../../src/modules/warehouse/warehouse.service.js", () => ({
  default: {
    getById: vi.fn(),
    getNearestActiveWarehouse: vi.fn(),
  },
}));

vi.mock("../../../src/modules/goodsCategory/goodsCategory.service.js", () => ({
  default: { getById: mocks.getGoodsCategoryById },
}));

import pricingService from "../../../src/modules/pricing/pricing.service.js";
import routeService from "../../../src/modules/route/route.service.js";
import warehouseService from "../../../src/modules/warehouse/warehouse.service.js";

const categoryId = "507f1f77bcf86cd799439011";
const routeId = "507f1f77bcf86cd799439012";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getRouteById.mockResolvedValue({ _id: routeId, distance: 25 });
  mocks.getGoodsCategoryById.mockResolvedValue({
    _id: categoryId,
    goodsCategoryName: "Fragile",
  });
});

describe("pricingService.calculateFee", () => {
  it("falls back to the default rate when there is no active rate for service type", async () => {
    mocks.findActiveByServiceType.mockResolvedValue(null);

    const result = await pricingService.calculateFee({
      serviceType: "standard",
      weight: 3,
      distance: 15,
    });

    expect(result).toMatchObject({
      serviceType: "standard",
      rateName: "Bảng cước mặc định",
      actualWeight: 3,
      volumetricWeight: 0,
      billableWeight: 3,
      distance: 15,
    });
    expect(result.breakdown).toMatchObject({
      basePrice: 16500,
      weightFee: 5000,
      distanceFee: 26000,
      surchargeAmount: 0,
      totalShippingFee: 47500,
    });
    expect(result.totalShippingFee).toBe(47500);
  });

  it("falls back to the express default rate when there is no active rate for express", async () => {
    mocks.findActiveByServiceType.mockResolvedValue(null);

    const result = await pricingService.calculateFee({
      serviceType: "express",
      weight: 3,
      distance: 10,
    });

    expect(result).toMatchObject({
      serviceType: "express",
      rateName: "Bảng cước Hỏa tốc mặc định",
      actualWeight: 3,
      volumetricWeight: 0,
      billableWeight: 3,
      distance: 10,
    });
    expect(result.breakdown).toMatchObject({
      basePrice: 25000,
      weightFee: 7000,
      distanceFee: 28000,
      surchargeAmount: 0,
      totalShippingFee: 60000,
    });
    expect(result.totalShippingFee).toBe(60000);
  });

  it("uses route distance and applies matched category surcharge", async () => {
    mocks.findActiveByServiceType.mockResolvedValue({
      serviceType: "express",
      name: "Express",
      basePrice: 10000,
      baseWeight: 2,
      extraWeightPrice: 2000,
      baseDistance: 12,
      extraDistancePrice: 1000,
      categorySurcharges: [
        {
          goodsCategoryId: { _id: categoryId },
          surchargePercentage: 10,
          surchargeFixed: 500,
        },
      ],
    });

    const result = await pricingService.calculateFee({
      serviceType: "express",
      weight: 4,
      volume: 20000,
      routeId,
      goodsCategoryId: categoryId,
    });

    expect(mocks.getRouteById).toHaveBeenCalledWith(routeId);
    expect(mocks.getGoodsCategoryById).toHaveBeenCalledWith(categoryId);
    expect(result).toMatchObject({
      serviceType: "express",
      rateName: "Express",
      actualWeight: 4,
      volumetricWeight: 6,
      billableWeight: 6,
      distance: 25,
    });
    expect(result.breakdown).toMatchObject({
      basePrice: 10000,
      weightFee: 8000,
      distanceFee: 13000,
      surchargeAmount: 3600,
      totalShippingFee: 34600,
    });
  });

  it("calculates billable weight from per-package weight, volume, and quantity", async () => {
    mocks.findActiveByServiceType.mockResolvedValue({
      serviceType: "express",
      name: "Express",
      basePrice: 10000,
      baseWeight: 2,
      extraWeightPrice: 2000,
      baseDistance: 12,
      extraDistancePrice: 1000,
      categorySurcharges: [],
    });

    const result = await pricingService.calculateFee({
      serviceType: "express",
      weight: 2,
      volume: 10000,
      quantity: 3,
      distance: 12,
    });

    expect(result).toMatchObject({
      actualWeight: 6,
      volumetricWeight: 9,
      billableWeight: 9,
    });
    expect(result.breakdown).toMatchObject({
      basePrice: 10000,
      weightFee: 14000,
      distanceFee: 0,
      totalShippingFee: 24000,
    });
  });

  it("resolves 3-stage inter-warehouse distance when pickupLocation and deliveryLocation are provided", async () => {
    mocks.findActiveByServiceType.mockResolvedValue(null);
    warehouseService.getNearestActiveWarehouse
      .mockResolvedValueOnce({ warehouse: { _id: "wh-a" }, distanceKm: 4 })
      .mockResolvedValueOnce({ warehouse: { _id: "wh-b" }, distanceKm: 6 });
    routeService.getActiveByWarehousePair.mockResolvedValue({
      _id: routeId,
      distance: 100,
    });

    const result = await pricingService.calculateFee({
      serviceType: "standard",
      weight: 2,
      pickupLocation: { latitude: 10.77, longitude: 106.69 },
      deliveryLocation: { latitude: 21.02, longitude: 105.83 },
    });

    expect(result.distance).toBe(110);
    expect(result.routingBreakdown).toEqual({
      warehouseId: "wh-a",
      destinationWarehouseId: "wh-b",
      routeId,
      pickupDistanceKm: 4,
      routeDistanceKm: 100,
      deliveryDistanceKm: 6,
      totalDistanceKm: 110,
    });
  });

  it("resolves intra-zone distance without a route when Kho A equals Kho B", async () => {
    mocks.findActiveByServiceType.mockResolvedValue(null);
    warehouseService.getNearestActiveWarehouse
      .mockResolvedValueOnce({ warehouse: { _id: "wh-a" }, distanceKm: 3.5 })
      .mockResolvedValueOnce({ warehouse: { _id: "wh-a" }, distanceKm: 4.5 });

    const result = await pricingService.calculateFee({
      serviceType: "standard",
      weight: 2,
      pickupLocation: { latitude: 10.77, longitude: 106.69 },
      deliveryLocation: { latitude: 10.8, longitude: 106.72 },
    });

    expect(routeService.getActiveByWarehousePair).not.toHaveBeenCalled();
    expect(result.distance).toBe(8);
    expect(result.routingBreakdown).toMatchObject({
      warehouseId: "wh-a",
      destinationWarehouseId: "wh-a",
      routeId: null,
      routeDistanceKm: 0,
      totalDistanceKm: 8,
    });
  });

  it("throws 400 when Kho A differs from Kho B and no active route exists", async () => {
    warehouseService.getNearestActiveWarehouse
      .mockResolvedValueOnce({ warehouse: { _id: "wh-a" }, distanceKm: 4 })
      .mockResolvedValueOnce({ warehouse: { _id: "wh-b" }, distanceKm: 6 });
    routeService.getActiveByWarehousePair.mockResolvedValue(null);

    await expect(
      pricingService.calculateFee({
        serviceType: "standard",
        weight: 2,
        pickupLocation: { latitude: 10.77, longitude: 106.69 },
        deliveryLocation: { latitude: 21.02, longitude: 105.83 },
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message:
        "Chưa hỗ trợ tuyến vận chuyển giữa kho lấy hàng và kho giao hàng",
    });
  });

  it("calculates direct FTL distance A -> B without warehouse lookup", async () => {
    mocks.findActiveByServiceType.mockResolvedValue(null);

    const result = await pricingService.calculateFee({
      serviceType: "heavy",
      shippingMode: "direct",
      weight: 10,
      pickupLocation: { latitude: 10.77, longitude: 106.69 },
      deliveryLocation: { latitude: 10.87, longitude: 106.79 },
    });

    expect(warehouseService.getNearestActiveWarehouse).not.toHaveBeenCalled();
    expect(result.shippingMode).toBe("direct");
    expect(result.distance).toBeGreaterThan(10);
    expect(result.routingBreakdown).toMatchObject({
      warehouseId: null,
      destinationWarehouseId: null,
      routeId: null,
    });
  });

  it("rejects invalid distance values", async () => {
    mocks.getRouteById.mockResolvedValue({ _id: routeId, distance: 0 });

    await expect(
      pricingService.calculateFee({
        serviceType: "standard",
        weight: 2,
        routeId,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Khoảng cách vận chuyển phải lớn hơn 0",
    });
  });
});

describe("pricingService.rate management", () => {
  it("validates category surcharges before creating a rate", async () => {
    const payload = {
      name: "Priority",
      serviceType: "express",
      basePrice: 20000,
      categorySurcharges: [
        { goodsCategoryId: categoryId, surchargePercentage: 5 },
      ],
    };
    mocks.create.mockResolvedValue(payload);

    const result = await pricingService.createRate(payload);

    expect(mocks.getGoodsCategoryById).toHaveBeenCalledWith(categoryId);
    expect(mocks.create).toHaveBeenCalledWith(payload);
    expect(result).toEqual(payload);
  });

  it("returns paginated rates and totals", async () => {
    mocks.findAll.mockResolvedValue([{ _id: "rate-1" }, { _id: "rate-2" }]);
    mocks.countAll.mockResolvedValue(25);

    const result = await pricingService.getAllRates({
      page: 2,
      limit: 5,
      filter: { serviceType: "standard" },
    });

    expect(result).toMatchObject({
      rates: [{ _id: "rate-1" }, { _id: "rate-2" }],
      pagination: {
        page: 2,
        limit: 5,
        total: 25,
        totalPages: 5,
      },
    });
    expect(mocks.findAll).toHaveBeenCalledWith({
      filter: { serviceType: "standard" },
      skip: 5,
      limit: 5,
      sort: { createdAt: -1 },
    });
  });

  it("throws a 404 if a rate does not exist", async () => {
    mocks.findById.mockResolvedValue(null);

    await expect(
      pricingService.getRateById("507f1f77bcf86cd799439013"),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Không tìm thấy bảng cước",
    });
  });

  it("updates and deletes rates through the repository", async () => {
    const updatePayload = { isActive: false };
    const updatedRate = { _id: "rate-1", isActive: false };
    mocks.updateById.mockResolvedValue(updatedRate);
    mocks.deleteById.mockResolvedValue({ _id: "rate-1" });

    await expect(
      pricingService.updateRate("rate-1", updatePayload),
    ).resolves.toEqual(updatedRate);
    await expect(pricingService.deleteRate("rate-1")).resolves.toEqual({
      _id: "rate-1",
    });

    expect(mocks.updateById).toHaveBeenCalledWith("rate-1", updatePayload);
    expect(mocks.deleteById).toHaveBeenCalledWith("rate-1");
  });
});
