import Joi from "joi";

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

const updateLocationSchema = Joi.object({
  location: Joi.string().trim().max(100).required().messages({
    "any.required": "Location is required",
    "string.empty": "Location cannot be empty",
    "string.max": "Location must not exceed 100 characters",
  }),
});

const updateConditionSchema = Joi.object({
  condition: Joi.string().valid("good", "damaged").required().messages({
    "any.required": "Condition is required",
    "any.only": "Condition must be either 'good' or 'damaged'",
  }),
});

const inventoryIdParamSchema = Joi.object({
  inventoryId: Joi.string().pattern(objectIdPattern).required().messages({
    "string.pattern.base": "Inventory ID must be a valid MongoDB ObjectId",
  }),
});

const orderIdParamSchema = Joi.object({
  orderId: Joi.string().pattern(objectIdPattern).required().messages({
    "string.pattern.base": "Order ID must be a valid MongoDB ObjectId",
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

  warehouseId: Joi.string().pattern(objectIdPattern).messages({
    "string.pattern.base": "Warehouse ID must be a valid MongoDB ObjectId",
  }),

  orderId: Joi.string().pattern(objectIdPattern).messages({
    "string.pattern.base": "Order ID must be a valid MongoDB ObjectId",
  }),

  goodsCategoryId: Joi.string().pattern(objectIdPattern).messages({
    "string.pattern.base": "Goods Category ID must be a valid MongoDB ObjectId",
  }),

  status: Joi.string().valid("in_stock", "issued").messages({
    "any.only": "Status must be either 'in_stock' or 'issued'",
  }),

  condition: Joi.string().valid("good", "damaged").messages({
    "any.only": "Condition must be either 'good' or 'damaged'",
  }),

  location: Joi.string().trim().max(100),
  search: Joi.string().trim().max(100),
  sortBy: Joi.string().valid(
    "createdAt",
    "updatedAt",
    "quantity",
    "location",
    "status",
  ),
  sortOrder: Joi.string().valid("asc", "desc"),
});

export default {
  updateLocationSchema,
  updateConditionSchema,
  inventoryIdParamSchema,
  orderIdParamSchema,
  querySchema,
};
