import Joi from "joi";

const objectId = Joi.string()
  .regex(/^[0-9a-fA-F]{24}$/)
  .messages({
    "string.pattern.base": "Invalid ID format",
    "any.required": "ID is required",
  });

const failureReasonTypeEnum = [
  "customer_rejected",
  "damaged",
  "wrong_address",
  "payment_failed",
  "other",
];

const createFailureReasonSchema = Joi.object({
  orderId: objectId.required().messages({
    "any.required": "orderId is required",
  }),

  tripId: objectId.required().messages({
    "any.required": "tripId is required",
  }),

  failureReasonType: Joi.string()
    .valid(...failureReasonTypeEnum)
    .required()
    .messages({
      "any.only": `failureReasonType must be one of: ${failureReasonTypeEnum.join(", ")}`,
      "any.required": "failureReasonType is required",
    }),

  failureReasonDescription: Joi.string().trim().allow("").optional(),

  reportedBy: objectId.optional(),

  latitude: Joi.number().min(-90).max(90).optional().messages({
    "number.min": "Latitude must be between -90 and 90",
    "number.max": "Latitude must be between -90 and 90",
  }),

  longitude: Joi.number().min(-180).max(180).optional().messages({
    "number.min": "Longitude must be between -180 and 180",
    "number.max": "Longitude must be between -180 and 180",
  }),

  address: Joi.string().trim().allow("").optional(),
});

const getAllFailureReasonsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),

  limit: Joi.number().integer().min(1).max(100).default(20),

  failureReasonType: Joi.string()
    .valid(...failureReasonTypeEnum)
    .optional(),

  orderId: objectId.optional(),

  tripId: objectId.optional(),

  reportedBy: objectId.optional(),

  startDate: Joi.date().iso().optional(),

  endDate: Joi.date().iso().raw().optional(),
});

const getByIdSchema = Joi.object({
  failureReasonId: objectId.required(),
});

const paramOrderIdSchema = Joi.object({
  orderId: objectId.required().messages({
    "any.required": "Order ID is required",
  }),
});

const paramTripIdSchema = Joi.object({
  tripId: objectId.required().messages({
    "any.required": "Trip ID is required",
  }),
});

const queryPaginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

const statsQuerySchema = Joi.object({
  failureReasonType: Joi.string()
    .valid(...failureReasonTypeEnum)
    .optional(),
  orderId: objectId.optional(),
  tripId: objectId.optional(),
  reportedBy: objectId.optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().raw().optional(),
});

const updateFailureReasonSchema = Joi.object({
  failureReasonType: Joi.string()
    .valid(...failureReasonTypeEnum)
    .optional()
    .messages({
      "any.only": `failureReasonType must be one of: ${failureReasonTypeEnum.join(", ")}`,
    }),
  failureReasonDescription: Joi.string().trim().allow("").optional(),
  latitude: Joi.number().min(-90).max(90).optional(),
  longitude: Joi.number().min(-180).max(180).optional(),
  address: Joi.string().trim().allow("").optional(),
})
  .min(1)
  .messages({
    "object.min": "At least one field must be provided for update",
  });

export default {
  createFailureReasonSchema,
  getAllFailureReasonsSchema,
  getByIdSchema,
  paramOrderIdSchema,
  paramTripIdSchema,
  queryPaginationSchema,
  statsQuerySchema,
  updateFailureReasonSchema,
};
