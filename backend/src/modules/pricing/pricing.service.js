import ApiError from "../../utils/ApiError.js";

import goodsCategoryService from "../goodsCategory/goodsCategory.service.js";
import routeService from "../route/route.service.js";

import pricingRepository from "./pricing.repository.js";

const DEFAULT_RATE = {
  name: "Bảng cước mặc định",
  serviceType: "standard",
  basePrice: 16500,
  baseWeight: 2,
  extraWeightPrice: 5000,
  baseDistance: 10,
  extraDistancePrice: 2000,
  categorySurcharges: [],
};

const calculateFee = async ({
  serviceType = "standard",
  weight = 1,
  volume = 0,
  distance = 5,
  routeId = null,
  goodsCategoryId = null,
}) => {
  let effectiveDistance = Number(distance) || 0;

  if (routeId) {
    const route = await routeService.getById(routeId);
    effectiveDistance = route.distance;
  }

  if (effectiveDistance <= 0) {
    throw new ApiError(400, "Khoảng cách vận chuyển phải lớn hơn 0");
  }

  if (goodsCategoryId) {
    await goodsCategoryService.getById(goodsCategoryId);
  }

  let rate = await pricingRepository.findActiveByServiceType(serviceType);
  if (!rate) {
    rate = DEFAULT_RATE;
  }

  const volumetricWeight = volume > 0 ? Number((volume / 5000).toFixed(2)) : 0;
  const billableWeight = Math.max(Number(weight) || 1, volumetricWeight);

  const extraWeight = Math.max(0, billableWeight - rate.baseWeight);
  const extraDistance = Math.max(0, effectiveDistance - rate.baseDistance);

  const weightFee = Math.ceil(extraWeight) * rate.extraWeightPrice;
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

  const totalShippingFee = Math.round(subTotal + surchargeAmount);

  return {
    serviceType: rate.serviceType,
    rateName: rate.name,
    actualWeight: Number(weight),
    volumetricWeight,
    billableWeight,
    distance: effectiveDistance,
    breakdown: {
      basePrice: rate.basePrice,
      weightFee,
      distanceFee,
      surchargeAmount,
      totalShippingFee,
    },
    totalShippingFee,
  };
};

const validateSurcharges = async (categorySurcharges = []) => {
  for (const surcharge of categorySurcharges) {
    if (surcharge.goodsCategoryId) {
      await goodsCategoryService.getById(surcharge.goodsCategoryId);
    }
  }
};

const createRate = async (payload) => {
  if (payload.categorySurcharges?.length > 0) {
    await validateSurcharges(payload.categorySurcharges);
  }
  return pricingRepository.create(payload);
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
    throw new ApiError(404, "Không tìm thấy bảng cước");
  }
  return rate;
};

const updateRate = async (id, updateData) => {
  if (updateData.categorySurcharges?.length > 0) {
    await validateSurcharges(updateData.categorySurcharges);
  }
  const rate = await pricingRepository.updateById(id, updateData);
  if (!rate) {
    throw new ApiError(404, "Không tìm thấy bảng cước");
  }
  return rate;
};

const deleteRate = async (id) => {
  const rate = await pricingRepository.deleteById(id);
  if (!rate) {
    throw new ApiError(404, "Không tìm thấy bảng cước");
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
