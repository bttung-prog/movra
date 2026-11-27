import logger from "../configs/logger.js";

import vehicleExpiryService from "../modules/vehicle/vehicleExpiry.service.js";

export const runVehicleExpiryJob = async () => {
  logger.info("[CRON] Bắt đầu quét hạn đăng kiểm/bảo hiểm xe...");
  try {
    const result = await vehicleExpiryService.processVehicleExpiryReminders();
    logger.info(
      `[CRON] Hoàn tất quét hạn xe. Đã quét: ${result.scannedCount}, thông báo: ${result.notificationCount}, bỏ qua: ${result.skippedCount}.`,
    );
    return result;
  } catch (error) {
    logger.error(
      `[CRON] Lỗi khi quét hạn đăng kiểm/bảo hiểm: ${error.message}`,
      {
        stack: error.stack,
      },
    );
    throw error;
  }
};
