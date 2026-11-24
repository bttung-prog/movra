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
  getGoodsCategoryByIds: vi.fn(),
  getCustomerById: vi.fn(),
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
  default: {
    getById: mocks.getGoodsCategoryById,
    getByIds: mocks.getGoodsCategoryByIds,
  },
}));

vi.mock("../../../src/modules/customer/customer.service.js", () => ({
  default: { getById: mocks.getCustomerById },
}));

import { DEFAULT_RATES_BY_SERVICE_TYPE } from "../../../src/constants/defaultShippingRate.js";
import { GOODS_CATEGORY_MESSAGES } from "../../../src/constants/messages.js";
import { SERVICE_TYPES } from "../../../src/constants/serviceTypes.js";

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
    deletedAt: null,
  });
  mocks.getGoodsCategoryByIds.mockResolvedValue([
    {
      _id: categoryId,
      goodsCategoryName: "Fragile",
      deletedAt: null,
    },
  ]);
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
      basePrice: 3000,
      weightFee: 0,
      distanceFee: 42000,
      surchargeAmount: 0,
      totalShippingFee: 45000,
    });
    expect(result.totalShippingFee).toBe(45000);
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
      basePrice: 4500,
      weightFee: 0,
      distanceFee: 45000,
      surchargeAmount: 0,
      totalShippingFee: 49500,
    });
    expect(result.totalShippingFee).toBe(49500);
  });

  it("uses route distance and applies matched category surcharge", async () => {
    mocks.findActiveByServiceType.mockResolvedValue({
      serviceType: "express",
      name: "Express",
      basePrice: 10000,
      baseWeight: 1000,
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
      length: 100,
      width: 100,
      height: 2,
      routeId,
      goodsCategoryId: categoryId,
    });

    expect(mocks.getRouteById).toHaveBeenCalledWith(routeId);
    expect(mocks.getGoodsCategoryById).toHaveBeenCalledWith(categoryId);
    expect(result).toMatchObject({
      serviceType: "express",
      rateName: "Express",
      actualWeight: 4,
      volumetricWeight: 6.67,
      billableWeight: 6.67,
      distance: 25,
    });
    expect(result.breakdown).toMatchObject({
      basePrice: 10000,
      weightFee: 0,
      distanceFee: 13000,
      surchargeAmount: 2800,
      totalShippingFee: 25800,
    });
  });

  it("calculates billable weight from per-package weight, volume, and quantity", async () => {
    mocks.findActiveByServiceType.mockResolvedValue({
      serviceType: "express",
      name: "Express",
      basePrice: 10000,
      baseWeight: 1000,
      extraWeightPrice: 2000,
      baseDistance: 12,
      extraDistancePrice: 1000,
      categorySurcharges: [],
    });

    const result = await pricingService.calculateFee({
      serviceType: "express",
      weight: 2,
      length: 30,
      width: 30,
      height: 10,
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
      weightFee: 0,
      distanceFee: 0,
      totalShippingFee: 10000,
    });
  });

  it("calculates volumetric weight from package dimensions", async () => {
    mocks.findActiveByServiceType.mockResolvedValue(null);

    const result = await pricingService.calculateFee({
      serviceType: "standard",
      weight: 1,
      length: 30,
      width: 20,
      height: 10,
      distance: 1,
    });

    expect(result.volumetricWeight).toBe(2);
    expect(result.billableWeight).toBe(2);
  });

  it.each([
    [1000, 0],
    [2000, 4000],
    [2500, 8000],
  ])(
    "charges extra weight per started ton: %s kg -> %s VND",
    async (weight, expectedWeightFee) => {
      mocks.findActiveByServiceType.mockResolvedValue({
        serviceType: "standard",
        name: "Per ton",
        basePrice: 10000,
        baseWeight: 1000,
        extraWeightPrice: 4000,
        baseDistance: 10,
        extraDistancePrice: 1000,
        categorySurcharges: [],
      });

      const result = await pricingService.calculateFee({
        serviceType: "standard",
        weight,
        distance: 10,
      });

      expect(result.breakdown.weightFee).toBe(expectedWeightFee);
      expect(result.totalShippingFee).toBe(10000 + expectedWeightFee);
    },
  );

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
      serviceType: "same_day",
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

  it("applies the customer's contract discount when customerId is provided", async () => {
    const customerId = "507f1f77bcf86cd799439013";
    mocks.findActiveByServiceType.mockResolvedValue(null);
    mocks.getCustomerById.mockResolvedValue({
      _id: customerId,
      contractDiscountRate: 10,
    });

    const result = await pricingService.calculateFee({
      serviceType: "standard",
      weight: 3,
      distance: 15,
      customerId,
    });

    expect(mocks.getCustomerById).toHaveBeenCalledWith(customerId);
    expect(result).toMatchObject({
      shippingFeeBeforeDiscount: 45000,
      discountRate: 10,
      discountAmount: 4500,
      totalShippingFee: 40500,
    });
    expect(result.breakdown).toMatchObject({
      shippingFeeBeforeDiscount: 45000,
      discountRate: 10,
      discountAmount: 4500,
      totalShippingFee: 40500,
    });
  });

  it("applies an explicit contractDiscountRate without loading the customer and rounds the discount", async () => {
    mocks.findActiveByServiceType.mockResolvedValue(null);

    const result = await pricingService.calculateFee({
      serviceType: "standard",
      weight: 3,
      distance: 15,
      contractDiscountRate: 7.5,
    });

    expect(mocks.getCustomerById).not.toHaveBeenCalled();
    expect(result.discountAmount).toBe(3375);
    expect(result.totalShippingFee).toBe(41625);
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
    const rateData = {
      ...payload,
      baseWeight: 1000,
      extraWeightPrice: 5000,
      baseDistance: 1,
      extraDistancePrice: 5000,
    };
    mocks.create.mockResolvedValue(rateData);

    const result = await pricingService.createRate(payload);

    expect(mocks.getGoodsCategoryByIds).toHaveBeenCalledWith([categoryId]);
    expect(mocks.getGoodsCategoryById).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledWith(rateData);
    expect(result).toEqual(rateData);
  });

  it("validates all category surcharges with one batched lookup", async () => {
    const secondCategoryId = "507f1f77bcf86cd799439014";
    const payload = {
      name: "Priority",
      serviceType: "express",
      basePrice: 20000,
      categorySurcharges: [
        { goodsCategoryId: categoryId, surchargePercentage: 5 },
        { goodsCategoryId: secondCategoryId, surchargeFixed: 1000 },
        { goodsCategoryId: categoryId, surchargeFixed: 500 },
      ],
    };
    mocks.getGoodsCategoryByIds.mockResolvedValue([
      { _id: categoryId, deletedAt: null },
      { _id: secondCategoryId, deletedAt: null },
    ]);
    mocks.create.mockResolvedValue({ _id: "rate-1", ...payload });

    await pricingService.createRate(payload);

    expect(mocks.getGoodsCategoryByIds).toHaveBeenCalledTimes(1);
    expect(mocks.getGoodsCategoryByIds).toHaveBeenCalledWith([
      categoryId,
      secondCategoryId,
    ]);
    expect(mocks.getGoodsCategoryById).not.toHaveBeenCalled();
  });

  it("throws 404 when a surcharge category does not exist", async () => {
    const payload = {
      name: "Priority",
      serviceType: "express",
      basePrice: 20000,
      categorySurcharges: [{ goodsCategoryId: categoryId }],
    };
    mocks.getGoodsCategoryByIds.mockResolvedValue([]);

    await expect(pricingService.createRate(payload)).rejects.toMatchObject({
      statusCode: 404,
      message: GOODS_CATEGORY_MESSAGES.NOT_FOUND,
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("throws 400 when a surcharge category was deleted", async () => {
    const payload = {
      name: "Priority",
      serviceType: "express",
      basePrice: 20000,
      categorySurcharges: [{ goodsCategoryId: categoryId }],
    };
    mocks.getGoodsCategoryByIds.mockResolvedValue([
      { _id: categoryId, deletedAt: new Date() },
    ]);

    await expect(pricingService.createRate(payload)).rejects.toMatchObject({
      statusCode: 400,
      message: GOODS_CATEGORY_MESSAGES.ALREADY_DELETED,
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("keeps admin-provided pricing values over service defaults", async () => {
    const payload = {
      name: "Priority Express",
      serviceType: "express",
      basePrice: 20000,
      baseWeight: 2000,
      extraWeightPrice: 9000,
      baseDistance: 3,
      extraDistancePrice: 4000,
    };
    mocks.create.mockResolvedValue(payload);

    const result = await pricingService.createRate(payload);

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

describe("pricing defaults", () => {
  it("defines a default rate for every supported service type", () => {
    expect(Object.keys(DEFAULT_RATES_BY_SERVICE_TYPE).sort()).toEqual(
      Object.values(SERVICE_TYPES).sort(),
    );
  });
});
