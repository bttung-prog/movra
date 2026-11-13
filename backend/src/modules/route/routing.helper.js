import { ORDER_MESSAGES, PRICING_MESSAGES } from "../../constants/messages.js";
import { ROLES } from "../../constants/roles.js";
import { SHIPPING_MODES } from "../../constants/shippingModes.js";

import ApiError from "../../utils/ApiError.js";
import {
  calculateHaversineDistanceKm,
  hasValidCoordinates,
  roundDistanceKm,
} from "../../utils/distance.util.js";

import routeService from "./route.service.js";
import warehouseService from "../warehouse/warehouse.service.js";

const extractId = (ref) => ref?._id || ref || null;

const resolvePickupWarehouse = async ({ pickupLocation, warehouseId }) => {
  if (warehouseId) {
    const warehouse = await warehouseService.getById(warehouseId, true, true);
    const distanceKm = hasValidCoordinates(pickupLocation)
      ? roundDistanceKm(calculateHaversineDistanceKm(pickupLocation, warehouse))
      : 0;
    return { warehouse, distanceKm };
  }

  const nearest = await warehouseService.getNearestActiveWarehouse(
    pickupLocation.latitude,
    pickupLocation.longitude,
  );

  return {
    warehouse: nearest.warehouse,
    distanceKm: roundDistanceKm(nearest.distanceKm),
  };
};

/**
 * Resolves shipping mode, origin/destination warehouses, inter-warehouse route,
 * and stage distances (A -> Warehouse A -> Warehouse B -> B, or A -> B for direct FTL).
 * Shared by pricing calculation and order creation to guarantee quote/order parity.
 */
export const resolveOrderRouting = async ({
  shippingMode = SHIPPING_MODES.CONSOLIDATED,
  pickupLocation = null,
  deliveryLocation = null,
  warehouseId = null,
  routeId = null,
  distance = undefined,
  user = null,
  requireWarehouse = false,
} = {}) => {
  if (user?.role === ROLES.CUSTOMER && routeId) {
    throw new ApiError(400, ORDER_MESSAGES.CUSTOMER_ROUTE_NOT_ALLOWED);
  }

  const hasPickup = hasValidCoordinates(pickupLocation);
  const hasDelivery = hasValidCoordinates(deliveryLocation);

  if (shippingMode === SHIPPING_MODES.DIRECT) {
    if (routeId) {
      throw new ApiError(400, ORDER_MESSAGES.DIRECT_ROUTE_NOT_ALLOWED);
    }

    if (user?.role === ROLES.CUSTOMER || requireWarehouse) {
      if (!hasPickup) {
        throw new ApiError(400, ORDER_MESSAGES.PICKUP_LOCATION_REQUIRED);
      }
      if (!hasDelivery) {
        throw new ApiError(400, ORDER_MESSAGES.DELIVERY_LOCATION_REQUIRED);
      }
    }

    if (hasPickup && hasDelivery) {
      let resolvedWarehouseId = warehouseId;
      if (warehouseId) {
        await warehouseService.getById(warehouseId, true, true);
      } else if (requireWarehouse) {
        const nearestOrigin = await warehouseService.getNearestActiveWarehouse(
          pickupLocation.latitude,
          pickupLocation.longitude,
        );
        resolvedWarehouseId = nearestOrigin.warehouse._id;
      }

      const directDistanceKm = roundDistanceKm(
        calculateHaversineDistanceKm(pickupLocation, deliveryLocation),
      );

      return {
        shippingMode: SHIPPING_MODES.DIRECT,
        warehouseId: resolvedWarehouseId,
        destinationWarehouseId: null,
        routeId: null,
        pickupDistanceKm: 0,
        deliveryDistanceKm: 0,
        routeDistanceKm: 0,
        totalDistanceKm: directDistanceKm,
      };
    }

    if (distance !== undefined && distance !== null) {
      return {
        shippingMode: SHIPPING_MODES.DIRECT,
        warehouseId: warehouseId || null,
        destinationWarehouseId: null,
        routeId: null,
        pickupDistanceKm: 0,
        deliveryDistanceKm: 0,
        routeDistanceKm: 0,
        totalDistanceKm: Number(distance),
      };
    }

    throw new ApiError(400, PRICING_MESSAGES.LOCATIONS_OR_DISTANCE_REQUIRED);
  }

  // Consolidated (LTL) mode
  if (user?.role === ROLES.CUSTOMER) {
    if (!hasPickup) {
      throw new ApiError(400, ORDER_MESSAGES.PICKUP_LOCATION_REQUIRED);
    }
    if (!hasDelivery) {
      throw new ApiError(400, ORDER_MESSAGES.DELIVERY_LOCATION_REQUIRED);
    }
  }

  if (hasPickup && hasDelivery && !routeId) {
    const origin = await resolvePickupWarehouse({
      pickupLocation,
      warehouseId,
    });
    const nearestDest = await warehouseService.getNearestActiveWarehouse(
      deliveryLocation.latitude,
      deliveryLocation.longitude,
    );

    const originWarehouseId = origin.warehouse._id;
    const destinationWarehouseId = nearestDest.warehouse._id;
    const pickupDistanceKm = origin.distanceKm;
    const deliveryDistanceKm = roundDistanceKm(nearestDest.distanceKm);

    if (originWarehouseId.toString() === destinationWarehouseId.toString()) {
      return {
        shippingMode: SHIPPING_MODES.CONSOLIDATED,
        warehouseId: originWarehouseId,
        destinationWarehouseId,
        routeId: null,
        pickupDistanceKm,
        deliveryDistanceKm,
        routeDistanceKm: 0,
        totalDistanceKm: roundDistanceKm(pickupDistanceKm + deliveryDistanceKm),
      };
    }

    const activeRoute = await routeService.getActiveByWarehousePair(
      originWarehouseId,
      destinationWarehouseId,
    );
    if (!activeRoute) {
      throw new ApiError(400, ORDER_MESSAGES.ROUTE_NOT_SUPPORTED);
    }

    const routeDistanceKm = Number(activeRoute.distance);
    return {
      shippingMode: SHIPPING_MODES.CONSOLIDATED,
      warehouseId: originWarehouseId,
      destinationWarehouseId,
      routeId: activeRoute._id,
      pickupDistanceKm,
      deliveryDistanceKm,
      routeDistanceKm,
      totalDistanceKm: roundDistanceKm(
        pickupDistanceKm + routeDistanceKm + deliveryDistanceKm,
      ),
    };
  }

  // Manual / legacy flow (e.g., admin specifies routeId/warehouseId without deliveryLocation,
  // or quote API called with distance/routeId)
  let explicitRoute = null;
  if (routeId) {
    explicitRoute = await routeService.getById(routeId);
  }

  let resolvedWarehouseId = warehouseId;
  let pickupDistanceKm;

  if (warehouseId) {
    const warehouse = await warehouseService.getById(warehouseId, true, true);
    if (hasPickup) {
      pickupDistanceKm = roundDistanceKm(
        calculateHaversineDistanceKm(pickupLocation, warehouse),
      );
    }
  } else if (hasPickup) {
    const nearest = await warehouseService.getNearestActiveWarehouse(
      pickupLocation.latitude,
      pickupLocation.longitude,
    );
    resolvedWarehouseId = nearest.warehouse._id;
    pickupDistanceKm = roundDistanceKm(nearest.distanceKm);
  } else if (explicitRoute?.originWarehouseId) {
    resolvedWarehouseId = extractId(explicitRoute.originWarehouseId);
  } else if (requireWarehouse) {
    throw new ApiError(400, ORDER_MESSAGES.WAREHOUSE_REQUIRED);
  }

  let deliveryDistanceKm;
  let destinationWarehouseId = extractId(explicitRoute?.destinationWarehouseId);

  if (hasDelivery) {
    if (destinationWarehouseId) {
      const destWarehouse = await warehouseService.getById(
        destinationWarehouseId,
        true,
        true,
      );
      deliveryDistanceKm = roundDistanceKm(
        calculateHaversineDistanceKm(deliveryLocation, destWarehouse),
      );
    } else {
      const nearestDest = await warehouseService.getNearestActiveWarehouse(
        deliveryLocation.latitude,
        deliveryLocation.longitude,
      );
      destinationWarehouseId = nearestDest.warehouse._id;
      deliveryDistanceKm = roundDistanceKm(nearestDest.distanceKm);
    }
  }

  const routeDistanceKm =
    explicitRoute?.distance !== undefined
      ? Number(explicitRoute.distance)
      : undefined;

  const hasComputedStageDistance =
    pickupDistanceKm !== undefined ||
    deliveryDistanceKm !== undefined ||
    routeDistanceKm !== undefined;

  const totalDistanceKm =
    distance !== undefined && distance !== null
      ? Number(distance)
      : hasComputedStageDistance
        ? roundDistanceKm(
            (pickupDistanceKm || 0) +
              (routeDistanceKm || 0) +
              (deliveryDistanceKm || 0),
          )
        : undefined;

  return {
    shippingMode: SHIPPING_MODES.CONSOLIDATED,
    warehouseId: resolvedWarehouseId || null,
    destinationWarehouseId,
    routeId: routeId || null,
    pickupDistanceKm,
    deliveryDistanceKm,
    routeDistanceKm,
    totalDistanceKm,
  };
};
