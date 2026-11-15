import Joi from "joi";

import { PAYMENT_TERMS } from "../../constants/paymentTerms.js";

const objectId = Joi.string()
  .regex(/^[0-9a-fA-F]{24}$/)
  .messages({
    "string.pattern.base": "Invalid ID format",
    "any.required": "ID is required",
  });

const phonePattern = /^[0-9]{10,11}$/;
const taxCodePattern = /^[0-9]{10}(-[0-9]{3})?$/;

const companyProfileFields = {
  companyName: Joi.string().trim().min(2).max(200).messages({
    "string.min": "Company name must be at least 2 characters",
    "string.max": "Company name must be at most 200 characters",
    "string.empty": "Company name cannot be empty",
  }),
  taxCode: Joi.string().trim().pattern(taxCodePattern).messages({
    "string.pattern.base":
      "Tax code must have 10 digits, optionally followed by a 3-digit branch suffix (e.g. 0312345678-001)",
  }),
  companyAddress: Joi.string().trim().max(500).messages({
    "string.max": "Company address must be at most 500 characters",
  }),
  contactPerson: Joi.string().trim().max(100).messages({
    "string.max": "Contact person must be at most 100 characters",
  }),
  contactPhone: Joi.string().trim().pattern(phonePattern).messages({
    "string.pattern.base": "Contact phone must have 10 to 11 digits",
  }),
};

const getAllSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().trim().allow("").optional(),
});

const getByIdSchema = Joi.object({
  customerId: objectId.required(),
});

const adminUpdateSchema = Joi.object({
  ...companyProfileFields,
  creditLimit: Joi.number()
    .integer()
    .min(0)
    .max(Number.MAX_SAFE_INTEGER)
    .messages({
      "number.integer": "Credit limit must be an integer",
      "number.min": "Credit limit cannot be negative",
      "number.max": "Credit limit exceeds allowed limit",
    }),
  defaultPaymentTerms: Joi.string()
    .valid(...Object.values(PAYMENT_TERMS))
    .messages({
      "any.only": `Default payment terms must be one of: ${Object.values(PAYMENT_TERMS).join(", ")}`,
    }),
  contractDiscountRate: Joi.number().min(0).max(100).messages({
    "number.min": "Contract discount rate cannot be negative",
    "number.max": "Contract discount rate cannot exceed 100",
  }),
  totalSpent: Joi.number().min(0).messages({
    "number.min": "Total spent cannot be negative",
  }),
  lastPurchaseDate: Joi.date().iso().messages({
    "date.format": "Invalid date format",
  }),
  creditNote: Joi.string().trim().max(500).allow("").messages({
    "string.max": "Credit note must be at most 500 characters",
  }),
})
  .min(1)
  .messages({
    "object.min": "At least one field must be provided for update",
  });

const updateMyProfileSchema = Joi.object({
  ...companyProfileFields,
})
  .min(1)
  .messages({
    "object.min": "At least one field must be provided for update",
  });

const creditHistoryQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

export default {
  getAllSchema,
  getByIdSchema,
  adminUpdateSchema,
  updateMyProfileSchema,
  creditHistoryQuerySchema,
};

