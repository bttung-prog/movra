import express from "express";

import authorize from "../../middlewares/authorize.middleware.js";
import validate from "../../middlewares/validate.middleware.js";
import {
  uploadPod,
  validatePodImage,
} from "../../middlewares/upload.middleware.js";

import ROLES from "../../constants/roles.js";

import orderValidator from "./order.validator.js";
import orderController from "./order.controller.js";

const orderRouter = express.Router();

// ==========================================
// PUBLIC ROUTES (Login require)
// ==========================================
orderRouter.get(
  "/public/tracking/:orderCode",
  validate(orderValidator.paramOrderCodeSchema, "params"),
  orderController.getPublicTracking,
);

// ==========================================
// PROTECTED ROUTES (Login no require)
// ==========================================
orderRouter.post(
  "/",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.CUSTOMER),
  validate(orderValidator.createOrderSchema),
  orderController.create,
);

orderRouter.get(
  "/stats",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  orderController.getStatsByStatus,
);

orderRouter.get(
  "/my-orders",
  authorize(ROLES.CUSTOMER),
  validate(orderValidator.queryOrderSchema, "query"),
  orderController.getMyOrders,
);

orderRouter.get(
  "/trip/:tripId",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.DRIVER),
  validate(orderValidator.paramTripIdSchema, "params"),
  validate(orderValidator.queryOrderSchema, "query"),
  orderController.getByTripId,
);

orderRouter.post(
  "/assign-trip",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  validate(orderValidator.assignOrdersSchema),
  orderController.assignOrdersToTrip,
);

orderRouter.post(
  "/unassign-trip",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  validate(orderValidator.unassignOrdersSchema),
  orderController.unassignOrdersFromTrip,
);

orderRouter.post(
  "/:orderId/pickup",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.DRIVER),
  validate(orderValidator.paramOrderIdSchema, "params"),
  validate(orderValidator.pickupConfirmationSchema),
  orderController.confirmPickup,
);

orderRouter.post(
  "/:orderId/delivered",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.DRIVER),
  validate(orderValidator.paramOrderIdSchema, "params"),
  uploadPod.single("podImage"),
  validatePodImage,
  validate(orderValidator.markAsDeliveredSchema),
  orderController.markAsDelivered,
);

orderRouter.post(
  "/:orderId/cancel",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.CUSTOMER),
  validate(orderValidator.paramOrderIdSchema, "params"),
  validate(orderValidator.cancelOrderSchema),
  orderController.cancelOrder,
);

orderRouter.get(
  "/code/:orderCode",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.DRIVER, ROLES.CUSTOMER),
  validate(orderValidator.paramOrderCodeSchema, "params"),
  orderController.getByCode,
);

orderRouter.get(
  "/:orderId/tracking-logs/latest",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.DRIVER, ROLES.CUSTOMER),
  validate(orderValidator.paramOrderIdSchema, "params"),
  orderController.getLatestTrackingLog,
);

orderRouter.get(
  "/:orderId/tracking-logs",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.DRIVER, ROLES.CUSTOMER),
  validate(orderValidator.paramOrderIdSchema, "params"),
  validate(orderValidator.queryTrackingLogSchema, "query"),
  orderController.getTrackingLogsByOrderId,
);

orderRouter.post(
  "/:orderId/tracking-logs",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.DRIVER),
  validate(orderValidator.paramOrderIdSchema, "params"),
  validate(orderValidator.createTrackingLogSchema),
  orderController.addTrackingLog,
);

orderRouter.get(
  "/:orderId",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER, ROLES.DRIVER, ROLES.CUSTOMER),
  validate(orderValidator.paramOrderIdSchema, "params"),
  orderController.getById,
);

orderRouter.get(
  "/",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  validate(orderValidator.queryOrderSchema, "query"),
  orderController.getAll,
);

orderRouter.patch(
  "/:orderId",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  validate(orderValidator.paramOrderIdSchema, "params"),
  validate(orderValidator.updateOrderSchema),
  orderController.updateById,
);

orderRouter.delete(
  "/:orderId",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  validate(orderValidator.paramOrderIdSchema, "params"),
  orderController.deleteById,
);

export default orderRouter;
