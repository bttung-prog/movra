import Joi from "joi";

const emailField = Joi.string().trim().lowercase().email().required().messages({
  "string.email": "Email must be a valid email",
  "string.required": "Email is required",
});

const otpField = Joi.string()
  .trim()
  .pattern(/^\d{8}$/)
  .required()
  .messages({
    "string.pattern.base": "OTP must be exactly 8 digits",
    "string.required": "OTP is required",
  });

const registerSchema = Joi.object({
  email: emailField,

  password: Joi.string().min(6).max(24).required().messages({
    "string.min": "Password must be at least 6 characters",
    "string.max": "Password must be at most 24 characters",
    "string.required": "Password is required",
  }),

  phone: Joi.string()
    .trim()
    .pattern(/^\d{10}$/)
    .required()
    .messages({
      "string.pattern.base": "Phone number must be exactly 10 digits",
      "string.required": "Phone is required",
      "string.empty": "Phone is required",
    }),

  fullName: Joi.string().trim().min(2).max(100).required().messages({
    "string.min": "Full name must be at least 2 characters",
    "string.max": "Full name must not exceed 100 characters",
    "string.required": "Full name is required",
    "string.empty": "Full name is required",
  }),
});

const loginSchema = Joi.object({
  email: emailField,

  password: Joi.string().min(6).max(24).required().messages({
    "string.min": "Password must be at least 6 characters",
    "string.max": "Password must be at most 24 characters",
    "string.required": "Password is required",
  }),
});

const verifyRegisterOtpSchema = Joi.object({
  email: emailField,
  otp: otpField,
});

const requestPasswordResetOtpSchema = Joi.object({
  email: emailField,
});

const resetPasswordSchema = Joi.object({
  email: emailField,
  otp: otpField,
  newPassword: Joi.string().min(6).max(24).required().messages({
    "string.min": "Password must be at least 6 characters",
    "string.max": "Password must be at most 24 characters",
    "string.required": "New password is required",
  }),
});

const changePasswordSchema = Joi.object({
  oldPassword: Joi.string().required().messages({
    "any.required": "Old password is required",
  }),
  newPassword: Joi.string().min(6).max(24).required().messages({
    "string.min": "Password must be at least 6 characters",
    "string.max": "Password must be at most 24 characters",
    "any.required": "New password is required",
  }),
});

export default {
  registerSchema,
  verifyRegisterOtpSchema,
  loginSchema,
  requestPasswordResetOtpSchema,
  resetPasswordSchema,
  changePasswordSchema,
};
