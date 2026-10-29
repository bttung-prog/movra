import Joi from "joi";

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

const createIssueSchema = Joi.object({
  orderId: Joi.string().pattern(objectIdPattern).required().messages({
    "any.required": "Order ID is required",
    "string.empty": "Order ID cannot be empty",
    "string.pattern.base": "Order ID must be a valid MongoDB ObjectId",
  }),

  goodsCategoryId: Joi.string().pattern(objectIdPattern).messages({
    "string.empty": "Goods Category ID cannot be empty",
    "string.pattern.base": "Goods Category ID must be a valid MongoDB ObjectId",
  }),

  warehouseId: Joi.string().pattern(objectIdPattern).required().messages({
    "any.required": "Warehouse ID is required",
    "string.empty": "Warehouse ID cannot be empty",
    "string.pattern.base": "Warehouse ID must be a valid MongoDB ObjectId",
  }),

  tripId: Joi.string().pattern(objectIdPattern).required().messages({
    "any.required": "Trip ID is required",
    "string.empty": "Trip ID cannot be empty",
    "string.pattern.base": "Trip ID must be a valid MongoDB ObjectId",
  }),

  issuedBy: Joi.string().pattern(objectIdPattern).messages({
    "string.pattern.base": "Issued By must be a valid MongoDB ObjectId",
  }),

  quantity: Joi.number().integer().min(1).required().messages({
    "any.required": "Quantity is required",
    "number.base": "Quantity must be a number",
    "number.integer": "Quantity must be an integer",
    "number.min": "Quantity must be greater than or equal to 1",
  }),

  note: Joi.string().max(500).allow("").default(""),
});

const updateNoteSchema = Joi.object({
  note: Joi.string().max(500).allow("").required().messages({
    "any.required": "Note is required",
    "string.max": "Note cannot exceed 500 characters",
  }),
});

const cancelIssueSchema = Joi.object({
  note: Joi.string().max(500).allow(""),
});

const paramIssueIdSchema = Joi.object({
  issueId: Joi.string().pattern(objectIdPattern).required().messages({
    "string.pattern.base": "Issue ID must be a valid MongoDB ObjectId",
  }),
});

const paramIssueCodeSchema = Joi.object({
  issueCode: Joi.string().trim().required().messages({
    "any.required": "Issue code is required",
    "string.empty": "Issue code cannot be empty",
  }),
});

const paramOrderIdSchema = Joi.object({
  orderId: Joi.string().pattern(objectIdPattern).required().messages({
    "string.pattern.base": "Order ID must be a valid MongoDB ObjectId",
  }),
});

const paramTripIdSchema = Joi.object({
  tripId: Joi.string().pattern(objectIdPattern).required().messages({
    "string.pattern.base": "Trip ID must be a valid MongoDB ObjectId",
  }),
});

const queryTripIssueSchema = Joi.object({
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
});

const queryIssueSchema = Joi.object({
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

  issueCode: Joi.string().trim().messages({
    "string.empty": "Issue code cannot be empty",
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

  tripId: Joi.string().pattern(objectIdPattern).messages({
    "string.pattern.base": "Trip ID must be a valid MongoDB ObjectId",
  }),

  issuedBy: Joi.string().pattern(objectIdPattern).messages({
    "string.pattern.base": "Issued By must be a valid MongoDB ObjectId",
  }),

  status: Joi.string().valid("completed", "cancelled").messages({
    "any.only": "Status must be either 'completed' or 'cancelled'",
  }),

  fromDate: Joi.date().iso().messages({
    "date.format": "fromDate must be a valid ISO date",
  }),

  toDate: Joi.date().iso().messages({
    "date.format": "toDate must be a valid ISO date",
  }),

  sortBy: Joi.string().valid("createdAt", "issuedAt", "quantity").messages({
    "any.only": "sortBy must be one of: createdAt, issuedAt, quantity",
  }),

  sortOrder: Joi.string().valid("asc", "desc").messages({
    "any.only": "sortOrder must be either 'asc' or 'desc'",
  }),
});

export default {
  createIssueSchema,
  updateNoteSchema,
  cancelIssueSchema,
  paramIssueIdSchema,
  paramIssueCodeSchema,
  paramOrderIdSchema,
  paramTripIdSchema,
  queryTripIssueSchema,
  queryIssueSchema,
};
