import logger from "../configs/logger.js";

import invoiceService from "../modules/invoice/invoice.service.js";

export const runInvoiceOverdueJob = async () => {
  logger.info("[CRON] Bắt đầu quét hóa đơn quá hạn...");
  try {
    const result = await invoiceService.processOverdueInvoices();
    logger.info(
      `[CRON] Hoàn tất quét hóa đơn quá hạn. Đã quét: ${result.scannedCount}, cập nhật: ${result.updatedCount}.`,
    );
    return result;
  } catch (error) {
    logger.error(`[CRON] Lỗi khi quét hóa đơn quá hạn: ${error.message}`, {
      stack: error.stack,
    });
    throw error;
  }
};
