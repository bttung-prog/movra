import cron from "node-cron";

import logger from "../configs/logger.js";

import { runInvoiceOverdueJob } from "./invoiceOverdue.job.js";

let scheduledTasks = [];

/**
 * Set up recurring cron jobs within the system
 */
export const initSchedulers = () => {
  // Scan overdue invoices every day at 00:00 (midnight) in Vietnam time
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
 * Stop all cron jobs when the server shuts down
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
