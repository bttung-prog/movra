import Joi from "joi";

const driverPerformanceQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(5),
});

export default {
  driverPerformanceQuerySchema,
};
