import Joi from "joi";

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

const createGoodsCategorySchema = Joi.object({
  goodsCategoryName: Joi.string().trim().min(2).max(100).required().messages({
    "any.required": "Goods category name is required",
    "string.empty": "Goods category name cannot be empty",
    "string.min": "Goods category name must be at least 2 characters",
    "string.max": "Goods category name cannot exceed 100 characters",
  }),

  description: Joi.string().trim().max(500).allow("").default("").messages({
    "string.max": "Description cannot exceed 500 characters",
  }),
});

const updateGoodsCategorySchema = Joi.object({
  goodsCategoryName: Joi.string().trim().min(2).max(100).messages({
    "string.empty": "Goods category name cannot be empty",
    "string.min": "Goods category name must be at least 2 characters",
    "string.max": "Goods category name cannot exceed 100 characters",
  }),

  description: Joi.string().trim().max(500).allow("").messages({
    "string.max": "Description cannot exceed 500 characters",
  }),
})
  .min(1)
  .messages({
    "object.min": "At least one field must be provided to update",
  });

const paramGoodsCategoryIdSchema = Joi.object({
  goodsCategoryId: Joi.string().pattern(objectIdPattern).required().messages({
    "any.required": "Goods Category ID is required",
    "string.empty": "Goods Category ID cannot be empty",
    "string.pattern.base": "Goods Category ID must be a valid MongoDB ObjectId",
  }),
});

const queryGoodsCategorySchema = Joi.object({
  page: Joi.number().integer().min(1).messages({
    "number.base": "Page must be a number",
    "number.integer": "Page must be an integer",
    "number.min": "Page must be greater than or equal to 1",
  }),

  limit: Joi.number().integer().min(1).max(100).messages({
    "number.base": "Limit must be a number",
    "number.integer": "Limit must be an integer",
    "number.min": "Limit must be at least 1",
    "number.max": "Limit cannot exceed 100",
  }),

  search: Joi.string().trim().max(100).allow(""),

  status: Joi.string().valid("active", "deleted", "all").default("active").messages({
    "any.only": "Status must be one of [active, deleted, all]",
  }),

  sortBy: Joi.string().valid("goodsCategoryName", "createdAt", "updatedAt").default("createdAt").messages({
    "any.only": "sortBy must be one of [goodsCategoryName, createdAt, updatedAt]",
  }),

  sortOrder: Joi.string().valid("asc", "desc").default("desc").messages({
    "any.only": "sortOrder must be either 'asc' or 'desc'",
  }),
});

export default {
  createGoodsCategorySchema,
  updateGoodsCategorySchema,
  paramGoodsCategoryIdSchema,
  queryGoodsCategorySchema,
};
