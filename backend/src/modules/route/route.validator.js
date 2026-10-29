import Joi from "joi";

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

const createSchema = Joi.object({
  originWarehouseId: Joi.string()
    .pattern(objectIdPattern)
    .required()
    .messages({
      "any.required": "Origin warehouse is required",
      "string.pattern.base":
        "Origin warehouse ID must be a valid MongoDB ObjectId",
    }),

  destinationWarehouseId: Joi.string()
    .pattern(objectIdPattern)
    .required()
    .messages({
      "any.required": "Destination warehouse is required",
      "string.pattern.base":
        "Destination warehouse ID must be a valid MongoDB ObjectId",
    }),

  distance: Joi.number().positive().required().messages({
    "any.required": "Distance is required",
    "number.base": "Distance must be a number",
    "number.positive": "Distance must be greater than 0",
  }),

  expectedDuration: Joi.number().positive().required().messages({
    "any.required": "Expected duration is required",
    "number.base": "Expected duration must be a number",
    "number.positive": "Expected duration must be greater than 0",
  }),
});

const updateSchema = Joi.object({
  originWarehouseId: Joi.string().pattern(objectIdPattern).messages({
    "string.pattern.base":
      "Origin warehouse ID must be a valid MongoDB ObjectId",
  }),

  destinationWarehouseId: Joi.string().pattern(objectIdPattern).messages({
    "string.pattern.base":
      "Destination warehouse ID must be a valid MongoDB ObjectId",
  }),

  distance: Joi.number().positive().messages({
    "number.base": "Distance must be a number",
    "number.positive": "Distance must be greater than 0",
  }),

  expectedDuration: Joi.number().positive().messages({
    "number.base": "Expected duration must be a number",
    "number.positive": "Expected duration must be greater than 0",
  }),
})
  .min(1)
  .messages({
    "object.min": "At least one field must be provided for update",
  });

const paramSchema = Joi.object({
  routeId: Joi.string().pattern(objectIdPattern).required().messages({
    "any.required": "Route ID is required",
    "string.pattern.base": "Route ID must be a valid MongoDB ObjectId",
  }),
});

const querySchema = Joi.object({
  page: Joi.number().integer().min(1).messages({
    "number.base": "Page must be a number",
    "number.integer": "Page must be an integer",
    "number.min": "Page must be greater than or equal to 1",
  }),

  limit: Joi.number().integer().min(1).max(100).messages({
    "number.base": "Limit must be a number",
    "number.integer": "Limit must be an integer",
    "number.min": "Limit must be greater than or equal to 1",
    "number.max": "Limit must be less than or equal to 100",
  }),

  originWarehouseId: Joi.string().pattern(objectIdPattern).optional(),
  destinationWarehouseId: Joi.string().pattern(objectIdPattern).optional(),
});

export default {
  createSchema,
  updateSchema,
  paramSchema,
  querySchema,
};
