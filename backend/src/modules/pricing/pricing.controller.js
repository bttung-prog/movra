import { PRICING_MESSAGES } from "../../constants/messages.js";

import ApiResponse from "../../utils/ApiResponse.js";

import pricingService from "./pricing.service.js";

const calculate = async (req, res, next) => {
  try {
    const result = await pricingService.calculateFee(req.body);
    return ApiResponse.success(res, result, PRICING_MESSAGES.CALCULATE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const createRate = async (req, res, next) => {
  try {
    const rate = await pricingService.createRate(req.body);
    return ApiResponse.created(res, rate, PRICING_MESSAGES.CREATE_RATE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getAllRates = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const { serviceType, isActive } = req.query;

    const filter = {};
    if (serviceType) filter.serviceType = serviceType;
    if (isActive !== undefined) filter.isActive = isActive === "true";

    const result = await pricingService.getAllRates({ filter, page, limit });
    return ApiResponse.success(
      res,
      result,
      PRICING_MESSAGES.GET_ALL_RATES_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getRateById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const rate = await pricingService.getRateById(id);
    return ApiResponse.success(res, rate, PRICING_MESSAGES.GET_RATE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const updateRate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const rate = await pricingService.updateRate(id, req.body);
    return ApiResponse.success(res, rate, PRICING_MESSAGES.UPDATE_RATE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const deleteRate = async (req, res, next) => {
  try {
    const { id } = req.params;
    await pricingService.deleteRate(id);
    return ApiResponse.success(res, null, PRICING_MESSAGES.DELETE_RATE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

export default {
  calculate,
  createRate,
  getAllRates,
  getRateById,
  updateRate,
  deleteRate,
};
