import Joi from "joi";

const objectId = Joi.string()
  .regex(/^[0-9a-fA-F]{24}$/)
  .messages({
    "string.pattern.base": "Invalid ID format",
    "any.required": "ID is required",
  });

const phonePattern = /^[0-9]{10,11}$/;

const orderStatusEnum = [
  "created",
  "driver_assigned",
  "pickup_scheduled",
  "picked_up",
  "stored",
  "transporting",
  "out_for_delivery",
  "delivery_scheduled",
  "delivered",
  "failed",
  "returned",
  "cancelled",
];

const paymentStatusEnum = ["pending", "failed", "success"];

const orderTypeEnum = ["normal", "express"];

const createOrderSchema = Joi.object({
  customerId: objectId.optional(),

  senderName: Joi.string().trim().required().messages({
    "any.required": "Sender name is required",
    "string.empty": "Sender name cannot be empty",
  }),

  senderPhone: Joi.string().trim().pattern(phonePattern).required().messages({
    "any.required": "Sender phone is required",
    "string.pattern.base": "Sender phone must have 10 to 11 digits",
  }),

  senderAddress: Joi.string().trim().required().messages({
    "any.required": "Sender address is required",
    "string.empty": "Sender address cannot be empty",
  }),

  pickupLocation: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
  })
    .optional()
    .messages({
      "any.required": "Pickup location coordinates are required",
    }),

  recipientName: Joi.string().trim().required().messages({
    "any.required": "Recipient name is required",
    "string.empty": "Recipient name cannot be empty",
  }),

  recipientPhone: Joi.string()
    .trim()
    .pattern(phonePattern)
    .required()
    .messages({
      "any.required": "Recipient phone is required",
      "string.pattern.base": "Recipient phone must have 10 to 11 digits",
    }),

  recipientAddress: Joi.string().trim().required().messages({
    "any.required": "Recipient address is required",
    "string.empty": "Recipient address cannot be empty",
  }),

  goodCategory: objectId.required().messages({
    "any.required": "goodCategory is required",
  }),

  weight: Joi.number().positive().required().messages({
    "any.required": "Weight is required",
    "number.positive": "Weight must be greater than 0",
  }),

  volume: Joi.number().positive().required().messages({
    "any.required": "Volume is required",
    "number.positive": "Volume must be greater than 0",
  }),

  quantity: Joi.number().integer().positive().required().messages({
    "any.required": "Quantity is required",
    "number.positive": "Quantity must be greater than 0",
  }),

  codAmount: Joi.number().min(0).default(0).messages({
    "number.min": "COD amount cannot be negative",
  }),

  routeId: objectId.optional(),

  warehouseId: objectId.optional(),

  tripId: objectId.optional(),

  type: Joi.string()
    .valid(...orderTypeEnum)
    .default("normal"),

  notes: Joi.string().trim().allow("").optional(),

  createdBy: objectId.optional(),
});

const updateOrderSchema = Joi.object({
  senderName: Joi.string().trim().optional(),

  senderPhone: Joi.string().trim().pattern(phonePattern).optional(),

  senderAddress: Joi.string().trim().optional(),

  recipientName: Joi.string().trim().optional(),

  recipientPhone: Joi.string().trim().pattern(phonePattern).optional(),

  recipientAddress: Joi.string().trim().optional(),

  routeId: objectId.optional(),

  notes: Joi.string().trim().allow("").optional(),
})
  .min(1)
  .messages({
    "object.min": "At least one field must be provided to update",
  });

const paramOrderIdSchema = Joi.object({
  orderId: objectId.required().messages({
    "any.required": "Order ID is required",
  }),
});

const paramOrderCodeSchema = Joi.object({
  orderCode: Joi.string().trim().required().messages({
    "any.required": "Order code is required",
    "string.empty": "Order code cannot be empty",
  }),
});

const queryOrderSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().trim().allow("").optional(),
  status: Joi.string()
    .valid(...orderStatusEnum)
    .optional(),
  paymentStatus: Joi.string()
    .valid(...paymentStatusEnum)
    .optional(),
  customerId: objectId.optional(),
  tripId: objectId.optional(),
  routeId: objectId.optional(),
  goodCategory: objectId.optional(),
  type: Joi.string()
    .valid(...orderTypeEnum)
    .optional(),
});

const createTrackingLogSchema = Joi.object({
  tripId: objectId.optional(),
  status: Joi.string()
    .valid(...orderStatusEnum)
    .required()
    .messages({
      "any.only": `Status must be one of: ${orderStatusEnum.join(", ")}`,
      "any.required": "Status is required",
    }),
  latitude: Joi.number().min(-90).max(90).optional(),
  longitude: Joi.number().min(-180).max(180).optional(),
  address: Joi.string().trim().allow("").optional(),
  notes: Joi.string().trim().allow("").optional(),
  changedBy: objectId.optional(),
});

const pickupConfirmationSchema = Joi.object({
  outcome: Joi.string().valid("picked_up", "failed").required().messages({
    "any.required": "Pickup outcome is required",
    "any.only": "Pickup outcome must be 'picked_up' or 'failed'",
  }),
  notes: Joi.when("outcome", {
    is: "failed",
    then: Joi.string().trim().min(1).required(),
    otherwise: Joi.string().trim().allow("").optional(),
  }),
});

const queryTrackingLogSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortOrder: Joi.string().valid("asc", "desc").default("desc"),
});

const paramTripIdSchema = Joi.object({
  tripId: objectId.required().messages({
    "any.required": "Trip ID is required",
  }),
});

const markAsDeliveredSchema = Joi.object({
  tripId: objectId.optional(),
  latitude: Joi.number().min(-90).max(90).optional(),
  longitude: Joi.number().min(-180).max(180).optional(),
  address: Joi.string().trim().allow("").optional(),
  notes: Joi.string().trim().allow("").optional(),
  recipientReceivedName: Joi.string().trim().allow("").optional(),
});

const cancelOrderSchema = Joi.object({
  reason: Joi.string().trim().allow("").optional(),
});

const assignOrdersSchema = Joi.object({
  tripId: objectId.required().messages({
    "any.required": "tripId is required",
  }),
  orderIds: Joi.array().items(objectId).min(1).required().messages({
    "any.required": "orderIds are required",
    "array.min": "At least one orderId is required",
  }),
});

const unassignOrdersSchema = Joi.object({
  orderIds: Joi.array().items(objectId).min(1).required().messages({
    "any.required": "orderIds are required",
    "array.min": "At least one orderId is required",
  }),
});

export default {
  createOrderSchema,
  updateOrderSchema,
  paramOrderIdSchema,
  paramOrderCodeSchema,
  paramTripIdSchema,
  queryOrderSchema,
  createTrackingLogSchema,
  pickupConfirmationSchema,
  queryTrackingLogSchema,
  markAsDeliveredSchema,
  cancelOrderSchema,
  assignOrdersSchema,
  unassignOrdersSchema,
};
