import { ApiError } from "../../utils/ApiError.js";
import { TRIP_MESSAGES } from "../../constants/messages.js";

import tripRepository from "./trip.repository.js";
import tripAuditLogRepository from "./tripAuditLog.repository.js";
import tripAccess from "./trip.access.js";

const ensureTripAccess = async (
  tripId,
  requireNotDeleted = false,
  user = null,
) => {
  const trip = await tripRepository.findById(tripId);
  if (!trip) {
    throw new ApiError(404, TRIP_MESSAGES.NOT_FOUND);
  }

  if (requireNotDeleted && trip.deletedAt !== null) {
    throw new ApiError(400, TRIP_MESSAGES.ALREADY_DELETED);
  }

  await tripAccess.assertTripWarehouseAccess(trip, user);
  return trip;
};

const getAuditLogsByTripId = async (
  tripId,
  { page = 1, limit = 20, user: optionsUser = null } = {},
  userParam = null,
) => {
  const user = userParam || optionsUser;
  await ensureTripAccess(tripId, false, user);

  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const limitNumber = Math.max(1, parseInt(limit, 10) || 20);
  const skip = (pageNumber - 1) * limitNumber;

  const [logs, total] = await Promise.all([
    tripAuditLogRepository.findByTripId(tripId, {
      skip,
      limit: limitNumber,
    }),
    tripAuditLogRepository.countByTripId(tripId),
  ]);

  return {
    data: logs,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages: Math.ceil(total / limitNumber),
    },
  };
};

export default {
  getAuditLogsByTripId,
};
