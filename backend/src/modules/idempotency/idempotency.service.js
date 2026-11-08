import crypto from "crypto";

import { IDEMPOTENCY_STATUSES } from "../../constants/idempotencyStatuses.js";

import idempotencyRepository from "./idempotency.repository.js";

const sortObjectKeys = (obj) => {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }

  return Object.keys(obj)
    .sort()
    .reduce((acc, key) => {
      acc[key] = sortObjectKeys(obj[key]);
      return acc;
    }, {});
};

const generateHash = (payload) => {
  const normalized = sortObjectKeys(payload ?? {});

  return crypto
    .createHash("sha256")
    .update(JSON.stringify(normalized))
    .digest("hex");
};

const findRecord = async (userId, key) => {
  if (!userId || !key) {
    return null;
  }

  return idempotencyRepository.findByUserAndKey(userId, key);
};

const createProcessingRecord = async ({
  userId,
  key,
  endpoint,
  method,
  requestHash,
}) => {
  if (!userId || !key) {
    return { record: null, duplicate: false };
  }

  try {
    const record = await idempotencyRepository.create({
      userId,
      key,
      endpoint,
      method,
      requestHash,
      status: IDEMPOTENCY_STATUSES.PROCESSING,
    });
    return { record, duplicate: false };
  } catch (error) {
    if (error.code === 11000) {
      const existingRecord = await findRecord(userId, key);
      return { record: existingRecord, duplicate: true };
    }
    throw error;
  }
};

const completeRecord = async (recordId, responseStatus, responseBody) => {
  if (!recordId) {
    return null;
  }

  return idempotencyRepository.updateById(recordId, {
    status: IDEMPOTENCY_STATUSES.COMPLETED,
    responseStatus,
    responseBody,
  });
};

const deleteRecord = async (recordId) => {
  if (!recordId) {
    return null;
  }

  return idempotencyRepository.deleteById(recordId);
};

export default {
  generateHash,
  findRecord,
  createProcessingRecord,
  completeRecord,
  deleteRecord,
};
