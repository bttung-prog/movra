import Joi from "joi";

const updateMeSchema = Joi.object({
  phone: Joi.string().pattern(/^\d{10}$/).messages({
    "string.pattern.base": "Phone number must be exactly 10 digits",
  }),
  fullName: Joi.string().min(3).max(100).messages({
    "string.min": "Full name must be at least 3 characters",
    "string.max": "Full name must not exceed 100 characters",
  }),
}).min(1);

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

export default { updateMeSchema, changePasswordSchema };
