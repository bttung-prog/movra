export const VEHICLE_NOTIFICATION_EVENTS = {
  VEHICLE_REGISTRATION_EXPIRING: "VEHICLE_REGISTRATION_EXPIRING",
  VEHICLE_REGISTRATION_EXPIRED: "VEHICLE_REGISTRATION_EXPIRED",
  VEHICLE_INSURANCE_EXPIRING: "VEHICLE_INSURANCE_EXPIRING",
  VEHICLE_INSURANCE_EXPIRED: "VEHICLE_INSURANCE_EXPIRED",
};

const formatDate = (date) =>
  date ? new Date(date).toLocaleDateString("vi-VN") : "";

export const VEHICLE_NOTIFICATION_TEMPLATES = {
  [VEHICLE_NOTIFICATION_EVENTS.VEHICLE_REGISTRATION_EXPIRING]: {
    title: "Đăng kiểm xe sắp hết hạn",
    message: ({ vehicle, expiryDate, daysRemaining }) =>
      `Đăng kiểm của xe ${vehicle?.plateNumber || ""} sẽ hết hạn sau ${daysRemaining} ngày (${formatDate(expiryDate)}).`,
  },

  [VEHICLE_NOTIFICATION_EVENTS.VEHICLE_REGISTRATION_EXPIRED]: {
    title: "Đăng kiểm xe đã hết hạn",
    message: ({ vehicle, expiryDate }) =>
      `Đăng kiểm của xe ${vehicle?.plateNumber || ""} đã hết hạn từ ngày ${formatDate(expiryDate)}.`,
  },

  [VEHICLE_NOTIFICATION_EVENTS.VEHICLE_INSURANCE_EXPIRING]: {
    title: "Bảo hiểm xe sắp hết hạn",
    message: ({ vehicle, expiryDate, daysRemaining }) =>
      `Bảo hiểm của xe ${vehicle?.plateNumber || ""} sẽ hết hạn sau ${daysRemaining} ngày (${formatDate(expiryDate)}).`,
  },

  [VEHICLE_NOTIFICATION_EVENTS.VEHICLE_INSURANCE_EXPIRED]: {
    title: "Bảo hiểm xe đã hết hạn",
    message: ({ vehicle, expiryDate }) =>
      `Bảo hiểm của xe ${vehicle?.plateNumber || ""} đã hết hạn từ ngày ${formatDate(expiryDate)}.`,
  },
};
