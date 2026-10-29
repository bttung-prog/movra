import ROLES from "../../constants/roles.js";
import WAREHOUSE_STATUSES from "../../constants/warehouseStatuses.js";
import USER_STATUSES from "../../constants/userStatuses.js";
import { INVENTORY_STATUSES } from "../../constants/inventoryStatuses.js";
import { WAREHOUSE_MESSAGES } from "../../constants/messages.js";

import ApiError from "../../utils/ApiError.js";
import { escapeRegex } from "../../utils/regexUtils.js";
import checkWarehouseAccess from "../../utils/checkWarehouseAccess.js";

import userService from "../user/user.service.js";
import inventoryService from "../inventory/inventory.service.js";
import dispatcherService from "../dispatcher/dispatcher.service.js";
import driverService from "../driver/driver.service.js";
import staffService from "../staff/staff.service.js";

import warehouseRepository from "./warehouse.repository.js";

const validateWarehouse = (
  warehouse,
  requireNotDeleted = true,
  requireActive = false,
) => {
  if (!warehouse) {
    throw new ApiError(404, WAREHOUSE_MESSAGES.NOT_FOUND);
  }

  if (requireNotDeleted && warehouse.deletedAt !== null) {
    throw new ApiError(400, WAREHOUSE_MESSAGES.ALREADY_DELETED);
  }

  if (requireActive && warehouse.status !== WAREHOUSE_STATUSES.ACTIVE) {
    throw new ApiError(400, WAREHOUSE_MESSAGES.NOT_ACTIVE);
  }
};

const validateManagerUser = async (managerId) => {
  if (!managerId) return null;

  const user = await userService.getById(managerId);

  if (user.status !== USER_STATUSES.ACTIVE) {
    throw new ApiError(400, WAREHOUSE_MESSAGES.MANAGER_NOT_ACTIVE);
  }

  const allowedRoles = [ROLES.ADMIN, ROLES.WAREHOUSE_STAFF];
  if (!allowedRoles.includes(user.role)) {
    throw new ApiError(400, WAREHOUSE_MESSAGES.MANAGER_ROLE_INVALID(user.role));
  }

  return user;
};

const ensureNoActivePersonnel = async (warehouseId) => {
  const [activeDispatchersCount, activeDriversCount, activeStaffCount] =
    await Promise.all([
      dispatcherService.countActiveByWarehouseId(warehouseId),
      driverService.countActiveByWarehouseId(warehouseId),
      staffService.countActiveByWarehouseId(warehouseId),
    ]);

  if (activeDispatchersCount + activeDriversCount + activeStaffCount > 0) {
    throw new ApiError(
      400,
      WAREHOUSE_MESSAGES.CANNOT_DEACTIVATE_HAS_ACTIVE_PERSONNEL(
        activeDispatchersCount,
        activeDriversCount,
        activeStaffCount,
      ),
    );
  }
};

const ensureNoInStockInventory = async (
  warehouseId,
  errorMessage = WAREHOUSE_MESSAGES.CANNOT_DEACTIVATE_HAS_STOCK,
) => {
  const inStockCount = await inventoryService.countAll({
    filter: {
      warehouseId,
      status: INVENTORY_STATUSES.IN_STOCK,
      deletedAt: null,
    },
  });

  if (inStockCount > 0) {
    throw new ApiError(400, errorMessage(inStockCount));
  }
};

const distanceInKm = (latitude, longitude, warehouse) => {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(warehouse.latitude - latitude);
  const longitudeDelta = toRadians(warehouse.longitude - longitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(latitude)) *
      Math.cos(toRadians(warehouse.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

const create = async ({
  warehouseName,
  warehouseAddress,
  latitude,
  longitude,
  managerId = null,
  status = WAREHOUSE_STATUSES.ACTIVE,
}) => {
  const existingWarehouse = await warehouseRepository.findByName(warehouseName);

  if (existingWarehouse) {
    throw new ApiError(409, WAREHOUSE_MESSAGES.ALREADY_EXISTS);
  }

  if (managerId) {
    await validateManagerUser(managerId);
  }

  return warehouseRepository.create({
    warehouseName: warehouseName.trim(),
    warehouseAddress: warehouseAddress.trim(),
    latitude,
    longitude,
    managerId: managerId || null,
    status,
  });
};

const getAll = async (query = {}, user = null) => {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const search = query.search || "";
  const filter = { ...(query.filter || {}) };
  if (query.status) {
    filter.status = query.status;
  }

  const queryFilter = { deletedAt: null, ...filter };
  if (user?.role === ROLES.DISPATCHER || user?.role === ROLES.WAREHOUSE_STAFF) {
    queryFilter._id = user.warehouseId;
  }

  if (search && search.trim()) {
    const searchRegex = new RegExp(escapeRegex(search.trim()), "i");
    queryFilter.$or = [
      { warehouseName: searchRegex },
      { warehouseAddress: searchRegex },
    ];
  }

  const [warehouses, count] = await Promise.all([
    warehouseRepository.findAll({ filter: queryFilter, skip, limit }),
    warehouseRepository.countAll({ filter: queryFilter }),
  ]);

  return {
    data: warehouses,
    pagination: {
      page,
      limit,
      total: count,
      totalPages: Math.ceil(count / limit),
    },
  };
};

const getById = async (
  warehouseId,
  requireNotDeleted = true,
  requireActive = false,
  user = null,
) => {
  const warehouse = await warehouseRepository.findById(warehouseId);

  validateWarehouse(warehouse, requireNotDeleted, requireActive);
  checkWarehouseAccess(warehouse._id, user);

  return warehouse;
};

const getNearestActiveWarehouse = async (latitude, longitude) => {
  const warehouses = await warehouseRepository.findActive();

  if (warehouses.length === 0) {
    throw new ApiError(400, WAREHOUSE_MESSAGES.NO_ACTIVE_WAREHOUSES);
  }

  const warehouseWithoutCoordinates = warehouses.find(
    (warehouse) =>
      !Number.isFinite(warehouse.latitude) ||
      !Number.isFinite(warehouse.longitude),
  );
  if (warehouseWithoutCoordinates) {
    throw new ApiError(400, WAREHOUSE_MESSAGES.COORDINATES_NOT_CONFIGURED);
  }

  return warehouses.reduce((nearest, warehouse) => {
    const distanceKm = distanceInKm(latitude, longitude, warehouse);
    return !nearest || distanceKm < nearest.distanceKm
      ? { warehouse, distanceKm }
      : nearest;
  }, null);
};

const updateById = async (warehouseId, updateData) => {
  const existingWarehouse = await getById(warehouseId, true, false);

  const payload = { ...updateData };

  if (
    payload.status !== undefined &&
    payload.status !== WAREHOUSE_STATUSES.ACTIVE
  ) {
    await ensureNoActivePersonnel(warehouseId);
  }

  if (payload.status === WAREHOUSE_STATUSES.INACTIVE) {
    await ensureNoInStockInventory(warehouseId);
  }

  if (payload.warehouseName) {
    payload.warehouseName = payload.warehouseName.trim();
  }

  if (payload.warehouseAddress) {
    payload.warehouseAddress = payload.warehouseAddress.trim();
  }

  if (payload.managerId !== undefined) {
    if (payload.managerId) {
      await validateManagerUser(payload.managerId);
    } else {
      payload.managerId = null;
    }
  }

  if (
    payload.warehouseName &&
    payload.warehouseName.toLowerCase() !==
      existingWarehouse.warehouseName.toLowerCase()
  ) {
    const nameTaken = await warehouseRepository.findByName(
      payload.warehouseName,
    );

    if (nameTaken && nameTaken._id.toString() !== warehouseId.toString()) {
      throw new ApiError(409, WAREHOUSE_MESSAGES.NAME_EXISTS);
    }
  }

  return warehouseRepository.updateById(warehouseId, payload);
};

const updateManager = async (warehouseId, userId) => {
  await getById(warehouseId, true, false);

  if (userId) {
    await validateManagerUser(userId);
  }

  return warehouseRepository.updateById(warehouseId, {
    managerId: userId || null,
  });
};

const changeStatus = async (warehouseId, status) => {
  await getById(warehouseId, true);

  if (!status || !Object.values(WAREHOUSE_STATUSES).includes(status)) {
    throw new ApiError(400, WAREHOUSE_MESSAGES.INVALID_STATUS);
  }

  if (status !== WAREHOUSE_STATUSES.ACTIVE) {
    await ensureNoActivePersonnel(warehouseId);
  }

  if (status === WAREHOUSE_STATUSES.INACTIVE) {
    await ensureNoInStockInventory(warehouseId);
  }

  return warehouseRepository.updateById(warehouseId, { status });
};

const softDelete = async (warehouseId) => {
  await getById(warehouseId, true);
  await ensureNoActivePersonnel(warehouseId);
  await ensureNoInStockInventory(
    warehouseId,
    WAREHOUSE_MESSAGES.CANNOT_DELETE_HAS_STOCK,
  );

  return warehouseRepository.updateById(warehouseId, {
    deletedAt: new Date(),
    status: WAREHOUSE_STATUSES.INACTIVE,
  });
};

const restore = async (warehouseId) => {
  const existingWarehouse = await getById(warehouseId, false);

  if (!existingWarehouse.deletedAt) {
    throw new ApiError(400, WAREHOUSE_MESSAGES.NOT_DELETED);
  }

  const nameTaken = await warehouseRepository.findByName(
    existingWarehouse.warehouseName,
  );

  if (nameTaken && nameTaken._id.toString() !== warehouseId.toString()) {
    throw new ApiError(409, WAREHOUSE_MESSAGES.CANNOT_RESTORE_NAME_EXISTS);
  }

  return warehouseRepository.updateById(warehouseId, {
    deletedAt: null,
    status: WAREHOUSE_STATUSES.ACTIVE,
  });
};

export default {
  create,
  getAll,
  getById,
  getNearestActiveWarehouse,
  updateById,
  updateManager,
  changeStatus,
  softDelete,
  restore,
};
