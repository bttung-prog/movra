import express from "express";

import authorize from "../../middlewares/authorize.middleware.js";
import validate from "../../middlewares/validate.middleware.js";

import ROLES from "../../constants/roles.js";

import receiptValidator from "./receipt.validator.js";
import receiptController from "./receipt.controller.js";

const receiptRouter = express.Router();

receiptRouter.post(
  "/",
  authorize(ROLES.ADMIN, ROLES.WAREHOUSE_STAFF),
  validate(receiptValidator.createReceiptSchema),
  receiptController.create,
);

receiptRouter.get(
  "/",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.WAREHOUSE_STAFF),
  validate(receiptValidator.queryReceiptSchema, "query"),
  receiptController.getAll,
);

receiptRouter.get(
  "/code/:receiptCode",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.WAREHOUSE_STAFF),
  validate(receiptValidator.paramReceiptCodeSchema, "params"),
  receiptController.getByCode,
);

receiptRouter.get(
  "/order/:orderId",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.WAREHOUSE_STAFF),
  validate(receiptValidator.paramOrderIdSchema, "params"),
  receiptController.getByOrderId,
);

receiptRouter.get(
  "/:receiptId",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.WAREHOUSE_STAFF),
  validate(receiptValidator.paramReceiptIdSchema, "params"),
  receiptController.getById,
);

receiptRouter.patch(
  "/:receiptId/cancel",
  authorize(ROLES.ADMIN, ROLES.WAREHOUSE_STAFF),
  validate(receiptValidator.paramReceiptIdSchema, "params"),
  validate(receiptValidator.cancelReceiptSchema),
  receiptController.cancel,
);

receiptRouter.patch(
  "/:receiptId",
  authorize(ROLES.ADMIN, ROLES.WAREHOUSE_STAFF),
  validate(receiptValidator.paramReceiptIdSchema, "params"),
  validate(receiptValidator.updateReceiptSchema),
  receiptController.updateById,
);

export default receiptRouter;
