import Joi from "joi";

const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Email must be a valid email",
    "string.required": "Email is required",
  }),

  password: Joi.string().min(6).max(24).required().messages({
    "string.min": "Password must be at least 6 characters",
    "string.max": "Password must be at most 24 characters",
    "string.required": "Password is required",
  }),

  phone: Joi.string()
    .pattern(/^\d{10}$/)
    .required()
    .messages({
      "string.pattern.base": "Phone number must be exactly 10 digits",
      "string.required": "Phone is required",
      "string.empty": "Phone is required",
    }),

  fullName: Joi.string().required().messages({
    "string.required": "Full name is required",
    "string.empty": "Full name is required",
  }),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Email must be a valid email",
    "string.required": "Email is required",
  }),

  password: Joi.string().min(6).max(24).required().messages({
    "string.min": "Password must be at least 6 characters",
    "string.max": "Password must be at most 24 characters",
    "string.required": "Password is required",
  }),
});

export default {
  registerSchema,
  loginSchema,
};
