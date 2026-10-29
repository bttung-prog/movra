import Joi from "joi";

const objectId = Joi.string()
  .regex(/^[0-9a-fA-F]{24}$/)
  .messages({
    "string.pattern.base": "Invalid ID format",
    "any.required": "ID is required",
  });

const createFeedbackSchema = Joi.object({
  orderId: objectId.required().messages({
    "any.required": "Order ID is required",
  }),
  rating: Joi.number().integer().min(1).max(5).required().messages({
    "any.required": "Rating is required",
    "number.min": "Rating must be at least 1 star",
    "number.max": "Rating must be at most 5 stars",
  }),
  tags: Joi.array().items(Joi.string().trim()).optional(),
  comment: Joi.string().trim().allow("").optional(),
});

const driverResponseSchema = Joi.object({
  driverResponse: Joi.string().trim().required().messages({
    "any.required": "Driver response is required",
    "string.empty": "Driver response cannot be empty",
  }),
});

const queryFeedbackSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  driverId: objectId.optional(),
  customerId: objectId.optional(),
  rating: Joi.number().integer().min(1).max(5).optional(),
  status: Joi.string().valid("visible", "hidden").optional(),
});

const paramIdSchema = Joi.object({
  id: objectId.required(),
});

const paramOrderIdSchema = Joi.object({
  orderId: objectId.required(),
});

export default {
  createFeedbackSchema,
  driverResponseSchema,
  queryFeedbackSchema,
  paramIdSchema,
  paramOrderIdSchema,
};
