import Joi from "joi";
import {
  MAINTENANCE_TYPES,
  MAINTENANCE_STATUSES,
} from "../../constants/maintenanceStatuses.js";

const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/);

const scheduleIdParamSchema = Joi.object({
  scheduleId: objectId.required().messages({
    "any.required": "Schedule ID is required",
    "string.pattern.base": "Schedule ID must be a valid MongoDB ObjectId",
  }),
});

const logIdParamSchema = Joi.object({
  logId: objectId.required().messages({
    "any.required": "Log ID is required",
    "string.pattern.base": "Log ID must be a valid MongoDB ObjectId",
  }),
});

const vehicleIdParamSchema = Joi.object({
  vehicleId: objectId.required().messages({
    "any.required": "Vehicle ID is required",
    "string.pattern.base": "Vehicle ID must be a valid MongoDB ObjectId",
  }),
});

const createScheduleSchema = Joi.object({
  vehicleId: objectId.required(),
  taskName: Joi.string().trim().required(),
  frequencyMonths: Joi.number().min(0).required(),
  frequencyKm: Joi.number().min(0).required(),
});

const updateScheduleSchema = Joi.object({
  taskName: Joi.string().trim(),
  frequencyMonths: Joi.number().min(0),
  frequencyKm: Joi.number().min(0),
  isActive: Joi.boolean(),
}).min(1);

const createLogSchema = Joi.object({
  vehicleId: objectId.required(),
  scheduleId: objectId.required(),
  type: Joi.string()
    .valid(...Object.values(MAINTENANCE_TYPES))
    .required(),
  description: Joi.string().trim().required(),
  cost: Joi.number().min(0).required(),
  odometerReading: Joi.number().min(0).required(),
  startDate: Joi.date().iso(),
  endDate: Joi.date().iso().min(Joi.ref("startDate")),
  status: Joi.string()
    .valid(MAINTENANCE_STATUSES.SCHEDULED)
    .default(MAINTENANCE_STATUSES.SCHEDULED),
});

const createLogEventSchema = Joi.object({
  status: Joi.string()
    .valid(...Object.values(MAINTENANCE_STATUSES))
    .required(),
  cost: Joi.number().min(0),
  odometerReading: Joi.number().min(0),
});

const getCostSchema = Joi.object({
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().min(Joi.ref("startDate")).required(),
});

const getCostByVehicleSchema = Joi.object({
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().min(Joi.ref("startDate")).required(),
});

const schedulePaginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  vehicleId: objectId.optional(),
  isActive: Joi.boolean().optional(),
});

const logPaginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  vehicleId: objectId.optional(),
  status: Joi.string()
    .valid(...Object.values(MAINTENANCE_STATUSES))
    .optional(),
});

export default {
  objectId,
  scheduleIdParamSchema,
  logIdParamSchema,
  vehicleIdParamSchema,
  createScheduleSchema,
  updateScheduleSchema,
  createLogSchema,
  createLogEventSchema,
  getCostSchema,
  getCostByVehicleSchema,
  schedulePaginationSchema,
  logPaginationSchema,
};
