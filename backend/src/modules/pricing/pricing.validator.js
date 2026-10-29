import Joi from "joi";

import { SERVICE_TYPES } from "../../constants/serviceTypes.js";

const objectId = Joi.string()
  .regex(/^[0-9a-fA-F]{24}$/)
  .messages({
    "string.pattern.base": "Invalid ID format",
    "any.required": "ID is required",
  });

const serviceTypesEnum = Object.values(SERVICE_TYPES);

const calculateFeeSchema = Joi.object({
  serviceType: Joi.string()
    .valid(...serviceTypesEnum)
    .default(SERVICE_TYPES.STANDARD),
  weight: Joi.number().positive().required().messages({
    "any.required": "Weight is required",
    "number.positive": "Weight must be greater than 0",
  }),
  volume: Joi.number().min(0).default(0),
  distance: Joi.number().positive().optional().messages({
    "number.positive": "Distance must be greater than 0",
  }),
  routeId: objectId.optional(),
  goodsCategoryId: objectId.optional(),
})
  .or("distance", "routeId")
  .messages({
    "object.missing": "Either distance or routeId must be provided",
  });

const createShippingRateSchema = Joi.object({
  name: Joi.string().trim().required().messages({
    "any.required": "Shipping rate name is required",
    "string.empty": "Shipping rate name cannot be empty",
  }),
  serviceType: Joi.string()
    .valid(...serviceTypesEnum)
    .required(),
  basePrice: Joi.number().min(0).required().messages({
    "any.required": "Base price is required",
  }),
  baseWeight: Joi.number().min(0).default(2),
  extraWeightPrice: Joi.number().min(0).default(5000),
  baseDistance: Joi.number().min(0).default(10),
  extraDistancePrice: Joi.number().min(0).default(2000),
  categorySurcharges: Joi.array()
    .items(
      Joi.object({
        goodsCategoryId: objectId.required(),
        surchargePercentage: Joi.number().min(0).default(0),
        surchargeFixed: Joi.number().min(0).default(0),
      }),
    )
    .optional(),
  isActive: Joi.boolean().default(true),
  description: Joi.string().trim().allow("").optional(),
});

const updateShippingRateSchema = Joi.object({
  name: Joi.string().trim().optional(),
  serviceType: Joi.string()
    .valid(...serviceTypesEnum)
    .optional(),
  basePrice: Joi.number().min(0).optional(),
  baseWeight: Joi.number().min(0).optional(),
  extraWeightPrice: Joi.number().min(0).optional(),
  baseDistance: Joi.number().min(0).optional(),
  extraDistancePrice: Joi.number().min(0).optional(),
  categorySurcharges: Joi.array()
    .items(
      Joi.object({
        goodsCategoryId: objectId.required(),
        surchargePercentage: Joi.number().min(0).default(0),
        surchargeFixed: Joi.number().min(0).default(0),
      }),
    )
    .optional(),
  isActive: Joi.boolean().optional(),
  description: Joi.string().trim().allow("").optional(),
});

const queryRateSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  serviceType: Joi.string()
    .valid(...serviceTypesEnum)
    .optional(),
  isActive: Joi.boolean().optional(),
});

const paramIdSchema = Joi.object({
  id: objectId.required(),
});

export default {
  calculateFeeSchema,
  createShippingRateSchema,
  updateShippingRateSchema,
  queryRateSchema,
  paramIdSchema,
};
