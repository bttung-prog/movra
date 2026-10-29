import Joi from "joi";

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

const createSchema = Joi.object({
  userId: Joi.string().pattern(objectIdPattern).required().messages({
    "any.required": "User ID is required",
    "string.empty": "User ID cannot be empty",
    "string.pattern.base": "User ID must be a valid MongoDB ObjectId",
  }),
  warehouseId: Joi.string().pattern(objectIdPattern).required().messages({
    "any.required": "Warehouse ID is required",
    "string.empty": "Warehouse ID cannot be empty",
    "string.pattern.base": "Warehouse ID must be a valid MongoDB ObjectId",
  }),
});

const updateSchema = Joi.object({
  warehouseId: Joi.string().pattern(objectIdPattern).messages({
    "string.pattern.base": "Warehouse ID must be a valid MongoDB ObjectId",
  }),
  status: Joi.string().valid("active", "inactive", "suspended").messages({
    "any.only": "Status must be either 'active', 'inactive', or 'suspended'",
  }),
}).min(1);

const transferWarehouseSchema = Joi.object({
  warehouseId: Joi.string().pattern(objectIdPattern).required().messages({
    "any.required": "Warehouse ID is required",
    "string.empty": "Warehouse ID cannot be empty",
    "string.pattern.base": "Warehouse ID must be a valid MongoDB ObjectId",
  }),
});

const updateStatusSchema = Joi.object({
  status: Joi.string()
    .valid("active", "inactive", "suspended")
    .required()
    .messages({
      "any.required": "Status is required",
      "any.only": "Status must be either 'active', 'inactive', or 'suspended'",
    }),
});

const paramSchema = Joi.object({
  dispatcherId: Joi.string().pattern(objectIdPattern).required().messages({
    "string.pattern.base": "Dispatcher ID must be a valid MongoDB ObjectId",
    "any.required": "Dispatcher ID is required",
  }),
});

const paramUserIdSchema = Joi.object({
  userId: Joi.string().pattern(objectIdPattern).required().messages({
    "string.pattern.base": "User ID must be a valid MongoDB ObjectId",
    "any.required": "User ID is required",
  }),
});

const paramCodeSchema = Joi.object({
  dispatcherCode: Joi.string().required().messages({
    "string.empty": "Dispatcher code cannot be empty",
    "any.required": "Dispatcher code is required",
  }),
});

const querySchema = Joi.object({
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
  status: Joi.string().valid("active", "inactive", "suspended").messages({
    "any.only": "Status must be either 'active', 'inactive', or 'suspended'",
  }),
  warehouseId: Joi.string().pattern(objectIdPattern).messages({
    "string.pattern.base": "Warehouse ID must be a valid MongoDB ObjectId",
  }),
  userId: Joi.string().pattern(objectIdPattern).messages({
    "string.pattern.base": "User ID must be a valid MongoDB ObjectId",
  }),
  search: Joi.string().allow("").trim(),
});

const resourcesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).messages({
    "number.base": "Page must be a number",
    "number.integer": "Page must be an integer",
    "number.min": "Page must be greater than or equal to 1",
  }),
  limit: Joi.number().integer().min(1).max(100).default(100).messages({
    "number.base": "Limit must be a number",
    "number.integer": "Limit must be an integer",
    "number.min": "Limit must be greater than or equal to 1",
    "number.max": "Limit must be less than or equal to 100",
  }),
});

export default {
  createSchema,
  updateSchema,
  transferWarehouseSchema,
  updateStatusSchema,
  paramSchema,
  paramUserIdSchema,
  paramCodeSchema,
  querySchema,
  resourcesQuerySchema,
};
