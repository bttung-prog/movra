import express from "express";

import authorize from "../../middlewares/authorize.middleware.js";
import validate from "../../middlewares/validate.middleware.js";

import ROLES from "../../constants/roles.js";

import paymentValidator from "./payment.validator.js";
import paymentController from "./payment.controller.js";

const paymentRouter = express.Router();

paymentRouter.post(
  "/",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.CUSTOMER),
  validate(paymentValidator.createPaymentSchema),
  paymentController.create,
);

paymentRouter.post(
  "/driver-remit",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.DRIVER),
  validate(paymentValidator.driverRemitSchema),
  paymentController.driverRemit,
);

paymentRouter.patch(
  "/:paymentId/verify",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  validate(paymentValidator.paramPaymentIdSchema, "params"),
  validate(paymentValidator.verifyPaymentSchema),
  paymentController.verify,
);

paymentRouter.post(
  "/:paymentId/refund",
  authorize(ROLES.ADMIN),
  validate(paymentValidator.paramPaymentIdSchema, "params"),
  validate(paymentValidator.refundPaymentSchema),
  paymentController.refund,
);

paymentRouter.get(
  "/stats",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  paymentController.getStats,
);

paymentRouter.get(
  "/my-payments",
  authorize(ROLES.CUSTOMER, ROLES.DRIVER),
  validate(paymentValidator.queryPaymentSchema, "query"),
  paymentController.getMyPayments,
);

paymentRouter.get(
  "/code/:paymentCode",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.CUSTOMER, ROLES.DRIVER),
  paymentController.getByCode,
);

paymentRouter.get(
  "/:paymentId",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.CUSTOMER, ROLES.DRIVER),
  validate(paymentValidator.paramPaymentIdSchema, "params"),
  paymentController.getById,
);

paymentRouter.get(
  "/",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  validate(paymentValidator.queryPaymentSchema, "query"),
  paymentController.getAll,
);

export default paymentRouter;
