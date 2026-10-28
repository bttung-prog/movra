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
  status: Joi.string().valid("active", "inactive").messages({
    "any.only": "Status must be either 'active' or 'inactive'",
  }),
}).min(1);

const transferWarehouseSchema = Joi.object({
  warehouseId: Joi.string().pattern(objectIdPattern).required().messages({
    "any.required": "Warehouse ID is required",
    "string.empty": "Warehouse ID cannot be empty",
    "string.pattern.base": "Warehouse ID must be a valid MongoDB ObjectId",
  }),
});

const paramSchema = Joi.object({
  staffId: Joi.string().pattern(objectIdPattern).required().messages({
    "string.pattern.base": "Staff ID must be a valid MongoDB ObjectId",
    "any.required": "Staff ID is required",
  }),
});

const paramUserIdSchema = Joi.object({
  userId: Joi.string().pattern(objectIdPattern).required().messages({
    "string.pattern.base": "User ID must be a valid MongoDB ObjectId",
    "any.required": "User ID is required",
  }),
});

const paramCodeSchema = Joi.object({
  staffCode: Joi.string().required().messages({
    "string.empty": "Staff code cannot be empty",
    "any.required": "Staff code is required",
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
  status: Joi.string().valid("active", "inactive").messages({
    "any.only": "Status must be either 'active' or 'inactive'",
  }),
  warehouseId: Joi.string().pattern(objectIdPattern).messages({
    "string.pattern.base": "Warehouse ID must be a valid MongoDB ObjectId",
  }),
  userId: Joi.string().pattern(objectIdPattern).messages({
    "string.pattern.base": "User ID must be a valid MongoDB ObjectId",
  }),
  search: Joi.string().allow("").trim(),
});

export default {
  createSchema,
  updateSchema,
  transferWarehouseSchema,
  paramSchema,
  paramUserIdSchema,
  paramCodeSchema,
  querySchema,
};
