import logger from "../configs/logger.js";

import maintenanceReminderService from "../modules/maintenance/maintenanceReminder.service.js";

export const runMaintenanceReminderJob = async () => {
  logger.info("[CRON] Bắt đầu quét lịch bảo dưỡng đến hạn...");
  try {
    const result =
      await maintenanceReminderService.processMaintenanceReminders();
    logger.info(
      `[CRON] Hoàn tất quét bảo dưỡng. Đã quét: ${result.scannedCount}, thông báo: ${result.notificationCount}, bỏ qua: ${result.skippedCount}.`,
    );
    return result;
  } catch (error) {
    logger.error(`[CRON] Lỗi khi quét lịch bảo dưỡng: ${error.message}`, {
      stack: error.stack,
    });
    throw error;
  }
};
