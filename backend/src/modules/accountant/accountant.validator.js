import Joi from "joi";

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

const createAccountantSchema = Joi.object({
  userId: Joi.string().pattern(objectIdPattern).required(),
});

const paramAccountantIdSchema = Joi.object({
  accountantId: Joi.string().pattern(objectIdPattern).required(),
});

const paramUserIdSchema = Joi.object({
  userId: Joi.string().pattern(objectIdPattern).required(),
});

const paramCodeSchema = Joi.object({
  accountantCode: Joi.string().required(),
});

const queryAccountantSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  status: Joi.string().valid("active", "inactive"),
});

const updateStatusSchema = Joi.object({
  status: Joi.string().valid("active", "inactive").required(),
});

export default {
  createAccountantSchema,
  paramAccountantIdSchema,
  paramUserIdSchema,
  paramCodeSchema,
  queryAccountantSchema,
  updateStatusSchema,
};
