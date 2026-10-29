import Joi from "joi";

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

const createReceiptSchema = Joi.object({
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

  receivedBy: Joi.string().pattern(objectIdPattern).messages({
    "string.pattern.base": "Received By must be a valid MongoDB ObjectId",
  }),

  quantity: Joi.number().integer().min(1).required().messages({
    "any.required": "Quantity is required",
    "number.base": "Quantity must be a number",
    "number.integer": "Quantity must be an integer",
    "number.min": "Quantity must be greater than or equal to 1",
  }),

  condition: Joi.string().valid("good", "damaged").default("good").messages({
    "any.only": "Condition must be either 'good' or 'damaged'",
  }),

  location: Joi.string().trim().default("RECEIVING_AREA").messages({
    "string.empty": "Location cannot be empty",
  }),

  receivedAt: Joi.date().iso().messages({
    "date.base": "Received date must be a valid date",
    "date.format": "Received date must follow ISO 8601 format",
  }),

  note: Joi.string().max(500).allow("").default(""),
});

const cancelReceiptSchema = Joi.object({
  note: Joi.string().max(500).allow(""),
});

const updateReceiptSchema = Joi.object({
  status: Joi.string().valid("cancelled").messages({
    "any.only": "Status update only allows 'cancelled'",
  }),

  condition: Joi.string().valid("good", "damaged").messages({
    "any.only": "Condition must be either 'good' or 'damaged'",
  }),

  note: Joi.string().max(500).allow(""),
})
  .min(1)
  .messages({
    "object.min": "At least one field must be provided to update",
  });

const paramReceiptIdSchema = Joi.object({
  receiptId: Joi.string().pattern(objectIdPattern).required().messages({
    "string.pattern.base": "Receipt ID must be a valid MongoDB ObjectId",
  }),
});

const paramReceiptCodeSchema = Joi.object({
  receiptCode: Joi.string().trim().required().messages({
    "any.required": "Receipt Code is required",
    "string.empty": "Receipt Code cannot be empty",
  }),
});

const paramOrderIdSchema = Joi.object({
  orderId: Joi.string().pattern(objectIdPattern).required().messages({
    "string.pattern.base": "Order ID must be a valid MongoDB ObjectId",
  }),
});

const queryReceiptSchema = Joi.object({
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

  receiptCode: Joi.string().trim().messages({
    "string.empty": "Receipt Code cannot be empty",
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

  receivedBy: Joi.string().pattern(objectIdPattern).messages({
    "string.pattern.base": "Received By must be a valid MongoDB ObjectId",
  }),

  status: Joi.string().valid("completed", "cancelled").messages({
    "any.only": "Status must be either 'completed' or 'cancelled'",
  }),

  condition: Joi.string().valid("good", "damaged").messages({
    "any.only": "Condition must be either 'good' or 'damaged'",
  }),

  fromDate: Joi.date().iso().messages({
    "date.format": "fromDate must follow ISO 8601 format",
  }),

  toDate: Joi.date().iso().messages({
    "date.format": "toDate must follow ISO 8601 format",
  }),

  sortBy: Joi.string().valid("createdAt", "receivedAt", "quantity").messages({
    "any.only": "sortBy must be one of: createdAt, receivedAt, quantity",
  }),

  sortOrder: Joi.string().valid("asc", "desc").messages({
    "any.only": "sortOrder must be either 'asc' or 'desc'",
  }),
});

export default {
  createReceiptSchema,
  cancelReceiptSchema,
  updateReceiptSchema,
  paramReceiptIdSchema,
  paramReceiptCodeSchema,
  paramOrderIdSchema,
  queryReceiptSchema,
};
