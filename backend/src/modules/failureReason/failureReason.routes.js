import express from "express";

import authorize from "../../middlewares/authorize.middleware.js";
import validate from "../../middlewares/validate.middleware.js";

import ROLES from "../../constants/roles.js";

import failureReasonValidator from "./failureReason.validator.js";
import failureReasonController from "./failureReason.controller.js";

const failureReasonRouter = express.Router();

failureReasonRouter.post(
  "/",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.DRIVER),
  validate(failureReasonValidator.createFailureReasonSchema),
  failureReasonController.create,
);

failureReasonRouter.get(
  "/stats",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  validate(failureReasonValidator.statsQuerySchema, "query"),
  failureReasonController.getStatsByFailureType,
);

failureReasonRouter.get(
  "/",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.DRIVER),
  validate(failureReasonValidator.getAllFailureReasonsSchema, "query"),
  failureReasonController.getAll,
);

failureReasonRouter.get(
  "/order/:orderId",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.DRIVER, ROLES.CUSTOMER),
  validate(failureReasonValidator.paramOrderIdSchema, "params"),
  validate(failureReasonValidator.queryPaginationSchema, "query"),
  failureReasonController.getByOrderId,
);

failureReasonRouter.get(
  "/trip/:tripId",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.DRIVER),
  validate(failureReasonValidator.paramTripIdSchema, "params"),
  validate(failureReasonValidator.queryPaginationSchema, "query"),
  failureReasonController.getByTripId,
);

failureReasonRouter.get(
  "/:failureReasonId",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.DRIVER),
  validate(failureReasonValidator.getByIdSchema, "params"),
  failureReasonController.getById,
);

failureReasonRouter.patch(
  "/:failureReasonId",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  validate(failureReasonValidator.getByIdSchema, "params"),
  validate(failureReasonValidator.updateFailureReasonSchema),
  failureReasonController.updateById,
);

failureReasonRouter.delete(
  "/:failureReasonId",
  authorize(ROLES.ADMIN),
  validate(failureReasonValidator.getByIdSchema, "params"),
  failureReasonController.deleteById,
);

export default failureReasonRouter;
