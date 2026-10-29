import {
  DISPATCHER_MESSAGES,
  USER_MESSAGES,
} from "../../constants/messages.js";
import ROLES from "../../constants/roles.js";
import USER_STATUSES from "../../constants/userStatuses.js";

import ApiError from "../../utils/ApiError.js";
import generateCode from "../../utils/generateCode.js";
import { escapeRegex } from "../../utils/regexUtils.js";

import userService from "../user/user.service.js";
import warehouseService from "../warehouse/warehouse.service.js";
import driverService from "../driver/driver.service.js";
import vehicleService from "../vehicle/vehicle.service.js";
import tripService from "../trip/trip.service.js";
import orderService from "../order/order.service.js";

import dispatcherRepository from "./dispatcher.repository.js";

const create = async ({ userId, warehouseId }, session = null) => {
  const user = await userService.getById(userId, session);
  if (user.role !== ROLES.DISPATCHER) {
    throw new ApiError(400, USER_MESSAGES.DISPATCHER_ROLE_INVALID);
  }
  if (user.status !== USER_STATUSES.ACTIVE) {
    throw new ApiError(400, USER_MESSAGES.DISPATCHER_USER_NOT_ACTIVE);
  }

  await warehouseService.getById(warehouseId, true, true);

  const existByUserId = await dispatcherRepository.findByUserId(
    userId,
    session,
  );
  if (existByUserId) {
    throw new ApiError(409, DISPATCHER_MESSAGES.ALREADY_EXISTS);
  }

  let dispatcherCode;
  let isUnique = false;
  let attempts = 0;

  while (!isUnique && attempts < 5) {
    dispatcherCode = generateCode("DIS-");
    const existing = await dispatcherRepository.findByCode(dispatcherCode);
    if (!existing) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) {
    throw new ApiError(500, DISPATCHER_MESSAGES.CODE_GEN_FAILED);
  }

  try {
    return await dispatcherRepository.create(
      { userId, warehouseId, dispatcherCode },
      session,
    );
  } catch (error) {
    if (error?.code !== 11000) {
      throw error;
    }

    if (error.keyPattern?.userId || error.keyValue?.userId) {
      throw new ApiError(409, DISPATCHER_MESSAGES.ALREADY_EXISTS);
    }

    if (error.keyPattern?.dispatcherCode || error.keyValue?.dispatcherCode) {
      throw new ApiError(409, DISPATCHER_MESSAGES.CODE_ALREADY_EXISTS);
    }

    throw error;
  }
};

const getAll = async ({
  filter = {},
  page = 1,
  limit = 10,
  search = "",
} = {}) => {
  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const limitNumber = Math.max(1, parseInt(limit, 10) || 10);
  const skip = (pageNumber - 1) * limitNumber;

  const queryFilter = { ...filter };
  if (search && search.trim()) {
    queryFilter.dispatcherCode = {
      $regex: escapeRegex(search.trim()),
      $options: "i",
    };
  }

  const [dispatchers, total] = await Promise.all([
    dispatcherRepository.findAll({
      filter: queryFilter,
      skip,
      limit: limitNumber,
    }),
    dispatcherRepository.countAll(queryFilter),
  ]);

  return {
    data: dispatchers,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages: Math.ceil(total / limitNumber),
    },
  };
};

const getById = async (dispatcherId) => {
  const dispatcher = await dispatcherRepository.findById(dispatcherId);

  if (!dispatcher) {
    throw new ApiError(404, DISPATCHER_MESSAGES.NOT_FOUND);
  }

  return dispatcher;
};

const getByUserId = async (userId, session = null) => {
  const dispatcher = await dispatcherRepository.findByUserId(userId, session);

  if (!dispatcher) {
    throw new ApiError(404, DISPATCHER_MESSAGES.NOT_FOUND);
  }

  return dispatcher;
};

const getByCode = async (dispatcherCode) => {
  const dispatcher = await dispatcherRepository.findByCode(dispatcherCode);

  if (!dispatcher) {
    throw new ApiError(404, DISPATCHER_MESSAGES.NOT_FOUND);
  }

  return dispatcher;
};

const getMyProfile = async (userId) => {
  return getByUserId(userId);
};

const updateById = async (dispatcherId, updateData, session = null) => {
  const dispatcher = await getById(dispatcherId);

  if (updateData.status === "active") {
    const userId = dispatcher.userId?._id || dispatcher.userId;
    const user = await userService.getById(userId, session);
    if (
      user.role !== ROLES.DISPATCHER ||
      user.status !== USER_STATUSES.ACTIVE
    ) {
      throw new ApiError(400, USER_MESSAGES.DISPATCHER_USER_NOT_ACTIVE);
    }
  }

  if (updateData.warehouseId || updateData.status === "active") {
    const warehouseId =
      updateData.warehouseId ||
      dispatcher.warehouseId?._id ||
      dispatcher.warehouseId;
    await warehouseService.getById(warehouseId, true, true);
  }

  const updatedDispatcher = await dispatcherRepository.updateById(
    dispatcherId,
    updateData,
    session,
  );

  return updatedDispatcher;
};

const deleteById = async (dispatcherId) => {
  return updateById(dispatcherId, { status: "inactive" });
};

const restoreById = async (dispatcherId) => {
  return updateStatus(dispatcherId, "active");
};

const transferWarehouse = async (dispatcherId, warehouseId) => {
  return updateById(dispatcherId, { warehouseId });
};

const updateStatus = async (dispatcherId, status, session = null) => {
  return updateById(dispatcherId, { status }, session);
};

const countActiveByWarehouseId = (warehouseId) => {
  return dispatcherRepository.countActiveByWarehouseId(warehouseId);
};

const getDashboardStats = async (userId, user = null) => {
  const dispatcher = await dispatcherRepository.findByUserId(userId);
  if (!dispatcher) {
    throw new ApiError(404, DISPATCHER_MESSAGES.NOT_FOUND);
  }

  const warehouseId = dispatcher.warehouseId._id || dispatcher.warehouseId;

  const [
    allDriversRes,
    activeDriversRes,
    availableVehiclesRes,
    tripsInProgressCount,
    tripsPlannedCount,
    unassignedOrdersCount,
  ] = await Promise.all([
    driverService.getAll({ filter: { warehouseId }, limit: 1 }),
    driverService.getAll({
      filter: { warehouseId, status: "active" },
      limit: 1,
    }),
    vehicleService.getAll({
      filter: { status: "available" },
      limit: 1,
      user,
    }),
    tripService.countAll({
      filter: { status: "in_progress", deletedAt: null },
      user,
    }),
    tripService.countAll({
      filter: { status: "planned", deletedAt: null },
      user,
    }),
    orderService.countAll({
      filter: {
        status: "created",
        $or: [{ tripId: null }, { tripId: { $exists: false } }],
      },
      user,
    }),
  ]);

  return {
    dispatcher: {
      _id: dispatcher._id,
      dispatcherCode: dispatcher.dispatcherCode,
      status: dispatcher.status,
      warehouse: dispatcher.warehouseId,
      user: dispatcher.userId,
    },
    stats: {
      drivers: {
        total: allDriversRes.pagination?.totalDrivers || 0,
        active: activeDriversRes.pagination?.totalDrivers || 0,
      },
      vehicles: {
        available: availableVehiclesRes.pagination?.total || 0,
      },
      trips: {
        planned: tripsPlannedCount || 0,
        inProgress: tripsInProgressCount || 0,
      },
      orders: {
        unassigned: unassignedOrdersCount || 0,
      },
    },
  };
};

const getResources = async (
  userId,
  user = null,
  { page = 1, limit = 100 } = {},
) => {
  const dispatcher = await dispatcherRepository.findByUserId(userId);
  if (!dispatcher) {
    throw new ApiError(404, DISPATCHER_MESSAGES.NOT_FOUND);
  }

  const warehouseId = dispatcher.warehouseId._id || dispatcher.warehouseId;

  const [driversRes, vehiclesRes] = await Promise.all([
    driverService.getAll({
      filter: { warehouseId, status: "active" },
      page,
      limit,
      user,
    }),
    vehicleService.getAll({
      filter: { status: "available" },
      page,
      limit,
      user,
    }),
  ]);

  return {
    drivers: driversRes.data || [],
    vehicles: vehiclesRes.data || [],
    pagination: {
      drivers: driversRes.pagination,
      vehicles: vehiclesRes.pagination,
    },
  };
};

export default {
  create,
  getAll,
  getById,
  getByUserId,
  getByCode,
  getMyProfile,
  updateById,
  deleteById,
  restoreById,
  transferWarehouse,
  updateStatus,
  countActiveByWarehouseId,
  getDashboardStats,
  getResources,
};
