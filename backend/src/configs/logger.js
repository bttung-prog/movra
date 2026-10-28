import { mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import winston from "winston";

const logsDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../logs",
);

mkdirSync(logsDirectory, { recursive: true });

const logger = winston.createLogger({
  level: "info",

  format: winston.format.combine(
    winston.format.timestamp(),

    winston.format.errors({
      stack: true,
    }),

    winston.format.json(),
  ),

  transports: [
    new winston.transports.Console(),

    new winston.transports.File({
      filename: path.join(logsDirectory, "error.log"),
      level: "error",
    }),

    new winston.transports.File({
      filename: path.join(logsDirectory, "combined.log"),
    }),
  ],
});

export default logger;
