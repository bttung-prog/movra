import express from "express";

import validate from "../../middlewares/validate.middleware.js";

import notificationValidator from "./notification.validator.js";
import notificationController from "./notification.controller.js";

const notificationRouter = express.Router();

notificationRouter.get(
  "/",
  validate(notificationValidator.queryNotificationSchema, "query"),
  notificationController.getMyNotifications,
);

notificationRouter.patch("/read-all", notificationController.markAllAsRead);

notificationRouter.patch(
  "/:id/read",
  validate(notificationValidator.paramNotificationIdSchema, "params"),
  notificationController.markAsRead,
);

export default notificationRouter;
