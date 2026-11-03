import express from "express";

import authorize from "../../middlewares/authorize.middleware.js";
import validate from "../../middlewares/validate.middleware.js";

import ROLES from "../../constants/roles.js";

import invoiceValidator from "./invoice.validator.js";
import invoiceController from "./invoice.controller.js";

const invoiceRouter = express.Router();

invoiceRouter.post(
  "/",
  authorize(ROLES.ADMIN, ROLES.ACCOUNTANT),
  validate(invoiceValidator.createInvoiceSchema),
  invoiceController.create,
);

invoiceRouter.get(
  "/stats",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.ACCOUNTANT),
  invoiceController.getStats,
);

invoiceRouter.get(
  "/my-invoices",
  authorize(ROLES.CUSTOMER),
  validate(invoiceValidator.queryInvoiceSchema, "query"),
  invoiceController.getMyInvoices,
);

invoiceRouter.get(
  "/code/:invoiceCode",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.ACCOUNTANT, ROLES.CUSTOMER),
  invoiceController.getByCode,
);

invoiceRouter.get(
  "/:invoiceId",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.ACCOUNTANT, ROLES.CUSTOMER),
  validate(invoiceValidator.paramInvoiceIdSchema, "params"),
  invoiceController.getById,
);

invoiceRouter.get(
  "/",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.ACCOUNTANT),
  validate(invoiceValidator.queryInvoiceSchema, "query"),
  invoiceController.getAll,
);

invoiceRouter.patch(
  "/:invoiceId/issue",
  authorize(ROLES.ADMIN, ROLES.ACCOUNTANT),
  validate(invoiceValidator.paramInvoiceIdSchema, "params"),
  invoiceController.issue,
);

invoiceRouter.patch(
  "/:invoiceId/cancel",
  authorize(ROLES.ADMIN, ROLES.ACCOUNTANT),
  validate(invoiceValidator.paramInvoiceIdSchema, "params"),
  validate(invoiceValidator.cancelInvoiceSchema),
  invoiceController.cancel,
);

invoiceRouter.patch(
  "/:invoiceId",
  authorize(ROLES.ADMIN, ROLES.ACCOUNTANT),
  validate(invoiceValidator.paramInvoiceIdSchema, "params"),
  validate(invoiceValidator.updateInvoiceSchema),
  invoiceController.updateById,
);

export default invoiceRouter;
