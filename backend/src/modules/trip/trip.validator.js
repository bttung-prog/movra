import Joi from "joi";

import TRIP_TYPES from "../../constants/tripTypes.js";

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

const tripIdParamSchema = Joi.object({
  tripId: Joi.string().pattern(objectIdPattern).required().messages({
    "any.required": "Trip ID is required",
    "string.pattern.base": "Trip ID must be a valid MongoDB ObjectId",
  }),
});

const tripCodeParamSchema = Joi.object({
  tripCode: Joi.string().trim().required().messages({
    "any.required": "Trip code is required",
    "string.empty": "Trip code cannot be empty",
  }),
});

const expenseIdParamSchema = Joi.object({
  expenseId: Joi.string().pattern(objectIdPattern).required().messages({
    "any.required": "Expense ID is required",
    "string.pattern.base": "Expense ID must be a valid MongoDB ObjectId",
  }),
});

const createTripSchema = Joi.object({
  vehicleId: Joi.string().pattern(objectIdPattern).required().messages({
    "any.required": "Vehicle ID is required",
    "string.pattern.base": "Vehicle ID must be a valid MongoDB ObjectId",
  }),

  driverId: Joi.string().pattern(objectIdPattern).required().messages({
    "any.required": "Driver ID is required",
    "string.pattern.base": "Driver ID must be a valid MongoDB ObjectId",
  }),

  routeId: Joi.when("type", {
    is: TRIP_TYPES.PICKUP,
    then: Joi.string().pattern(objectIdPattern).optional(),
    otherwise: Joi.string().pattern(objectIdPattern).required().messages({
      "any.required": "Route ID is required",
      "string.pattern.base": "Route ID must be a valid MongoDB ObjectId",
    }),
  }),

  plannedStart: Joi.date().iso().required().messages({
    "any.required": "Planned start date is required",
    "date.base": "Planned start must be a valid date",
    "date.format": "Planned start must be in ISO format",
  }),

  plannedEnd: Joi.date()
    .iso()
    .greater(Joi.ref("plannedStart"))
    .required()
    .messages({
      "any.required": "Planned end date is required",
      "date.base": "Planned end must be a valid date",
      "date.format": "Planned end must be in ISO format",
      "date.greater": "Planned end date must be after planned start date",
    }),

  type: Joi.string()
    .valid(...Object.values(TRIP_TYPES))
    .default(TRIP_TYPES.DELIVERY)
    .messages({
      "any.only": "Type must be 'pickup', 'delivery', or 'transfer'",
    }),
});

const updateTripSchema = Joi.object({
  vehicleId: Joi.forbidden().messages({
    "any.unknown": "Use the reassignment endpoint to change the vehicle",
  }),

  driverId: Joi.forbidden().messages({
    "any.unknown": "Use the reassignment endpoint to change the driver",
  }),

  routeId: Joi.string().pattern(objectIdPattern).messages({
    "string.pattern.base": "Route ID must be a valid MongoDB ObjectId",
  }),

  plannedStart: Joi.date().iso().messages({
    "date.base": "Planned start must be a valid date",
    "date.format": "Planned start must be in ISO format",
  }),

  plannedEnd: Joi.date().iso().messages({
    "date.base": "Planned end must be a valid date",
    "date.format": "Planned end must be in ISO format",
  }),

  actualStart: Joi.date().iso().allow(null).messages({
    "date.base": "Actual start must be a valid date",
  }),

  actualEnd: Joi.date().iso().allow(null).messages({
    "date.base": "Actual end must be a valid date",
  }),

  totalDistance: Joi.number().positive().allow(null).messages({
    "number.base": "Total distance must be a number",
    "number.positive": "Total distance must be greater than 0",
  }),

  type: Joi.string()
    .valid(...Object.values(TRIP_TYPES))
    .messages({
      "any.only": "Type must be 'pickup', 'delivery', or 'transfer'",
    }),
})
  .min(1)
  .messages({
    "object.min": "At least one field must be provided for update",
  });

const queryTripSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).messages({
    "number.base": "Page must be a number",
    "number.integer": "Page must be an integer",
    "number.min": "Page must be greater than or equal to 1",
  }),

  limit: Joi.number().integer().min(1).max(100).default(10).messages({
    "number.base": "Limit must be a number",
    "number.integer": "Limit must be an integer",
    "number.min": "Limit must be greater than or equal to 1",
    "number.max": "Limit must be less than or equal to 100",
  }),

  status: Joi.string()
    .valid("planned", "in_progress", "completed", "cancelled")
    .optional(),

  type: Joi.string()
    .valid(...Object.values(TRIP_TYPES))
    .optional(),

  vehicleId: Joi.string().pattern(objectIdPattern).optional(),
  driverId: Joi.string().pattern(objectIdPattern).optional(),
  routeId: Joi.string().pattern(objectIdPattern).optional(),
  tripCode: Joi.string().trim().optional(),
});

const reassignSchema = Joi.object({
  newDriverId: Joi.string().pattern(objectIdPattern).optional().messages({
    "string.pattern.base": "New Driver ID must be a valid MongoDB ObjectId",
  }),

  newVehicleId: Joi.string().pattern(objectIdPattern).optional().messages({
    "string.pattern.base": "New Vehicle ID must be a valid MongoDB ObjectId",
  }),

  reason: Joi.string().trim().required().messages({
    "any.required": "Reason for reassignment is required",
    "string.empty": "Reason cannot be empty",
  }),
})
  .or("newDriverId", "newVehicleId")
  .messages({
    "object.missing": "Must provide at least newDriverId or newVehicleId",
  });

const createTrackingLogSchema = Joi.object({
  status: Joi.string()
    .valid(
      "planned",
      "departed",
      "in_progress",
      "arrived_destination",
      "completed",
      "cancelled",
      "incident",
    )
    .required()
    .messages({
      "any.required": "Tracking status is required",
      "any.only":
        "Status must be one of: planned, departed, in_progress, arrived_destination, completed, cancelled, incident",
    }),

  latitude: Joi.number().min(-90).max(90).required().messages({
    "any.required": "Latitude is required",
    "number.base": "Latitude must be a number",
    "number.min": "Latitude must be between -90 and 90",
    "number.max": "Latitude must be between -90 and 90",
  }),

  longitude: Joi.number().min(-180).max(180).required().messages({
    "any.required": "Longitude is required",
    "number.base": "Longitude must be a number",
    "number.min": "Longitude must be between -180 and 180",
    "number.max": "Longitude must be between -180 and 180",
  }),

  address: Joi.string().trim().allow("", null).optional(),
  speed: Joi.number().min(0).allow(null).optional().messages({
    "number.base": "Speed must be a number",
    "number.min": "Speed cannot be negative",
  }),

  notes: Joi.string().trim().allow("", null).optional(),
  odometerReading: Joi.number().min(0).allow(null).optional().messages({
    "number.base": "Odometer reading must be a number",
    "number.min": "Odometer reading cannot be negative",
  }),
});

const createExpenseSchema = Joi.object({
  expenseType: Joi.string()
    .valid("fuel", "toll", "parking", "repair", "other")
    .required()
    .messages({
      "any.required": "Expense type is required",
      "any.only":
        "Expense type must be one of: fuel, toll, parking, repair, other",
    }),

  expenseAmount: Joi.number().positive().required().messages({
    "any.required": "Expense amount is required",
    "number.base": "Expense amount must be a number",
    "number.positive": "Expense amount must be greater than 0",
  }),

  expenseDate: Joi.date().iso().default(Date.now).messages({
    "date.base": "Expense date must be a valid date",
    "date.format": "Expense date must be in ISO format",
  }),

  note: Joi.string().trim().allow("", null).optional(),
  receiptUrl: Joi.string().trim().uri().allow("", null).optional().messages({
    "string.uri": "Receipt URL must be a valid URL",
  }),
});

const updateExpenseSchema = Joi.object({
  expenseType: Joi.string()
    .valid("fuel", "toll", "parking", "repair", "other")
    .messages({
      "any.only":
        "Expense type must be one of: fuel, toll, parking, repair, other",
    }),

  expenseAmount: Joi.number().positive().messages({
    "number.base": "Expense amount must be a number",
    "number.positive": "Expense amount must be greater than 0",
  }),

  expenseDate: Joi.date().iso().messages({
    "date.base": "Expense date must be a valid date",
    "date.format": "Expense date must be in ISO format",
  }),

  note: Joi.string().trim().allow("", null).optional(),
  receiptUrl: Joi.string().trim().uri().allow("", null).optional().messages({
    "string.uri": "Receipt URL must be a valid URL",
  }),
})
  .min(1)
  .messages({
    "object.min": "At least one field must be provided for update",
  });

const paginationQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

export default {
  tripIdParamSchema,
  tripCodeParamSchema,
  expenseIdParamSchema,

  createTripSchema,
  updateTripSchema,
  queryTripSchema,

  reassignSchema,

  createTrackingLogSchema,

  createExpenseSchema,
  updateExpenseSchema,

  paginationQuerySchema,
};
