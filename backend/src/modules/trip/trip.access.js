import { ROLES } from "../../constants/roles.js";
import { TRIP_MESSAGES, WAREHOUSE_MESSAGES } from "../../constants/messages.js";

import { ApiError } from "../../utils/ApiError.js";
import { checkWarehouseAccess } from "../../utils/checkWarehouseAccess.js";
import { getActorUserId } from "../../utils/actor.util.js";

import driverService from "../driver/driver.service.js";
import vehicleService from "../vehicle/vehicle.service.js";

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

const assertVehicleWarehouseAccess = async (vehicle, user) => {
  const vehicleId = vehicle?._id || vehicle;
  if (!vehicleId) return;

  if (
    vehicle &&
    typeof vehicle === "object" &&
    vehicle.warehouseId !== undefined &&
    vehicle.warehouseId !== null
  ) {
    checkWarehouseAccess(vehicle.warehouseId, user);
    return;
  }

  await vehicleService.getById(vehicleId, user);
};

const assertTripWarehouseAccess = async (trip, user) => {
  if (user?.role === ROLES.DRIVER) {
    const driverRef = trip.driverId;
    const assignedDriverId = driverRef?._id || driverRef;
    const assignedUserId = driverRef?.userId?._id || driverRef?.userId;
    const actorUserId = getActorUserId(user);

    if (assignedUserId && actorUserId) {
      if (assignedUserId.toString() !== actorUserId.toString()) {
        throw new ApiError(403, TRIP_MESSAGES.NOT_ASSIGNED_DRIVER);
      }
      return;
    }

    const driver = await driverService.getByUserId(actorUserId);
    if (assignedDriverId?.toString() !== driver._id.toString()) {
      throw new ApiError(403, TRIP_MESSAGES.NOT_ASSIGNED_DRIVER);
    }
    return;
  }

  if (user?.role !== ROLES.DISPATCHER) return;

  if (trip.warehouseId) {
    checkWarehouseAccess(trip.warehouseId, user);
    await assertVehicleWarehouseAccess(trip.vehicleId, user);
    return;
  }

  const driverRef = trip.driverId;
  const driverId = driverRef?._id || driverRef;
  if (!driverId) {
    throw new ApiError(403, TRIP_MESSAGES.DRIVER_REQUIRED_FOR_WAREHOUSE_SCOPE);
  }

  if (
    driverRef &&
    typeof driverRef === "object" &&
    driverRef.warehouseId !== undefined
  ) {
    checkWarehouseAccess(driverRef.warehouseId, user);
  } else {
    const driver = await driverService.getById(driverId);
    checkWarehouseAccess(driver.warehouseId, user);
  }

  await assertVehicleWarehouseAccess(trip.vehicleId, user);
};

const scopeTripFilter = async (filter, user) => {
  if (user?.role === ROLES.DRIVER) {
    const driver = await driverService.getByUserId(getActorUserId(user));
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
  validateRouteOriginWarehouse,
  assertTripWarehouseAccess,
  scopeTripFilter,
};
