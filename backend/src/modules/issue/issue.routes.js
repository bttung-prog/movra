import express from "express";

import authorize from "../../middlewares/authorize.middleware.js";
import validate from "../../middlewares/validate.middleware.js";

import ROLES from "../../constants/roles.js";

import issueValidator from "./issue.validator.js";
import issueController from "./issue.controller.js";

const issueRouter = express.Router();

issueRouter.post(
  "/",
  authorize(ROLES.ADMIN, ROLES.WAREHOUSE_STAFF),
  validate(issueValidator.createIssueSchema),
  issueController.create,
);

issueRouter.get(
  "/",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.WAREHOUSE_STAFF),
  validate(issueValidator.queryIssueSchema, "query"),
  issueController.getAll,
);

issueRouter.get(
  "/code/:issueCode",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.WAREHOUSE_STAFF),
  validate(issueValidator.paramIssueCodeSchema, "params"),
  issueController.getByCode,
);

issueRouter.get(
  "/order/:orderId",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.WAREHOUSE_STAFF),
  validate(issueValidator.paramOrderIdSchema, "params"),
  issueController.getByOrderId,
);

issueRouter.get(
  "/trip/:tripId",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.WAREHOUSE_STAFF, ROLES.DRIVER),
  validate(issueValidator.paramTripIdSchema, "params"),
  validate(issueValidator.queryTripIssueSchema, "query"),
  issueController.getByTripId,
);

issueRouter.get(
  "/:issueId",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.WAREHOUSE_STAFF),
  validate(issueValidator.paramIssueIdSchema, "params"),
  issueController.getById,
);

issueRouter.patch(
  "/:issueId/cancel",
  authorize(ROLES.ADMIN, ROLES.WAREHOUSE_STAFF),
  validate(issueValidator.paramIssueIdSchema, "params"),
  validate(issueValidator.cancelIssueSchema),
  issueController.cancel,
);

issueRouter.patch(
  "/:issueId",
  authorize(ROLES.ADMIN, ROLES.WAREHOUSE_STAFF),
  validate(issueValidator.paramIssueIdSchema, "params"),
  validate(issueValidator.updateNoteSchema),
  issueController.updateNote,
);

export default issueRouter;
