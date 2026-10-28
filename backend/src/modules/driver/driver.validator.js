import Joi from "joi";

const objectId = Joi.string()
  .regex(/^[0-9a-fA-F]{24}$/)
  .messages({
    "string.pattern.base": "Invalid ID format",
    "any.required": "ID is required",
  });

const createSchema = Joi.object({
  userId: objectId.required(),

  warehouseId: objectId.required(),

  idCardNumber: Joi.string().trim().required(),

  dateOfBirth: Joi.date().less("now").required(),

  gender: Joi.string().valid("male", "female", "other").required(),

  address: Joi.string().trim().required(),

  licenseNumber: Joi.string().trim().required(),

  licenseType: Joi.string()
    .valid(
      "A1",
      "A",
      "B1",
      "B",
      "C1",
      "C",
      "D1",
      "D2",
      "D",
      "BE",
      "C1E",
      "CE",
      "D1E",
      "D2E",
      "DE",
    )
    .required(),
  licenseExpiryDate: Joi.date().greater("now").required(),
});

const updateSchema = Joi.object({
  warehouseId: objectId,
  currentVehicleId: objectId.allow(null),
  address: Joi.string().trim(),
  licenseExpiryDate: Joi.date().greater("now"),
  status: Joi.string().valid("active", "inactive", "suspended"),
})
  .min(1)
  .messages({
    "object.min": "At least one field must be provided for update",
  });

const renewLicenseSchema = Joi.object({
  newExpiryDate: Joi.date().greater("now").required(),
});

const driverIdParamSchema = Joi.object({
  driverId: objectId.required(),
});

const driverCodeParamSchema = Joi.object({
  driverCode: Joi.string().trim().required(),
});

const getAllSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  status: Joi.string().valid("active", "inactive", "suspended"),
  warehouseId: objectId,
});

export default {
  createSchema,
  updateSchema,
  renewLicenseSchema,
  driverIdParamSchema,
  driverCodeParamSchema,
  getAllSchema,
};
