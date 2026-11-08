import logger from "../configs/logger.js";

import { IDEMPOTENCY_STATUSES } from "../constants/idempotencyStatuses.js";
import {
  COMMON_MESSAGES,
  IDEMPOTENCY_MESSAGES,
} from "../constants/messages.js";
import ApiError from "../utils/ApiError.js";

import idempotencyService from "../modules/idempotency/idempotency.service.js";

const idempotency = ({
  required = false,
  headerName = "idempotency-key",
} = {}) => {
  return async (req, res, next) => {
    try {
      const normalizedHeaderName = headerName.toLowerCase();
      const rawKey =
        req.headers[normalizedHeaderName] || req.headers["x-idempotency-key"];
      const key = typeof rawKey === "string" ? rawKey.trim() : null;

      if (!key) {
        if (required) {
          throw new ApiError(400, IDEMPOTENCY_MESSAGES.KEY_REQUIRED);
        }

        return next();
      }

      if (key.length < 1 || key.length > 255) {
        throw new ApiError(400, IDEMPOTENCY_MESSAGES.KEY_INVALID);
      }

      const userId = req.user?.userId;
      if (!userId) {
        throw new ApiError(401, COMMON_MESSAGES.UNAUTHORIZED);
      }

      const requestHash = idempotencyService.generateHash(req.body);
      const existingRecord = await idempotencyService.findRecord(userId, key);

      if (existingRecord) {
        if (existingRecord.requestHash !== requestHash) {
          throw new ApiError(422, IDEMPOTENCY_MESSAGES.PAYLOAD_MISMATCH);
        }

        if (existingRecord.status === IDEMPOTENCY_STATUSES.PROCESSING) {
          throw new ApiError(409, IDEMPOTENCY_MESSAGES.REQUEST_IN_PROGRESS);
        }

        if (existingRecord.status === IDEMPOTENCY_STATUSES.COMPLETED) {
          res.setHeader("X-Cache-Lookup", "HIT");
          res.setHeader("Idempotent-Replayed", "true");
          return res
            .status(existingRecord.responseStatus || 200)
            .json(existingRecord.responseBody);
        }
      }

      const { record, duplicate } =
        await idempotencyService.createProcessingRecord({
          userId,
          key,
          endpoint: req.originalUrl || req.baseUrl || req.path,
          method: req.method,
          requestHash,
        });

      if (duplicate && record) {
        if (record.requestHash !== requestHash) {
          throw new ApiError(422, IDEMPOTENCY_MESSAGES.PAYLOAD_MISMATCH);
        }

        if (record.status === IDEMPOTENCY_STATUSES.PROCESSING) {
          throw new ApiError(409, IDEMPOTENCY_MESSAGES.REQUEST_IN_PROGRESS);
        }

        if (record.status === IDEMPOTENCY_STATUSES.COMPLETED) {
          res.setHeader("X-Cache-Lookup", "HIT");
          res.setHeader("Idempotent-Replayed", "true");
          return res
            .status(record.responseStatus || 200)
            .json(record.responseBody);
        }
      }

      const recordId = record?._id;
      let isFinalized = false;

      const originalJson = res.json.bind(res);
      res.json = (body) => {
        if (!isFinalized && recordId) {
          isFinalized = true;
          const statusCode = res.statusCode;
          if (statusCode >= 200 && statusCode < 300) {
            idempotencyService
              .completeRecord(recordId, statusCode, body)
              .catch((err) => {
                logger.error("Failed to mark idempotency record as completed", {
                  recordId,
                  error: err.message,
                });
              });
          } else {
            idempotencyService.deleteRecord(recordId).catch((err) => {
              logger.error("Failed to delete failed idempotency record", {
                recordId,
                error: err.message,
              });
            });
          }
        }
        return originalJson(body);
      };

      res.on("close", () => {
        if (!isFinalized && recordId) {
          isFinalized = true;
          idempotencyService.deleteRecord(recordId).catch(() => {});
        }
      });

      next();
    } catch (error) {
      next(error);
    }
  };
};

export default idempotency;
