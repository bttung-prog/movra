import Joi from "joi";

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

const createUserSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).max(24).required().messages({
    "string.min": "Password must be at least 6 characters",
    "string.max": "Password must be at most 24 characters",
    "any.required": "Password is required",
  }),
  phone: Joi.string()
    .pattern(/^\d{10}$/)
    .required()
    .messages({
      "string.pattern.base": "Phone number must be exactly 10 digits",
      "any.required": "Phone is required",
    }),
  fullName: Joi.string().required(),
  role: Joi.string()
    .valid("admin", "driver", "dispatcher", "warehouse_staff", "customer")
    .required(),
  driverData: Joi.object({
    warehouseId: Joi.string().pattern(objectIdPattern).required().messages({
      "string.pattern.base": "Warehouse ID must be a valid MongoDB ObjectId",
      "any.required": "Warehouse ID is required",
    }),
    idCardNumber: Joi.string().required(),
    dateOfBirth: Joi.date().required(),
    gender: Joi.string().valid("male", "female", "other").required(),
    address: Joi.string().required(),
    licenseNumber: Joi.string().required(),
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
    hiredDate: Joi.date().optional(),
  }).when("role", {
    is: "driver",
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),

  staffData: Joi.object({
    warehouseId: Joi.string().pattern(objectIdPattern).required().messages({
      "string.pattern.base": "Warehouse ID must be a valid MongoDB ObjectId",
      "any.required": "Warehouse ID is required",
    }),
  }).when("role", {
    is: "warehouse_staff",
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),

  dispatcherData: Joi.object({
    warehouseId: Joi.string().pattern(objectIdPattern).required().messages({
      "string.pattern.base": "Warehouse ID must be a valid MongoDB ObjectId",
      "any.required": "Warehouse ID is required",
    }),
  }).when("role", {
    is: "dispatcher",
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
});

const updateUserSchema = Joi.object({
  email: Joi.string().email(),
  phone: Joi.string().pattern(/^\d{10}$/).messages({
    "string.pattern.base": "Phone number must be exactly 10 digits",
  }),
  fullName: Joi.string().min(3).max(100).messages({
    "string.min": "Full name must be at least 3 characters",
    "string.max": "Full name must not exceed 100 characters",
  }),
  role: Joi.forbidden(),
  status: Joi.forbidden(),
}).min(1);

const changeRoleUserSchema = Joi.object({
  role: Joi.string()
    .valid("admin", "driver", "dispatcher", "warehouse_staff", "customer")
    .required(),
  driverData: Joi.object({
    warehouseId: Joi.string().pattern(objectIdPattern).required().messages({
      "string.pattern.base": "Warehouse ID must be a valid MongoDB ObjectId",
      "any.required": "Warehouse ID is required",
    }),
    idCardNumber: Joi.string().required(),
    dateOfBirth: Joi.date().required(),
    gender: Joi.string().valid("male", "female", "other").required(),
    address: Joi.string().required(),
    licenseNumber: Joi.string().required(),
    licenseType: Joi.string().required(),
    licenseExpiryDate: Joi.date().greater("now").required(),
    hiredDate: Joi.date().optional(),
  }).when("role", {
    is: "driver",
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),

  staffData: Joi.object({
    warehouseId: Joi.string().pattern(objectIdPattern).required().messages({
      "string.pattern.base": "Warehouse ID must be a valid MongoDB ObjectId",
      "any.required": "Warehouse ID is required",
    }),
  }).when("role", {
    is: "warehouse_staff",
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),

  dispatcherData: Joi.object({
    warehouseId: Joi.string().pattern(objectIdPattern).required().messages({
      "string.pattern.base": "Warehouse ID must be a valid MongoDB ObjectId",
      "any.required": "Warehouse ID is required",
    }),
  }).when("role", {
    is: "dispatcher",
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
});

const changeStatusUserSchema = Joi.object({
  status: Joi.string().valid("active", "inactive", "locked").required(),
});

const resetPasswordSchema = Joi.object({
  newPassword: Joi.string().min(6).max(24).required().messages({
    "string.min": "Password must be at least 6 characters",
    "string.max": "Password must be at most 24 characters",
    "string.required": "New password is required",
  }),
});

const paramUserIdSchema = Joi.object({
  userId: Joi.string().pattern(objectIdPattern).required().messages({
    "string.pattern.base": "User ID must be a valid MongoDB ObjectId",
    "any.required": "User ID is required",
  }),
});

const queryUserSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  keyword: Joi.string().trim().allow(""),
  role: Joi.string().valid(
    "admin",
    "driver",
    "dispatcher",
    "warehouse_staff",
    "customer",
  ),
  status: Joi.string().valid("active", "inactive", "locked"),
});

export default {
  createUserSchema,
  updateUserSchema,
  changeRoleUserSchema,
  changeStatusUserSchema,
  resetPasswordSchema,
  paramUserIdSchema,
  queryUserSchema,
};
