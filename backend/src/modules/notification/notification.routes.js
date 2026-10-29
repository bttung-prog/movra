import express from "express";


import notificationController from "./notification.controller.js";

const notificationRouter = express.Router();

notificationRouter.get("/", notificationController.getMyNotifications);

notificationRouter.patch("/read-all", notificationController.markAllAsRead);

notificationRouter.patch("/:id/read", notificationController.markAsRead);

export default notificationRouter;
