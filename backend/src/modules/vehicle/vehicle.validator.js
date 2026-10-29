import Joi from "joi";

import VEHICLE_STATUSES from "../../constants/vehicleStatuses.js";

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

const vehicleTypeIdParamSchema = Joi.object({
  vehicleTypeId: Joi.string().pattern(objectIdPattern).required().messages({
    "any.required": "Vehicle type ID is required",
    "string.pattern.base": "Vehicle type ID must be a valid MongoDB ObjectId",
  }),
});

const vehicleTypeNameParamSchema = Joi.object({
  vehicleTypeName: Joi.string().trim().required().messages({
    "any.required": "Vehicle type name is required",
  }),
});

const vehicleIdParamSchema = Joi.object({
  vehicleId: Joi.string().pattern(objectIdPattern).required().messages({
    "any.required": "Vehicle ID is required",
    "string.pattern.base": "Vehicle ID must be a valid MongoDB ObjectId",
  }),
});

const createTypeSchema = Joi.object({
  name: Joi.string().trim().required(),
  description: Joi.string().trim().required(),
  maxWeight: Joi.number().positive().required(),
  maxVolume: Joi.number().positive().required(),
});

const updateTypeSchema = Joi.object({
  name: Joi.string().trim(),
  description: Joi.string().trim(),
  maxWeight: Joi.number().positive(),
  maxVolume: Joi.number().positive(),
}).min(1);

const createSchema = Joi.object({
  plateNumber: Joi.string().trim().required(),
  vehicleTypeId: Joi.string().pattern(objectIdPattern).required().messages({
    "string.pattern.base": "vehicleTypeId must be a valid MongoDB ObjectId",
  }),
  warehouseId: Joi.string().pattern(objectIdPattern).allow(null),
  brand: Joi.string().trim().required(),
  model: Joi.string().trim().required(),
  yearManufactured: Joi.number()
    .integer()
    .min(1900)
    .max(new Date().getFullYear() + 1)
    .required(),
  capacityWeight: Joi.number().positive().required(),
  capacityVolume: Joi.number().positive().required(),
  registrationExpiryDate: Joi.date().iso().required().messages({
    "any.required": "Registration expiry date is required",
  }),
  insuranceExpiryDate: Joi.date().iso().required().messages({
    "any.required": "Insurance expiry date is required",
  }),
});

const updateSchema = Joi.object({
  plateNumber: Joi.string().trim(),
  vehicleTypeId: Joi.string().pattern(objectIdPattern),
  warehouseId: Joi.string().pattern(objectIdPattern).allow(null),
  brand: Joi.string().trim(),
  model: Joi.string().trim(),
  yearManufactured: Joi.number()
    .integer()
    .min(1900)
    .max(new Date().getFullYear() + 1),
  capacityWeight: Joi.number().positive(),
  capacityVolume: Joi.number().positive(),
  registrationExpiryDate: Joi.date().iso(),
  insuranceExpiryDate: Joi.date().iso(),
}).min(1);

const changeStatusSchema = Joi.object({
  status: Joi.string()
    .valid(...Object.values(VEHICLE_STATUSES))
    .required()
    .messages({
      "any.only":
        "Status must be one of: available, in_use, maintenance, retired",
    }),
});

const renewRegistrationSchema = Joi.object({
  newExpiryDate: Joi.date().iso().required(),
});

const renewInsuranceSchema = Joi.object({
  newExpiryDate: Joi.date().iso().required(),
});

const updateOdometerSchema = Joi.object({
  newOdo: Joi.number().min(0).required(),
});

const paginationQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  status: Joi.string()
    .valid(...Object.values(VEHICLE_STATUSES))
    .optional(),
  vehicleTypeId: Joi.string().pattern(objectIdPattern).optional(),
});

// ==========================================
// VEHICLE USAGE LOG SCHEMAS
// ==========================================

const logIdParamSchema = Joi.object({
  logId: Joi.string().pattern(objectIdPattern).required().messages({
    "any.required": "Usage log ID is required",
    "string.pattern.base": "Usage log ID must be a valid MongoDB ObjectId",
  }),
});

const tripIdParamSchema = Joi.object({
  tripId: Joi.string().pattern(objectIdPattern).required().messages({
    "any.required": "Trip ID is required",
    "string.pattern.base": "Trip ID must be a valid MongoDB ObjectId",
  }),
});

const driverIdParamSchema = Joi.object({
  driverId: Joi.string().pattern(objectIdPattern).required().messages({
    "any.required": "Driver ID is required",
    "string.pattern.base": "Driver ID must be a valid MongoDB ObjectId",
  }),
});

const createUsageLogSchema = Joi.object({
  vehicleId: Joi.string().pattern(objectIdPattern).required().messages({
    "any.required": "Vehicle ID is required",
    "string.pattern.base": "Vehicle ID must be a valid MongoDB ObjectId",
  }),

  driverId: Joi.string().pattern(objectIdPattern).required().messages({
    "any.required": "Driver ID is required",
    "string.pattern.base": "Driver ID must be a valid MongoDB ObjectId",
  }),

  tripId: Joi.string().pattern(objectIdPattern).required().messages({
    "any.required": "Trip ID is required",
    "string.pattern.base": "Trip ID must be a valid MongoDB ObjectId",
  }),

  startOdo: Joi.number().min(0).required().messages({
    "any.required": "Start odometer is required",
    "number.base": "Start odometer must be a number",
    "number.min": "Start odometer cannot be negative",
  }),

  startTime: Joi.date().iso().default(Date.now).messages({
    "date.base": "Start time must be a valid date",
    "date.format": "Start time must be in ISO format",
  }),

  notes: Joi.string().trim().allow("", null).optional(),
});

const checkOutUsageLogSchema = Joi.object({
  endOdo: Joi.number().min(0).required().messages({
    "any.required": "End odometer is required",
    "number.base": "End odometer must be a number",
    "number.min": "End odometer cannot be negative",
  }),

  endTime: Joi.date().iso().default(Date.now).messages({
    "date.base": "End time must be a valid date",
    "date.format": "End time must be in ISO format",
  }),

  fuelConsumed: Joi.number().min(0).default(0).messages({
    "number.base": "Fuel consumed must be a number",
    "number.min": "Fuel consumed cannot be negative",
  }),

  notes: Joi.string().trim().allow("", null).optional(),
});

const updateUsageLogSchema = Joi.object({
  vehicleId: Joi.string().pattern(objectIdPattern).messages({
    "string.pattern.base": "Vehicle ID must be a valid MongoDB ObjectId",
  }),

  driverId: Joi.string().pattern(objectIdPattern).messages({
    "string.pattern.base": "Driver ID must be a valid MongoDB ObjectId",
  }),

  tripId: Joi.string().pattern(objectIdPattern).messages({
    "string.pattern.base": "Trip ID must be a valid MongoDB ObjectId",
  }),

  startOdo: Joi.number().min(0).messages({
    "number.base": "Start odometer must be a number",
    "number.min": "Start odometer cannot be negative",
  }),

  endOdo: Joi.number().min(0).messages({
    "number.base": "End odometer must be a number",
    "number.min": "End odometer cannot be negative",
  }),

  startTime: Joi.date().iso().messages({
    "date.base": "Start time must be a valid date",
    "date.format": "Start time must be in ISO format",
  }),

  endTime: Joi.date().iso().messages({
    "date.base": "End time must be a valid date",
    "date.format": "End time must be in ISO format",
  }),

  fuelConsumed: Joi.number().min(0).messages({
    "number.base": "Fuel consumed must be a number",
    "number.min": "Fuel consumed cannot be negative",
  }),

  notes: Joi.string().trim().allow("", null).optional(),
})
  .min(1)
  .messages({
    "object.min": "At least one field must be provided for update",
  });

const queryUsageLogsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  vehicleId: Joi.string().pattern(objectIdPattern).optional(),
  driverId: Joi.string().pattern(objectIdPattern).optional(),
  tripId: Joi.string().pattern(objectIdPattern).optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
});

const usageStatsQuerySchema = Joi.object({
  startDate: Joi.date().iso().optional().messages({
    "date.base": "Start date must be a valid date",
  }),
  endDate: Joi.date().iso().optional().messages({
    "date.base": "End date must be a valid date",
  }),
});

export default {
  vehicleIdParamSchema,
  vehicleTypeIdParamSchema,
  vehicleTypeNameParamSchema,
  logIdParamSchema,
  tripIdParamSchema,
  driverIdParamSchema,

  createTypeSchema,
  updateTypeSchema,

  createSchema,
  updateSchema,
  changeStatusSchema,
  updateOdometerSchema,
  renewRegistrationSchema,
  renewInsuranceSchema,
  paginationQuerySchema,

  // Vehicle Usage Log Schemas
  createUsageLogSchema,
  checkOutUsageLogSchema,
  updateUsageLogSchema,
  queryUsageLogsSchema,
  usageStatsQuerySchema,
};
