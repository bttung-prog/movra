import Joi from "joi";

import INVOICE_STATUSES from "../../constants/invoiceStatuses.js";

const objectId = Joi.string()
  .regex(/^[0-9a-fA-F]{24}$/)
  .messages({
    "string.pattern.base": "Invalid ID format",
    "any.required": "ID is required",
  });

const invoiceStatusEnum = Object.values(INVOICE_STATUSES);
const paymentTermsEnum = ["immediate", "net_15", "net_30"];
const moneyAmount = () =>
  Joi.number().integer().min(0).max(Number.MAX_SAFE_INTEGER).messages({
    "number.integer": "Amount must be an integer",
    "number.max": "Amount exceeds allowed limit",
  });

const invoiceItemSchema = Joi.object({
  description: Joi.string().trim().required().messages({
    "any.required": "Fee description is required",
    "string.empty": "Fee description cannot be empty",
  }),
  quantity: Joi.number()
    .integer()
    .min(1)
    .max(Number.MAX_SAFE_INTEGER)
    .default(1),
  unitPrice: moneyAmount().required().messages({
    "any.required": "Unit price is required",
  }),
  amount: moneyAmount().required().messages({
    "any.required": "Amount is required",
  }),
});

const createInvoiceSchema = Joi.object({
  orderId: objectId.optional(),
  customerId: objectId.optional(),
  subTotal: moneyAmount().optional(),
  tax: moneyAmount().default(0),
  discount: moneyAmount().default(0),
  dueDate: Joi.date().iso().optional(),
  paymentTerms: Joi.string()
    .valid(...paymentTermsEnum)
    .default("immediate"),
  items: Joi.array().items(invoiceItemSchema).optional(),
  notes: Joi.string().trim().allow("").optional(),
}).or("orderId", "customerId");

const updateInvoiceSchema = Joi.object({
  subTotal: moneyAmount().optional(),
  tax: moneyAmount().optional(),
  discount: moneyAmount().optional(),
  dueDate: Joi.date().iso().optional(),
  paymentTerms: Joi.string()
    .valid(...paymentTermsEnum)
    .optional(),
  items: Joi.array().items(invoiceItemSchema).optional(),
  notes: Joi.string().trim().allow("").optional(),
}).min(1);

const queryInvoiceSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().trim().max(100).allow("").optional(),
  status: Joi.string()
    .valid(...invoiceStatusEnum)
    .optional(),
  customerId: objectId.optional(),
  orderId: objectId.optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  isOverdue: Joi.boolean().optional(),
});

const paramInvoiceIdSchema = Joi.object({
  invoiceId: objectId.required(),
});

const cancelInvoiceSchema = Joi.object({
  reason: Joi.string().trim().required().messages({
    "any.required": "Cancellation reason is required",
    "string.empty": "Cancellation reason cannot be empty",
  }),
});

export default {
  createInvoiceSchema,
  updateInvoiceSchema,
  queryInvoiceSchema,
  paramInvoiceIdSchema,
  cancelInvoiceSchema,
};
