import { ROLES } from "../../constants/roles.js";
import { TRIP_MESSAGES, WAREHOUSE_MESSAGES } from "../../constants/messages.js";

import { ApiError } from "../../utils/ApiError.js";
import { checkWarehouseAccess } from "../../utils/checkWarehouseAccess.js";

import driverService from "../driver/driver.service.js";
import vehicleService from "../vehicle/vehicle.service.js";

const getActorId = (user) => user?.userId || user?._id || null;

const validateRouteOriginWarehouse = (route, warehouseId) => {
  const originWarehouseId =
    route.originWarehouseId?._id || route.originWarehouseId;

  if (
    !warehouseId ||
    originWarehouseId?.toString() !== warehouseId.toString()
  ) {
    throw new ApiError(400, TRIP_MESSAGES.ROUTE_ORIGIN_WAREHOUSE_MISMATCH);
  }
};

const assertTripWarehouseAccess = async (trip, user) => {
  if (user?.role === ROLES.DRIVER) {
    const driver = await driverService.getByUserId(user._id);
    const assignedDriverId = trip.driverId?._id || trip.driverId;
    if (assignedDriverId?.toString() !== driver._id.toString()) {
      throw new ApiError(403, TRIP_MESSAGES.NOT_ASSIGNED_DRIVER);
    }
    return;
  }

  if (user?.role !== ROLES.DISPATCHER) return;

  if (trip.warehouseId) {
    checkWarehouseAccess(trip.warehouseId, user);
    const vehicleId = trip.vehicleId?._id || trip.vehicleId;
    if (vehicleId) {
      await vehicleService.getById(vehicleId, user);
    }
    return;
  }

  const driverId = trip.driverId?._id || trip.driverId;
  if (!driverId) {
    throw new ApiError(403, TRIP_MESSAGES.DRIVER_REQUIRED_FOR_WAREHOUSE_SCOPE);
  }

  const driver = await driverService.getById(driverId);
  checkWarehouseAccess(driver.warehouseId, user);

  const vehicleId = trip.vehicleId?._id || trip.vehicleId;
  if (vehicleId) {
    await vehicleService.getById(vehicleId, user);
  }
};

const scopeTripFilter = async (filter, user) => {
  if (user?.role === ROLES.DRIVER) {
    const driver = await driverService.getByUserId(user._id);
    return { $and: [filter, { driverId: driver._id }] };
  }

  if (user?.role !== ROLES.DISPATCHER) return filter;
  if (!user.warehouseId) {
    throw new ApiError(403, WAREHOUSE_MESSAGES.DISPATCHER_NOT_ASSIGNED);
  }

  const driverIds = await driverService.getIdsByWarehouseId(user.warehouseId);
  const vehicleIds = await vehicleService.getIdsByWarehouseId(user.warehouseId);
  return {
    $and: [
      filter,
      {
        $or: [
          { warehouseId: user.warehouseId },
          {
            warehouseId: null,
            driverId: { $in: driverIds },
            vehicleId: { $in: vehicleIds },
          },
        ],
      },
    ],
  };
};

export default {
  getActorId,
  validateRouteOriginWarehouse,
  assertTripWarehouseAccess,
  scopeTripFilter,
};
