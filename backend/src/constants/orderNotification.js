import { ORDER_STATUSES } from "./orderStatuses.js";

export const ORDER_NOTIFICATION_EVENTS = {
  PICKUP_FAILED: "PICKUP_FAILED",
  WAREHOUSE_HANDOFF: "WAREHOUSE_HANDOFF",
  TRIP_ORDER_FAILURES: "TRIP_ORDER_FAILURES",
};

export const CUSTOMER_FACING_ORDER_STATUSES = new Set([
  ORDER_STATUSES.PICKUP_SCHEDULED,
  ORDER_STATUSES.PICKED_UP,
  ORDER_STATUSES.TRANSPORTING,
  ORDER_STATUSES.OUT_FOR_DELIVERY,
  ORDER_STATUSES.DELIVERY_SCHEDULED,
  ORDER_STATUSES.FAILED,
  ORDER_STATUSES.RETURNED,
  ORDER_STATUSES.CANCELLED,
]);

export const DISPATCHER_ORDER_STATUSES = new Set([
  ORDER_STATUSES.FAILED,
  ORDER_STATUSES.RETURNED,
]);

export const ORDER_STATUS_NOTIFICATION_TEMPLATES = {
  [ORDER_STATUSES.PICKUP_SCHEDULED]: {
    title: "Đơn hàng đã được lên lịch lấy",
    message: (order) =>
      `Đơn hàng #${order.orderCode} đã được lên lịch lấy hàng.`,
  },

  [ORDER_STATUSES.PICKED_UP]: {
    title: "Đã lấy hàng thành công",
    message: (order) => `Đơn hàng #${order.orderCode} đã được lấy thành công.`,
  },

  [ORDER_STATUSES.TRANSPORTING]: {
    title: "Đơn hàng đang vận chuyển",
    message: (order) =>
      `Đơn hàng #${order.orderCode} đang trên đường vận chuyển.`,
  },

  [ORDER_STATUSES.OUT_FOR_DELIVERY]: {
    title: "Đơn hàng đang được giao",
    message: (order) =>
      `Đơn hàng #${order.orderCode} đang được giao đến người nhận.`,
  },

  [ORDER_STATUSES.DELIVERY_SCHEDULED]: {
    title: "Đơn hàng đã được lên lịch giao",
    message: (order) =>
      `Đơn hàng #${order.orderCode} đã được lên lịch giao hàng.`,
  },

  [ORDER_STATUSES.FAILED]: {
    title: "Giao hàng thất bại",
    message: (order, { notes } = {}) =>
      `Đơn hàng #${order.orderCode} giao không thành công.` +
      (notes ? ` Lý do: ${notes}` : ""),
  },

  [ORDER_STATUSES.RETURNED]: {
    title: "Đơn hàng chuyển hoàn",
    message: (order, { notes } = {}) =>
      `Đơn hàng #${order.orderCode} đã chuyển sang trạng thái chuyển hoàn.` +
      (notes ? ` Lý do: ${notes}` : ""),
  },

  [ORDER_STATUSES.CANCELLED]: {
    title: "Đơn hàng đã bị hủy",
    message: (order, { notes } = {}) =>
      `Đơn hàng #${order.orderCode} đã bị hủy.` +
      (notes ? ` Lý do: ${notes}` : ""),
  },

  [ORDER_NOTIFICATION_EVENTS.PICKUP_FAILED]: {
    title: "Lấy hàng thất bại",
    message: (order, { notes } = {}) =>
      `Đơn hàng #${order.orderCode} chưa thể lấy được.` +
      (notes ? ` Lý do: ${notes}` : ""),
  },
};
