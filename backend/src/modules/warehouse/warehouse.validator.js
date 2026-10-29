import Joi from "joi";

import WAREHOUSE_STATUSES from "../../constants/warehouseStatuses.js";

const objectIdPattern = /^[0-9a-fA-F]{24}$/;
const validStatuses = Object.values(WAREHOUSE_STATUSES);

const createSchema = Joi.object({
  warehouseName: Joi.string().trim().required().messages({
    "any.required": "Warehouse name is required",
    "string.empty": "Warehouse name cannot be empty",
  }),
  warehouseAddress: Joi.string().trim().required().messages({
    "any.required": "Warehouse address is required",
    "string.empty": "Warehouse address cannot be empty",
  }),
  latitude: Joi.number().min(-90).max(90),
  longitude: Joi.number().min(-180).max(180),
  managerId: Joi.string().pattern(objectIdPattern).allow(null).messages({
    "string.pattern.base": "Manager ID must be a valid MongoDB ObjectId",
  }),
  status: Joi.string().valid(...validStatuses),
}).and("latitude", "longitude");

const updateSchema = Joi.object({
  warehouseName: Joi.string().trim(),
  warehouseAddress: Joi.string().trim(),
  latitude: Joi.number().min(-90).max(90),
  longitude: Joi.number().min(-180).max(180),
  managerId: Joi.string().pattern(objectIdPattern).allow(null).messages({
    "string.pattern.base": "Manager ID must be a valid MongoDB ObjectId",
  }),
  status: Joi.string().valid(...validStatuses),
})
  .and("latitude", "longitude")
  .min(1);

const updateManagerSchema = Joi.object({
  managerId: Joi.string()
    .pattern(objectIdPattern)
    .allow(null)
    .required()
    .messages({
      "any.required": "Manager ID is required",
      "string.pattern.base": "Manager ID must be a valid MongoDB ObjectId",
    }),
});

const changeStatusSchema = Joi.object({
  status: Joi.string()
    .valid(...validStatuses)
    .required()
    .messages({
      "any.required": "Status is required",
      "any.only": `Status must be one of: ${validStatuses.join(", ")}`,
    }),
});

const paramSchema = Joi.object({
  warehouseId: Joi.string().pattern(objectIdPattern).required().messages({
    "string.pattern.base": "Warehouse ID must be a valid MongoDB ObjectId",
  }),
});

const querySchema = Joi.object({
  search: Joi.string().trim().allow(""),
  page: Joi.number().integer().min(1).messages({
    "number.base": "Page must be a number",
    "number.integer": "Page must be an integer",
    "number.min": "Page must be greater than or equal to 1",
  }),
  limit: Joi.number().integer().min(1).max(100).messages({
    "number.base": "Limit must be a number",
    "number.integer": "Limit must be an integer",
    "number.min": "Limit must be greater than or equal to 1",
    "number.max": "Limit must be less than or equal to 100",
  }),
  status: Joi.string()
    .valid(...validStatuses)
    .messages({
      "any.only": `Status must be one of: ${validStatuses.join(", ")}`,
    }),
});

export default {
  createSchema,
  updateSchema,
  updateManagerSchema,
  changeStatusSchema,
  paramSchema,
  querySchema,
};
