import Joi from "joi";

import PAYMENT_STATUSES from "../../constants/paymentStatuses.js";
import PAYMENT_METHODS, {
  PAYER_TYPES,
} from "../../constants/paymentMethods.js";

const objectId = Joi.string()
  .regex(/^[0-9a-fA-F]{24}$/)
  .messages({
    "string.pattern.base": "Invalid ID format",
    "any.required": "ID is required",
  });

const paymentStatusEnum = Object.values(PAYMENT_STATUSES);
const paymentMethodEnum = Object.values(PAYMENT_METHODS);
const payerTypeEnum = Object.values(PAYER_TYPES);
const moneyAmount = () =>
  Joi.number().integer().min(0).max(Number.MAX_SAFE_INTEGER).messages({
    "number.integer": "Amount must be an integer",
    "number.max": "Amount exceeds allowed limit",
  });

const createPaymentSchema = Joi.object({
  invoiceId: objectId.optional(),
  orderId: objectId.optional(),
  payerType: Joi.string()
    .valid(...payerTypeEnum)
    .default(PAYER_TYPES.CUSTOMER),
  paymentAmount: moneyAmount().positive().required().messages({
    "any.required": "Payment amount is required",
    "number.positive": "Payment amount must be greater than 0",
  }),
  paymentMethod: Joi.string()
    .valid(...paymentMethodEnum)
    .required()
    .messages({
      "any.required": "Payment method is required",
    }),
  transactionReference: Joi.string().trim().allow("").optional(),
  proofUrl: Joi.string().trim().uri().allow("").optional(),
  notes: Joi.string().trim().allow("").optional(),
  isImmediateVerify: Joi.boolean().optional(),
}).or("invoiceId", "orderId");

const driverRemitSchema = Joi.object({
  tripId: objectId.optional(),
  orderIds: Joi.array().items(objectId).min(1).optional(),
  orders: Joi.array()
    .min(1)
    .items(
      Joi.object({
        orderId: objectId.required(),
        collectedAmount: moneyAmount().optional(),
      }),
    )
    .optional(),
  paymentAmount: moneyAmount().positive().required().messages({
    "any.required": "Remittance amount is required",
    "number.positive": "Remittance amount must be greater than 0",
  }),
  paymentMethod: Joi.string().valid("cash", "bank").required().messages({
    "any.required": "Payment method is required",
  }),
  transactionReference: Joi.string().trim().allow("").optional(),
  proofUrl: Joi.string().trim().uri().allow("").optional(),
  notes: Joi.string().trim().allow("").optional(),
}).or("orderIds", "orders");

const verifyPaymentSchema = Joi.object({
  status: Joi.string().valid("completed", "failed").required().messages({
    "any.required": "Approval status is required",
    "any.only": "Approval status must be either completed or failed",
  }),
  notes: Joi.string().trim().allow("").optional(),
});

const refundPaymentSchema = Joi.object({
  reason: Joi.string().trim().required().messages({
    "any.required": "Refund reason is required",
    "string.empty": "Refund reason cannot be empty",
  }),
  refundAmount: moneyAmount().positive().optional(),
});

const queryPaymentSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().trim().allow("").optional(),
  paymentStatus: Joi.string()
    .valid(...paymentStatusEnum)
    .optional(),
  paymentMethod: Joi.string()
    .valid(...paymentMethodEnum)
    .optional(),
  payerType: Joi.string()
    .valid(...payerTypeEnum)
    .optional(),
  invoiceId: objectId.optional(),
  orderId: objectId.optional(),
  tripId: objectId.optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
});

const paramPaymentIdSchema = Joi.object({
  paymentId: objectId.required(),
});

export default {
  createPaymentSchema,
  driverRemitSchema,
  verifyPaymentSchema,
  refundPaymentSchema,
  queryPaymentSchema,
  paramPaymentIdSchema,
};
