import Joi from "joi";
import { SETTLEMENT_STATUSES, PAYOUT_METHODS } from "./codSettlement.js";
import { COD_SETTLEMENT_MESSAGES } from "../../constants/messages.js";

const objectId = Joi.string()
  .regex(/^[0-9a-fA-F]{24}$/)
  .messages({
    "string.pattern.base": COD_SETTLEMENT_MESSAGES.INVALID_ID,
    "any.required": COD_SETTLEMENT_MESSAGES.ID_REQUIRED,
  });

const generateSettlementSchema = Joi.object({
  orderId: objectId.required().messages({
    "any.required": COD_SETTLEMENT_MESSAGES.ORDER_ID_REQUIRED,
  }),
  payoutMethod: Joi.string()
    .valid(...Object.values(PAYOUT_METHODS))
    .default(PAYOUT_METHODS.WALLET),
  bankDetails: Joi.when("payoutMethod", {
    is: PAYOUT_METHODS.BANK_TRANSFER,
    then: Joi.object({
      bankName: Joi.string().trim().required(),
      accountNumber: Joi.string().trim().required(),
      accountHolder: Joi.string().trim().required(),
    }).required(),
    otherwise: Joi.object({
      bankName: Joi.string().trim().required(),
      accountNumber: Joi.string().trim().required(),
      accountHolder: Joi.string().trim().required(),
    }).optional(),
  }),
  notes: Joi.string().trim().allow("").optional(),
});

const completeSettlementSchema = Joi.object({
  notes: Joi.string().trim().allow("").optional(),
  bankTransferReference: Joi.string().trim().max(100).optional(),
});

const cancelSettlementSchema = Joi.object({
  reason: Joi.string().trim().required().messages({
    "any.required": COD_SETTLEMENT_MESSAGES.CANCEL_REASON_REQUIRED,
    "string.empty": COD_SETTLEMENT_MESSAGES.CANCEL_REASON_EMPTY,
  }),
});

const querySettlementSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  customerId: objectId.optional(),
  status: Joi.string()
    .valid(...Object.values(SETTLEMENT_STATUSES))
    .optional(),
  payoutMethod: Joi.string()
    .valid(...Object.values(PAYOUT_METHODS))
    .optional(),
  startDate: Joi.date().iso().raw().optional(),
  endDate: Joi.date().iso().raw().optional(),
});

const paramIdSchema = Joi.object({
  id: objectId.required(),
});

export default {
  generateSettlementSchema,
  completeSettlementSchema,
  cancelSettlementSchema,
  querySettlementSchema,
  paramIdSchema,
};
