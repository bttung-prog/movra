import Joi from "joi";

const objectId = Joi.string()
  .regex(/^[0-9a-fA-F]{24}$/)
  .messages({
    "string.pattern.base": "Invalid ID format",
    "any.required": "ID is required",
  });

const getAllSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().trim().allow("").optional(),
});

const getByIdSchema = Joi.object({
  customerId: objectId.required(),
});

const adminUpdateSchema = Joi.object({
  gender: Joi.string().valid("male", "female", "other").messages({
    "any.only": "Gender must be male, female, or other",
  }),
  totalSpent: Joi.number().min(0).messages({
    "number.min": "Total spent cannot be negative",
  }),
  loyaltyPoints: Joi.number().integer().min(0).messages({
    "number.min": "Loyalty points cannot be negative",
  }),
  lastPurchaseDate: Joi.date().iso().messages({
    "date.format": "Invalid date format",
  }),
})
  .min(1)
  .messages({
    "object.min": "At least one field must be provided for update",
  });

const updateMyProfileSchema = Joi.object({
  gender: Joi.string().valid("male", "female", "other").required().messages({
    "any.only": "Gender must be male, female, or other",
    "any.required": "Gender is required",
  }),
});

export default {
  getAllSchema,
  getByIdSchema,
  adminUpdateSchema,
  updateMyProfileSchema,
};
