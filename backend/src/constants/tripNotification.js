export const TRIP_NOTIFICATION_EVENTS = {
  TRIP_ASSIGNED: "TRIP_ASSIGNED",
  TRIP_REASSIGNED: "TRIP_REASSIGNED",
  TRIP_ORDERS_UPDATED: "TRIP_ORDERS_UPDATED",
};

export const TRIP_NOTIFICATION_TEMPLATES = {
  [TRIP_NOTIFICATION_EVENTS.TRIP_ASSIGNED]: {
    title: "Bạn được phân công chuyến mới",
    message: ({ trip, orderCount = 0 }) =>
      `Bạn đã được phân công chuyến ${trip.tripCode}.` +
      (orderCount > 0 ? ` Chuyến có ${orderCount} đơn hàng.` : ""),
  },

  [TRIP_NOTIFICATION_EVENTS.TRIP_REASSIGNED]: {
    title: "Chuyến xe đã được cập nhật",
    message: ({ trip, isNewDriver = false, vehicleChanged = false }) => {
      if (isNewDriver) {
        return `Bạn đã được phân công chuyến ${trip.tripCode}.`;
      }

      if (vehicleChanged) {
        return `Xe của chuyến ${trip.tripCode} đã được thay đổi.`;
      }

      return `Bạn đã được gỡ khỏi chuyến ${trip.tripCode}.`;
    },
  },

  [TRIP_NOTIFICATION_EVENTS.TRIP_ORDERS_UPDATED]: {
    title: "Danh sách đơn của chuyến đã thay đổi",
    message: ({ trip, action, orderCount = 0 }) =>
      action === "assigned"
        ? `Chuyến ${trip.tripCode} vừa được thêm ${orderCount} đơn hàng.`
        : `Chuyến ${trip.tripCode} vừa được gỡ ${orderCount} đơn hàng.`,
  },
};
