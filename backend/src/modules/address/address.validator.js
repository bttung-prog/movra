import Joi from "joi";

const objectId = Joi.string()
  .regex(/^[0-9a-fA-F]{24}$/)
  .messages({
    "string.pattern.base": "Invalid ID format",
    "any.required": "ID is required",
  });

const createSchema = Joi.object({
  receiverName: Joi.string().trim().max(100).required().messages({
    "string.empty": "Receiver name cannot be empty",
    "any.required": "Receiver name is required",
    "string.max": "Receiver name must be at most 100 characters",
  }),
  label: Joi.string().trim().max(100).allow(null, "").optional().messages({
    "string.max": "Label must be at most 100 characters",
  }),
  province: Joi.string().trim().max(100).required().messages({
    "string.empty": "Province cannot be empty",
    "any.required": "Province is required",
    "string.max": "Province must be at most 100 characters",
  }),
  district: Joi.string().trim().max(100).required().messages({
    "string.empty": "District cannot be empty",
    "any.required": "District is required",
    "string.max": "District must be at most 100 characters",
  }),
  ward: Joi.string().trim().max(100).required().messages({
    "string.empty": "Ward cannot be empty",
    "any.required": "Ward is required",
    "string.max": "Ward must be at most 100 characters",
  }),
  detail: Joi.string().trim().max(500).required().messages({
    "string.empty": "Detail address cannot be empty",
    "any.required": "Detail address is required",
    "string.max": "Detail address must be at most 500 characters",
  }),
  latitude: Joi.number().min(-90).max(90).optional().messages({
    "number.min": "Latitude must be at least -90",
    "number.max": "Latitude must be at most 90",
  }),
  longitude: Joi.number().min(-180).max(180).optional().messages({
    "number.min": "Longitude must be at least -180",
    "number.max": "Longitude must be at most 180",
  }),
  postalCode: Joi.string().trim().max(10).allow(null, "").optional().messages({
    "string.base": "Postal code must be a string",
    "string.max": "Postal code must be at most 10 characters",
  }),
  isDefault: Joi.boolean().default(false).messages({
    "boolean.base": "isDefault must be a boolean value",
  }),
})
  .with("latitude", "longitude")
  .with("longitude", "latitude")
  .messages({
    "object.with": "Latitude and longitude must be provided together",
  });

const updateSchema = Joi.object({
  receiverName: Joi.string().trim().max(100).optional(),
  label: Joi.string().trim().max(100).allow(null, "").optional(),
  province: Joi.string().trim().max(100).optional(),
  district: Joi.string().trim().max(100).optional(),
  ward: Joi.string().trim().max(100).optional(),
  detail: Joi.string().trim().max(500).optional(),
  latitude: Joi.number().min(-90).max(90).optional(),
  longitude: Joi.number().min(-180).max(180).optional(),
  postalCode: Joi.string().trim().max(10).allow(null, "").optional(),
  isDefault: Joi.boolean().optional(),
})
  .min(1)
  .with("latitude", "longitude")
  .with("longitude", "latitude")
  .messages({
    "object.min": "At least one field must be provided for update",
    "object.with": "Latitude and longitude must be provided together",
  });

const idParamSchema = Joi.object({
  addressId: objectId.required(),
});

export default {
  createSchema,
  updateSchema,
  idParamSchema,
};
