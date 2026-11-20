import { ROLES } from "../../constants/roles.js";
import { MAINTENANCE_MESSAGES } from "../../constants/messages.js";

import { ApiError } from "../../utils/ApiError.js";

import vehicleService from "../vehicle/vehicle.service.js";
import driverService from "../driver/driver.service.js";

const getDriverVehicleIds = async (user) => {
  const driver = await driverService.getByUserId(user?.userId || user?._id);
  const vehicleId = driver.currentVehicleId?._id || driver.currentVehicleId;
  return vehicleId ? [vehicleId] : [];
};

const checkDriverVehicleAccess = async (user, vehicleId) => {
  if (user?.role !== ROLES.DRIVER) return;

  const vehicleIds = await getDriverVehicleIds(user);
  if (vehicleIds[0]?.toString() !== vehicleId.toString()) {
    throw new ApiError(403, MAINTENANCE_MESSAGES.UPDATE_LOG_OWN_VEHICLE_ONLY);
  }
};

const scopeVehicleFilter = async (filter, user) => {
  if (user?.role === ROLES.DISPATCHER) {
    const vehicleIds = await vehicleService.getIdsByWarehouseId(
      user.warehouseId,
    );
    return { $and: [filter, { vehicleId: { $in: vehicleIds } }] };
  }

  if (user?.role === ROLES.DRIVER) {
    const vehicleIds = await getDriverVehicleIds(user);
    return { $and: [filter, { vehicleId: { $in: vehicleIds } }] };
  }

  return filter;
};

export default {
  getDriverVehicleIds,
  checkDriverVehicleAccess,
  scopeVehicleFilter,
};
