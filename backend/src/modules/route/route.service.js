import { ROUTE_MESSAGES } from "../../constants/messages.js";

import ApiError from "../../utils/ApiError.js";

import warehouseService from "../warehouse/warehouse.service.js";
import tripService from "../trip/trip.service.js";
import orderService from "../order/order.service.js";

import routeRepository from "./route.repository.js";

const validateRouteData = (
  { originWarehouseId, destinationWarehouseId, distance, expectedDuration },
  isUpdate = false,
) => {
  if (!isUpdate) {
    if (!originWarehouseId) {
      throw new ApiError(400, ROUTE_MESSAGES.ORIGIN_REQUIRED);
    }

    if (!destinationWarehouseId) {
      throw new ApiError(400, ROUTE_MESSAGES.DESTINATION_REQUIRED);
    }

    if (distance === undefined || distance === null) {
      throw new ApiError(400, ROUTE_MESSAGES.DISTANCE_REQUIRED);
    }

    if (expectedDuration === undefined || expectedDuration === null) {
      throw new ApiError(400, ROUTE_MESSAGES.DURATION_REQUIRED);
    }
  }

  if (
    originWarehouseId &&
    destinationWarehouseId &&
    String(originWarehouseId).toLowerCase() ===
      String(destinationWarehouseId).toLowerCase()
  ) {
    throw new ApiError(400, ROUTE_MESSAGES.IDENTICAL_ORIGIN_DEST);
  }

  if (distance !== undefined && distance <= 0) {
    throw new ApiError(400, ROUTE_MESSAGES.DISTANCE_MUST_POSITIVE);
  }

  if (expectedDuration !== undefined && expectedDuration <= 0) {
    throw new ApiError(400, ROUTE_MESSAGES.DURATION_MUST_POSITIVE);
  }
};

const validateRouteWarehouses = async (
  originWarehouseId,
  destinationWarehouseId,
) => {
  return Promise.all([
    warehouseService.getById(originWarehouseId, true, true),
    warehouseService.getById(destinationWarehouseId, true, true),
  ]);
};

const getReferenceId = (reference) => reference?._id ?? reference;

const validateRouteExists = (route, requireNotDeleted = true) => {
  if (!route) {
    throw new ApiError(404, ROUTE_MESSAGES.NOT_FOUND);
  }

  if (requireNotDeleted && route.deletedAt !== null) {
    throw new ApiError(400, ROUTE_MESSAGES.ALREADY_DELETED);
  }

  return route;
};

const create = async ({
  originWarehouseId,
  destinationWarehouseId,
  distance,
  expectedDuration,
}) => {
  validateRouteData({
    originWarehouseId,
    destinationWarehouseId,
    distance,
    expectedDuration,
  });

  const [originWarehouse, destinationWarehouse] = await validateRouteWarehouses(
    originWarehouseId,
    destinationWarehouseId,
  );

  const existingRouteByPoints = await routeRepository.findByWarehousePair(
    originWarehouseId,
    destinationWarehouseId,
  );

  if (existingRouteByPoints && existingRouteByPoints.deletedAt === null) {
    throw new ApiError(
      409,
      ROUTE_MESSAGES.ALREADY_EXISTS(
        originWarehouse.warehouseName,
        destinationWarehouse.warehouseName,
      ),
    );
  }

  if (existingRouteByPoints && existingRouteByPoints.deletedAt !== null) {
    return routeRepository.updateById(existingRouteByPoints._id, {
      originWarehouseId,
      destinationWarehouseId,
      distance,
      expectedDuration,
      deletedAt: null,
    });
  }

  return routeRepository.create({
    originWarehouseId,
    destinationWarehouseId,
    distance,
    expectedDuration,
  });
};

const getAll = async ({
  filter = {},
  page = 1,
  limit = 10,
  sort = { createdAt: -1 },
} = {}) => {
  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const limitNumber = Math.max(1, parseInt(limit, 10) || 10);
  const skip = (pageNumber - 1) * limitNumber;

  const finalFilter = { deletedAt: null, ...filter };

  const [routes, total] = await Promise.all([
    routeRepository.findAll({
      filter: finalFilter,
      skip,
      limit: limitNumber,
      sort,
    }),
    routeRepository.countAll({ filter: finalFilter }),
  ]);

  return {
    data: routes,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages: Math.ceil(total / limitNumber),
    },
  };
};

const getById = async (routeId, requireNotDeleted = true) => {
  const route = await routeRepository.findById(routeId);

  return validateRouteExists(route, requireNotDeleted);
};

const updateById = async (routeId, updateData) => {
  const existingRoute = await getById(routeId);

  const existingOriginWarehouseId = getReferenceId(
    existingRoute.originWarehouseId,
  );
  const existingDestinationWarehouseId = getReferenceId(
    existingRoute.destinationWarehouseId,
  );

  const mergedOriginWarehouseId =
    updateData.originWarehouseId !== undefined
      ? updateData.originWarehouseId
      : existingOriginWarehouseId;
  const mergedDestinationWarehouseId =
    updateData.destinationWarehouseId !== undefined
      ? updateData.destinationWarehouseId
      : existingDestinationWarehouseId;

  validateRouteData(
    {
      originWarehouseId: mergedOriginWarehouseId,
      destinationWarehouseId: mergedDestinationWarehouseId,
      distance: updateData.distance,
      expectedDuration: updateData.expectedDuration,
    },
    true,
  );

  const [originWarehouse, destinationWarehouse] = await validateRouteWarehouses(
    mergedOriginWarehouseId,
    mergedDestinationWarehouseId,
  );

  if (
    String(mergedOriginWarehouseId) !== String(existingOriginWarehouseId) ||
    String(mergedDestinationWarehouseId) !==
      String(existingDestinationWarehouseId)
  ) {
    const routePairTaken = await routeRepository.findByWarehousePair(
      mergedOriginWarehouseId,
      mergedDestinationWarehouseId,
    );

    if (
      routePairTaken &&
      routePairTaken._id.toString() !== routeId.toString() &&
      routePairTaken.deletedAt === null
    ) {
      throw new ApiError(
        409,
        ROUTE_MESSAGES.ALREADY_EXISTS(
          originWarehouse.warehouseName,
          destinationWarehouse.warehouseName,
        ),
      );
    }
  }

  if (String(mergedOriginWarehouseId) !== String(existingOriginWarehouseId)) {
    const tripsWithDifferentOrigin = await tripService.countAll({
      filter: {
        routeId,
        deletedAt: null,
        warehouseId: { $ne: mergedOriginWarehouseId },
      },
    });

    if (tripsWithDifferentOrigin > 0) {
      throw new ApiError(400, ROUTE_MESSAGES.CANNOT_CHANGE_ORIGIN_WITH_TRIPS);
    }
  }

  const payload = { ...updateData };

  return routeRepository.updateById(routeId, payload);
};

const deleteById = async (routeId) => {
  await getById(routeId);

  const [activeTripsCount, activeOrdersCount] = await Promise.all([
    tripService.countAll({
      filter: {
        routeId,
        deletedAt: null,
        status: { $in: ["planned", "in_progress"] },
      },
    }),
    orderService.countAll({
      filter: {
        routeId,
        deletedAt: null,
        status: { $nin: ["delivered", "cancelled", "failed", "returned"] },
      },
    }),
  ]);

  if (activeTripsCount > 0) {
    throw new ApiError(
      400,
      ROUTE_MESSAGES.CANNOT_DELETE_ACTIVE_TRIPS(activeTripsCount),
    );
  }

  if (activeOrdersCount > 0) {
    throw new ApiError(
      400,
      ROUTE_MESSAGES.CANNOT_DELETE_ACTIVE_ORDERS(activeOrdersCount),
    );
  }

  return routeRepository.deleteById(routeId);
};

const restoreById = async (routeId) => {
  const route = await getById(routeId, false);

  if (route.deletedAt === null) {
    throw new ApiError(400, ROUTE_MESSAGES.NOT_DELETED);
  }

  return routeRepository.restoreById(routeId);
};

export default {
  create,
  getAll,
  getById,
  updateById,
  deleteById,
  restoreById,
};
