import logger from "../configs/logger.js";

import { COMMON_MESSAGES } from "../constants/messages.js";

import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";

const errorMiddleware = (err, req, res, next) => {
  const statusCode = err instanceof ApiError ? err.statusCode : 500;
  const logLevel = statusCode >= 500 ? "error" : "warn";

  logger.log(logLevel, "HTTP request failed", {
    statusCode,
    method: req.method,
    path: req.path,
    message: err.message,
    ...(statusCode >= 500 && err.stack ? { stack: err.stack } : {}),
  });

  if (err instanceof ApiError) {
    return ApiResponse.error(
      res,
      err.message,
      err.errors || [],
      err.statusCode,
    );
  }

  return ApiResponse.error(res, COMMON_MESSAGES.SERVER_ERROR, [], 500);
};

export default errorMiddleware;
