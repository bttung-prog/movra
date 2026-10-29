import express from "express";

import authorize from "../../middlewares/authorize.middleware.js";
import validate from "../../middlewares/validate.middleware.js";

import ROLES from "../../constants/roles.js";

import feedbackValidator from "./feedback.validator.js";
import feedbackController from "./feedback.controller.js";

const feedbackRouter = express.Router();

feedbackRouter.post(
  "/",
  authorize(ROLES.CUSTOMER),
  validate(feedbackValidator.createFeedbackSchema),
  feedbackController.create,
);

feedbackRouter.post(
  "/:id/reply",
  authorize(ROLES.ADMIN, ROLES.DRIVER),
  validate(feedbackValidator.paramIdSchema, "params"),
  validate(feedbackValidator.driverResponseSchema),
  feedbackController.reply,
);

feedbackRouter.get(
  "/order/:orderId",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.DRIVER, ROLES.CUSTOMER),
  validate(feedbackValidator.paramOrderIdSchema, "params"),
  feedbackController.getByOrderId,
);

feedbackRouter.get(
  "/:id",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.DRIVER, ROLES.CUSTOMER),
  validate(feedbackValidator.paramIdSchema, "params"),
  feedbackController.getById,
);

feedbackRouter.get(
  "/",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.DRIVER, ROLES.CUSTOMER),
  validate(feedbackValidator.queryFeedbackSchema, "query"),
  feedbackController.getAll,
);

export default feedbackRouter;
