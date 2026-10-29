import Joi from "joi";

import PAYMENT_METHODS from "../../constants/paymentMethods.js";
import { WALLET_TRANSACTION_TYPES } from "../../constants/walletTransactionTypes.js";
import { WALLET_TRANSACTION_STATUSES } from "../../constants/walletTransactionStatuses.js";

const objectId = Joi.string()
  .regex(/^[0-9a-fA-F]{24}$/)
  .messages({
    "string.pattern.base": "Invalid ID format",
    "any.required": "ID is required",
  });

const moneyAmount = () =>
  Joi.number().integer().min(1).max(Number.MAX_SAFE_INTEGER).messages({
    "number.integer": "Amount must be an integer",
    "number.min": "Amount must be greater than 0",
    "number.max": "Amount exceeds allowed limit",
  });

const topUpSchema = Joi.object({
  amount: moneyAmount().required().messages({
    "any.required": "Top-up amount is required",
    "number.min": "Top-up amount must be greater than 0",
  }),
  paymentMethod: Joi.string()
    .valid(PAYMENT_METHODS.BANK, PAYMENT_METHODS.E_WALLET)
    .default(PAYMENT_METHODS.BANK),
  transactionReference: Joi.string().trim().min(1).required(),
  proofUrl: Joi.string().trim().uri().allow("").optional(),
  notes: Joi.string().trim().allow("").optional(),
});

const adjustmentSchema = Joi.object({
  customerId: objectId.required(),
  amount: moneyAmount().required(),
  direction: Joi.string().valid("credit", "debit").required(),
  reason: Joi.string().trim().min(1).max(500).required(),
});

const queryWalletTransactionSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  type: Joi.string()
    .valid(...Object.values(WALLET_TRANSACTION_TYPES))
    .optional(),
  status: Joi.string()
    .valid(...Object.values(WALLET_TRANSACTION_STATUSES))
    .optional(),
  customerId: objectId.optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
});

const paramIdSchema = Joi.object({
  id: objectId.required(),
});

const paramCodeSchema = Joi.object({
  code: Joi.string().trim().required().messages({
    "any.required": "Transaction code is required",
    "string.empty": "Transaction code cannot be empty",
  }),
});

export default {
  topUpSchema,
  adjustmentSchema,
  queryWalletTransactionSchema,
  paramIdSchema,
  paramCodeSchema,
};
