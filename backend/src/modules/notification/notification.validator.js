import Joi from "joi";

const objectId = Joi.string()
  .regex(/^[0-9a-fA-F]{24}$/)
  .messages({
    "string.pattern.base": "Invalid ID format",
    "any.required": "ID is required",
  });

const queryNotificationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  isRead: Joi.boolean().optional(),
});

const paramNotificationIdSchema = Joi.object({
  id: objectId.required().messages({
    "any.required": "Notification ID is required",
  }),
});

export default {
  objectId,
  queryNotificationSchema,
  paramNotificationIdSchema,
  paramIdSchema: paramNotificationIdSchema,
};
