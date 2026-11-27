export const MAINTENANCE_NOTIFICATION_EVENTS = {
  MAINTENANCE_STARTED: "MAINTENANCE_STARTED",
  MAINTENANCE_COMPLETED: "MAINTENANCE_COMPLETED",
  MAINTENANCE_EXITED: "MAINTENANCE_EXITED",
  MAINTENANCE_DUE_SOON: "MAINTENANCE_DUE_SOON",
  MAINTENANCE_OVERDUE: "MAINTENANCE_OVERDUE",
  MAINTENANCE_DUE_KM: "MAINTENANCE_DUE_KM",
  MAINTENANCE_OVERDUE_KM: "MAINTENANCE_OVERDUE_KM",
};

const formatDate = (date) =>
  date ? new Date(date).toLocaleDateString("vi-VN") : "";

const formatKm = (km) => Number(km || 0).toLocaleString("vi-VN");

export const MAINTENANCE_NOTIFICATION_TEMPLATES = {
  [MAINTENANCE_NOTIFICATION_EVENTS.MAINTENANCE_STARTED]: {
    title: "Phương tiện tiến hành bảo dưỡng",
    message: ({ vehicle }) =>
      `Phương tiện ${vehicle.plateNumber} đã được đưa vào bảo dưỡng.`,
  },

  [MAINTENANCE_NOTIFICATION_EVENTS.MAINTENANCE_COMPLETED]: {
    title: "Phương tiện hoàn tất bảo dưỡng",
    message: ({ vehicle }) =>
      `Phương tiện ${vehicle.plateNumber} đã hoàn tất bảo dưỡng và sẵn sàng hoạt động.`,
  },

  [MAINTENANCE_NOTIFICATION_EVENTS.MAINTENANCE_EXITED]: {
    title: "Phương tiện đã bảo dưỡng xong",
    message: ({ vehicle }) =>
      `Phương tiện ${vehicle.plateNumber} đã bảo dưỡng xong.`,
  },

  [MAINTENANCE_NOTIFICATION_EVENTS.MAINTENANCE_DUE_SOON]: {
    title: "Lịch bảo dưỡng sắp đến hạn",
    message: ({ schedule, vehicle, phase }) =>
      `Lịch ${schedule.taskName} của xe ${vehicle.plateNumber} sắp đến hạn` +
      (phase === "due_1d"
        ? ` vào ngày ${formatDate(schedule.nextDueDate)}.`
        : ` (còn khoảng 7 ngày, hạn ${formatDate(schedule.nextDueDate)}).`),
  },

  [MAINTENANCE_NOTIFICATION_EVENTS.MAINTENANCE_OVERDUE]: {
    title: "Lịch bảo dưỡng đã quá hạn",
    message: ({ schedule, vehicle }) =>
      `Lịch ${schedule.taskName} của xe ${vehicle.plateNumber} đã quá hạn từ ngày ${formatDate(schedule.nextDueDate)}.`,
  },

  [MAINTENANCE_NOTIFICATION_EVENTS.MAINTENANCE_DUE_KM]: {
    title: "Lịch bảo dưỡng sắp đến hạn theo km",
    message: ({ schedule, vehicle }) =>
      `Lịch ${schedule.taskName} của xe ${vehicle.plateNumber} sắp đến hạn theo km. Hiện tại: ${formatKm(vehicle.currentOdometer)} km, hạn: ${formatKm(schedule.nextDueKm)} km.`,
  },

  [MAINTENANCE_NOTIFICATION_EVENTS.MAINTENANCE_OVERDUE_KM]: {
    title: "Lịch bảo dưỡng đã quá hạn theo km",
    message: ({ schedule, vehicle }) =>
      `Lịch ${schedule.taskName} của xe ${vehicle.plateNumber} đã vượt hạn km. Hiện tại: ${formatKm(vehicle.currentOdometer)} km, hạn: ${formatKm(schedule.nextDueKm)} km.`,
  },
};
