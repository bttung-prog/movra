import express from "express";

import authorize from "../../middlewares/authorize.middleware.js";
import validate from "../../middlewares/validate.middleware.js";

import ROLES from "../../constants/roles.js";

import codSettlementValidator from "./codSettlement.validator.js";
import codSettlementController from "./codSettlement.controller.js";

const codSettlementRouter = express.Router();

codSettlementRouter.post(
  "/generate",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  validate(codSettlementValidator.generateSettlementSchema),
  codSettlementController.generate,
);

codSettlementRouter.patch(
  "/:id/confirm",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  validate(codSettlementValidator.paramIdSchema, "params"),
  codSettlementController.confirm,
);

codSettlementRouter.post(
  "/:id/complete",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  validate(codSettlementValidator.paramIdSchema, "params"),
  validate(codSettlementValidator.completeSettlementSchema),
  codSettlementController.complete,
);

codSettlementRouter.post(
  "/:id/cancel",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  validate(codSettlementValidator.paramIdSchema, "params"),
  validate(codSettlementValidator.cancelSettlementSchema),
  codSettlementController.cancel,
);

codSettlementRouter.get(
  "/my-settlements",
  authorize(ROLES.CUSTOMER),
  validate(codSettlementValidator.querySettlementSchema, "query"),
  codSettlementController.getMySettlements,
);

codSettlementRouter.get(
  "/code/:code",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.CUSTOMER),
  codSettlementController.getByCode,
);

codSettlementRouter.get(
  "/:id",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.CUSTOMER),
  validate(codSettlementValidator.paramIdSchema, "params"),
  codSettlementController.getById,
);

codSettlementRouter.get(
  "/",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  validate(codSettlementValidator.querySettlementSchema, "query"),
  codSettlementController.getAll,
);

export default codSettlementRouter;
