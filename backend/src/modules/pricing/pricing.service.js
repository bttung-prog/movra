import {
  GOODS_CATEGORY_MESSAGES,
  PRICING_MESSAGES,
} from "../../constants/messages.js";
import {
  DEFAULT_RATE,
  DEFAULT_RATES_BY_SERVICE_TYPE,
} from "../../constants/defaultShippingRate.js";
import { SHIPPING_MODES } from "../../constants/shippingModes.js";
import { KG_PER_TON } from "../../constants/pricingUnits.js";
import { SERVICE_TYPES } from "../../constants/serviceTypes.js";

import { hasValidCoordinates } from "../../utils/distance.util.js";
import { applyContractDiscount } from "../../utils/discount.util.js";
import { calculateVolumetricWeightKg } from "../../utils/volume.util.js";
import { ApiError } from "../../utils/ApiError.js";

import customerService from "../customer/customer.service.js";
import goodsCategoryService from "../goodsCategory/goodsCategory.service.js";
import routeService from "../route/route.service.js";

import pricingRepository from "./pricing.repository.js";
import routingHelper from "../route/routing.helper.js";

const calculateFee = async ({
  serviceType = SERVICE_TYPES.STANDARD,
  shippingMode = SHIPPING_MODES.CONSOLIDATED,
  weight = 1,
  length = 0,
  width = 0,
  height = 0,
  quantity = 1,
  distance = undefined,
  routeId = null,
  pickupLocation = null,
  deliveryLocation = null,
  goodsCategoryId = null,
  customerId = null,
  contractDiscountRate = undefined,
}) => {
  let resolvedDiscountRate = contractDiscountRate;
  if (resolvedDiscountRate === undefined && customerId) {
    const customer = await customerService.getById(customerId);
    resolvedDiscountRate = customer.contractDiscountRate || 0;
  }

  let routingBreakdown = null;

  if (
    (distance === undefined || distance === null) &&
    hasValidCoordinates(pickupLocation) &&
    hasValidCoordinates(deliveryLocation)
  ) {
    const routing = await routingHelper.resolveOrderRouting({
      shippingMode,
      pickupLocation,
      deliveryLocation,
      routeId,
    });
    distance = routing.totalDistanceKm;
    routingBreakdown = {
      warehouseId: routing.warehouseId,
      destinationWarehouseId: routing.destinationWarehouseId,
      routeId: routing.routeId,
      pickupDistanceKm: routing.pickupDistanceKm,
      routeDistanceKm: routing.routeDistanceKm,
      deliveryDistanceKm: routing.deliveryDistanceKm,
      totalDistanceKm: routing.totalDistanceKm,
    };
  } else if (routeId && (distance === undefined || distance === null)) {
    const route = await routeService.getById(routeId);
    distance = route.distance;
  }

  if (!distance || distance <= 0) {
    throw new ApiError(400, PRICING_MESSAGES.INVALID_DISTANCE);
  }

  if (goodsCategoryId) {
    await goodsCategoryService.getById(goodsCategoryId);
  }

  let rate = await pricingRepository.findActiveByServiceType(serviceType);
  if (!rate) {
    rate = DEFAULT_RATES_BY_SERVICE_TYPE[serviceType] || DEFAULT_RATE;
  }

  const totalWeight = weight * quantity;
  const volumetricWeight = calculateVolumetricWeightKg(
    length,
    width,
    height,
    quantity,
  );
  const billableWeight = Math.max(totalWeight, volumetricWeight);

  const extraWeight = Math.max(0, billableWeight - rate.baseWeight);
  const extraWeightTons = Math.ceil(extraWeight / KG_PER_TON);
  const extraDistance = Math.max(0, distance - rate.baseDistance);

  const weightFee = extraWeightTons * rate.extraWeightPrice;
  const distanceFee = Math.ceil(extraDistance) * rate.extraDistancePrice;

  const subTotal = rate.basePrice + weightFee + distanceFee;

  let surchargeAmount = 0;
  if (goodsCategoryId && rate.categorySurcharges?.length > 0) {
    const targetCategoryId = goodsCategoryId.toString();
    const matchedSurcharge = rate.categorySurcharges.find(
      (s) =>
        (s.goodsCategoryId?._id || s.goodsCategoryId)?.toString() ===
        targetCategoryId,
    );

    if (matchedSurcharge) {
      const percentageAmount =
        (subTotal * (matchedSurcharge.surchargePercentage || 0)) / 100;
      surchargeAmount =
        (matchedSurcharge.surchargeFixed || 0) + percentageAmount;
    }
  }

  const shippingFeeBeforeDiscount = Math.round(subTotal + surchargeAmount);
  const discount = applyContractDiscount(
    shippingFeeBeforeDiscount,
    resolvedDiscountRate,
  );
  const totalShippingFee = discount.netAmount;

  return {
    serviceType: rate.serviceType,
    shippingMode,
    rateName: rate.name,
    actualWeight: totalWeight,
    volumetricWeight,
    billableWeight,
    distance,
    ...(routingBreakdown ? { routingBreakdown } : {}),
    shippingFeeBeforeDiscount: discount.grossAmount,
    discountRate: discount.discountRate,
    discountAmount: discount.discountAmount,
    breakdown: {
      basePrice: rate.basePrice,
      weightFee,
      distanceFee,
      surchargeAmount,
      shippingFeeBeforeDiscount: discount.grossAmount,
      discountRate: discount.discountRate,
      discountAmount: discount.discountAmount,
      totalShippingFee,
    },
    totalShippingFee,
  };
};

const validateSurcharges = async (categorySurcharges = []) => {
  const categoryIds = [
    ...new Set(
      (categorySurcharges || [])
        .map((surcharge) => surcharge?.goodsCategoryId)
        .filter(Boolean)
        .map((goodsCategoryId) => goodsCategoryId.toString()),
    ),
  ];

  if (categoryIds.length === 0) {
    return;
  }

  const categories = await goodsCategoryService.getByIds(categoryIds);
  const categoriesById = new Map(
    (categories || []).map((category) => [category._id.toString(), category]),
  );

  for (const categoryId of categoryIds) {
    const category = categoriesById.get(categoryId);
    if (!category) {
      throw new ApiError(404, GOODS_CATEGORY_MESSAGES.NOT_FOUND);
    }
    if (category.deletedAt !== null) {
      throw new ApiError(400, GOODS_CATEGORY_MESSAGES.ALREADY_DELETED);
    }
  }
};

const createRate = async (payload) => {
  const defaults =
    DEFAULT_RATES_BY_SERVICE_TYPE[payload.serviceType] ?? DEFAULT_RATE;

  const rateData = {
    ...payload,
    baseWeight: payload.baseWeight ?? defaults.baseWeight,
    extraWeightPrice: payload.extraWeightPrice ?? defaults.extraWeightPrice,
    baseDistance: payload.baseDistance ?? defaults.baseDistance,
    extraDistancePrice:
      payload.extraDistancePrice ?? defaults.extraDistancePrice,
  };

  if (rateData.categorySurcharges?.length > 0) {
    await validateSurcharges(rateData.categorySurcharges);
  }
  return pricingRepository.create(rateData);
};

const getAllRates = async ({
  filter = {},
  page = 1,
  limit = 10,
  sort = { createdAt: -1 },
} = {}) => {
  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const limitNumber = Math.max(1, parseInt(limit, 10) || 10);
  const skip = (pageNumber - 1) * limitNumber;

  const [rates, total] = await Promise.all([
    pricingRepository.findAll({ filter, skip, limit: limitNumber, sort }),
    pricingRepository.countAll({ filter }),
  ]);

  return {
    rates,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages: Math.ceil(total / limitNumber),
    },
  };
};

const getRateById = async (id) => {
  const rate = await pricingRepository.findById(id);
  if (!rate) {
    throw new ApiError(404, PRICING_MESSAGES.RATE_NOT_FOUND);
  }
  return rate;
};

const updateRate = async (id, updateData) => {
  if (updateData.categorySurcharges?.length > 0) {
    await validateSurcharges(updateData.categorySurcharges);
  }
  const rate = await pricingRepository.updateById(id, updateData);
  if (!rate) {
    throw new ApiError(404, PRICING_MESSAGES.RATE_NOT_FOUND);
  }
  return rate;
};

const deleteRate = async (id) => {
  const rate = await pricingRepository.deleteById(id);
  if (!rate) {
    throw new ApiError(404, PRICING_MESSAGES.RATE_NOT_FOUND);
  }
  return rate;
};

export default {
  calculateFee,
  createRate,
  getAllRates,
  getRateById,
  updateRate,
  deleteRate,
};
