import cron from "node-cron";

import logger from "../configs/logger.js";

import { runInvoiceOverdueJob } from "./invoiceOverdue.job.js";

let scheduledTasks = [];

/**
 * Khởi tạo các cron job định kỳ trong hệ thống
 */
export const initSchedulers = () => {
  // Quét hóa đơn quá hạn mỗi ngày vào lúc 00:00 (nửa đêm) theo giờ Việt Nam
  const invoiceOverdueTask = cron.schedule(
    "0 0 * * *",
    async () => {
      try {
        await runInvoiceOverdueJob();
      } catch (error) {
        logger.error(
          `[CRON] Error in overdue invoice cron job: ${error.message}`,
        );
      }
    },
    {
      timezone: "Asia/Ho_Chi_Minh",
    },
  );

  scheduledTasks.push(invoiceOverdueTask);
  logger.info("Schedulers have been successfully initialized (node-cron).");
};

/**
 * Dừng tất cả các cron job khi server tắt
 */
export const stopSchedulers = () => {
  scheduledTasks.forEach((task) => {
    if (task && typeof task.stop === "function") {
      task.stop();
    }
  });
  scheduledTasks = [];
  logger.info("All schedulers have been stopped.");
};
