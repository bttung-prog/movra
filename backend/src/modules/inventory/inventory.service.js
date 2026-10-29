import ROLES from "../../constants/roles.js";
import {
  INVENTORY_STATUSES,
  INVENTORY_CONDITIONS,
} from "../../constants/inventoryStatuses.js";
import {
  INVENTORY_MESSAGES,
  WAREHOUSE_MESSAGES,
} from "../../constants/messages.js";

import ApiError from "../../utils/ApiError.js";
import checkWarehouseAccess from "../../utils/checkWarehouseAccess.js";
import { escapeRegex } from "../../utils/regexUtils.js";

import warehouseService from "../warehouse/warehouse.service.js";
import goodsCategoryService from "../goodsCategory/goodsCategory.service.js";
import orderService from "../order/order.service.js";

import inventoryRepository from "./inventory.repository.js";

const validateInventory = (inventory, requireNotDeleted = true) => {
  if (!inventory) {
    throw new ApiError(404, INVENTORY_MESSAGES.NOT_FOUND);
  }

  if (requireNotDeleted && inventory.deletedAt !== null) {
    throw new ApiError(400, INVENTORY_MESSAGES.ALREADY_DELETED);
  }
};

const create = async (
  {
    warehouseId,
    orderId,
    goodsCategoryId,
    quantity,
    location,
    condition = INVENTORY_CONDITIONS.GOOD,
    status = INVENTORY_STATUSES.IN_STOCK,
  },
  session = null,
) => {
  if (quantity <= 0) {
    throw new ApiError(400, INVENTORY_MESSAGES.QTY_MUST_BE_GREATER_THAN_ZERO);
  }

  await warehouseService.getById(warehouseId, true, true);
  await goodsCategoryService.getById(goodsCategoryId, true, session);
  await orderService.getById(orderId, true);

  const existingInventory = await inventoryRepository.findByWarehouseAndOrder(
    warehouseId,
    orderId,
    session,
  );
  if (existingInventory) {
    if (existingInventory.status === INVENTORY_STATUSES.IN_STOCK) {
      throw new ApiError(400, INVENTORY_MESSAGES.ALREADY_IN_STOCK);
    }

    return inventoryRepository.updateById(
      existingInventory._id,
      {
        warehouseId,
        goodsCategoryId,
        quantity,
        location,
        condition,
        status: INVENTORY_STATUSES.IN_STOCK,
        deletedAt: null,
      },
      session,
    );
  }

  return inventoryRepository.create(
    {
      warehouseId,
      orderId,
      goodsCategoryId,
      quantity,
      location,
      condition,
      status,
    },
    session,
  );
};

const getAll = async (query = {}, currentUser = null) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.max(1, parseInt(query.limit, 10) || 10);
  const skip = (page - 1) * limit;

  const filter = { deletedAt: null };

  const isWarehouseScoped =
    currentUser?.role === ROLES.WAREHOUSE_STAFF ||
    currentUser?.role === ROLES.DISPATCHER;

  if (isWarehouseScoped) {
    if (!currentUser.warehouseId) {
      const message =
        currentUser.role === ROLES.DISPATCHER
          ? WAREHOUSE_MESSAGES.DISPATCHER_NOT_ASSIGNED
          : WAREHOUSE_MESSAGES.STAFF_NOT_ASSIGNED;
      throw new ApiError(403, message);
    }
    filter.warehouseId = currentUser.warehouseId;
  } else if (query.warehouseId) {
    filter.warehouseId = query.warehouseId;
  }

  if (query.orderId) {
    filter.orderId = query.orderId;
  }

  if (query.goodsCategoryId) {
    filter.goodsCategoryId = query.goodsCategoryId;
  }

  if (query.status) {
    filter.status = query.status;
  }

  if (query.condition) {
    filter.condition = query.condition;
  }

  const locationKeyword = query.location || query.search;
  if (locationKeyword && locationKeyword.trim()) {
    filter.location = {
      $regex: escapeRegex(locationKeyword.trim()),
      $options: "i",
    };
  }

  let sort = { createdAt: -1 };
  if (query.sortBy) {
    const order = query.sortOrder === "asc" ? 1 : -1;
    sort = { [query.sortBy]: order };
  }

  const [items, total] = await Promise.all([
    inventoryRepository.findAll({ filter, skip, limit, sort }),
    inventoryRepository.countAll({ filter }),
  ]);

  return {
    data: items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getById = async (
  inventoryId,
  requireNotDeleted = true,
  session = null,
  currentUser = null,
) => {
  const inventory = await inventoryRepository.findById(inventoryId, session);

  validateInventory(inventory, requireNotDeleted);

  checkWarehouseAccess(
    inventory.warehouseId,
    currentUser,
    INVENTORY_MESSAGES.UNAUTHORIZED_VIEW_DIFFERENT_WAREHOUSE,
  );

  return inventory;
};

const getByOrderId = async (orderId, session = null, currentUser = null) => {
  const scopedWarehouseId =
    currentUser?.role === ROLES.WAREHOUSE_STAFF ||
    currentUser?.role === ROLES.DISPATCHER
      ? currentUser.warehouseId
      : null;

  const inventory = await inventoryRepository.findByOrderId(
    orderId,
    scopedWarehouseId,
    session,
  );

  if (!inventory) {
    throw new ApiError(404, INVENTORY_MESSAGES.RECORD_NOT_FOUND);
  }

  checkWarehouseAccess(
    inventory.warehouseId,
    currentUser,
    INVENTORY_MESSAGES.UNAUTHORIZED_VIEW_DIFFERENT_WAREHOUSE,
  );

  return inventory;
};

const getInStockByOrderId = async (orderId, session = null) => {
  return inventoryRepository.findInStockByOrderId(orderId, session);
};

const markAsInStockAtomic = async (inventoryId, session = null) => {
  return inventoryRepository.markAsInStockAtomic(inventoryId, session);
};

const getByWarehouseAndOrder = async (
  warehouseId,
  orderId,
  session = null,
  currentUser = null,
) => {
  if (!warehouseId || !orderId) {
    throw new ApiError(400, INVENTORY_MESSAGES.WAREHOUSE_AND_ORDER_REQUIRED);
  }

  checkWarehouseAccess(
    warehouseId,
    currentUser,
    INVENTORY_MESSAGES.UNAUTHORIZED_VIEW_DIFFERENT_WAREHOUSE,
  );

  return inventoryRepository.findByWarehouseAndOrder(
    warehouseId,
    orderId,
    session,
  );
};

const updateCondition = async (orderId, condition, session = null) => {
  if (!Object.values(INVENTORY_CONDITIONS).includes(condition)) {
    throw new ApiError(400, INVENTORY_MESSAGES.INVALID_CONDITION);
  }

  return inventoryRepository.updateConditionByOrderId(
    orderId,
    condition,
    session,
  );
};

const updateLocation = async (
  inventoryId,
  location,
  currentUser = null,
  session = null,
) => {
  if (!location || !location.trim()) {
    throw new ApiError(400, INVENTORY_MESSAGES.LOCATION_EMPTY);
  }

  const existingInventory = await getById(inventoryId, true, session);

  if (existingInventory.status !== INVENTORY_STATUSES.IN_STOCK) {
    throw new ApiError(400, INVENTORY_MESSAGES.CANNOT_UPDATE_NOT_IN_STOCK);
  }

  checkWarehouseAccess(
    existingInventory.warehouseId,
    currentUser,
    INVENTORY_MESSAGES.UNAUTHORIZED_UPDATE_DIFFERENT_WAREHOUSE,
  );

  const updatedInventory = await inventoryRepository.updateById(
    inventoryId,
    {
      location: location.trim(),
    },
    session,
    { status: INVENTORY_STATUSES.IN_STOCK },
  );

  if (!updatedInventory) {
    throw new ApiError(409, INVENTORY_MESSAGES.CONCURRENT_MODIFICATION);
  }

  return updatedInventory;
};

const updateStatus = async (inventoryId, status, session = null) => {
  if (!Object.values(INVENTORY_STATUSES).includes(status)) {
    throw new ApiError(400, INVENTORY_MESSAGES.INVALID_STATUS);
  }

  await getById(inventoryId, true, session);

  return inventoryRepository.updateById(inventoryId, { status }, session);
};

const updateQuantity = async (inventoryId, quantity, session = null) => {
  if (quantity === undefined || quantity < 0) {
    throw new ApiError(400, INVENTORY_MESSAGES.QTY_MUST_BE_NON_NEGATIVE);
  }

  await getById(inventoryId, true, session);

  return inventoryRepository.updateById(inventoryId, { quantity }, session);
};

const updateConditionById = async (
  inventoryId,
  condition,
  currentUser = null,
  session = null,
) => {
  if (!Object.values(INVENTORY_CONDITIONS).includes(condition)) {
    throw new ApiError(400, INVENTORY_MESSAGES.INVALID_CONDITION);
  }

  const existingInventory = await getById(inventoryId, true, session);

  if (existingInventory.status !== INVENTORY_STATUSES.IN_STOCK) {
    throw new ApiError(400, INVENTORY_MESSAGES.CANNOT_UPDATE_NOT_IN_STOCK);
  }

  checkWarehouseAccess(
    existingInventory.warehouseId,
    currentUser,
    INVENTORY_MESSAGES.UNAUTHORIZED_UPDATE_DIFFERENT_WAREHOUSE,
  );

  const updatedInventory = await inventoryRepository.updateConditionById(
    inventoryId,
    condition,
    session,
  );

  if (!updatedInventory) {
    throw new ApiError(409, INVENTORY_MESSAGES.CONCURRENT_MODIFICATION);
  }

  return updatedInventory;
};

const markAsIssuedByOrderId = async (
  orderId,
  warehouseId = null,
  session = null,
) => {
  const updated = await inventoryRepository.markAsIssuedAtomic(
    orderId,
    warehouseId,
    session,
  );

  if (!updated) {
    const existing = await inventoryRepository.findByOrderId(
      orderId,
      warehouseId,
      session,
    );
    if (!existing || existing.deletedAt) {
      throw new ApiError(404, INVENTORY_MESSAGES.RECORD_NOT_FOUND);
    }

    if (existing.status === INVENTORY_STATUSES.ISSUED) {
      throw new ApiError(400, INVENTORY_MESSAGES.ALREADY_ISSUED);
    }

    throw new ApiError(409, INVENTORY_MESSAGES.CONCURRENT_UPDATE_ERROR);
  }

  return updated;
};

const softDelete = async (inventoryId, session = null, currentUser = null) => {
  await getById(inventoryId, true, session, currentUser);

  return inventoryRepository.deleteById(inventoryId, session);
};

const softDeleteByOrderId = async (
  orderId,
  session = null,
  currentUser = null,
) => {
  const inventory = await getByOrderId(orderId, session, currentUser);

  return inventoryRepository.deleteById(inventory._id, session);
};

const softDeleteInStockByWarehouseAndOrder = async (
  warehouseId,
  orderId,
  session = null,
  currentUser = null,
) => {
  if (!warehouseId || !orderId) {
    throw new ApiError(400, INVENTORY_MESSAGES.WAREHOUSE_AND_ORDER_REQUIRED);
  }

  checkWarehouseAccess(
    warehouseId,
    currentUser,
    INVENTORY_MESSAGES.UNAUTHORIZED_DELETE_DIFFERENT_WAREHOUSE,
  );

  return inventoryRepository.softDeleteInStockByWarehouseAndOrder(
    warehouseId,
    orderId,
    session,
  );
};

const getSummary = async (session = null, currentUser = null) => {
  const stockFilter = { status: INVENTORY_STATUSES.IN_STOCK };
  const issuedFilter = { status: INVENTORY_STATUSES.ISSUED };

  const isWarehouseScoped =
    currentUser?.role === ROLES.WAREHOUSE_STAFF ||
    currentUser?.role === ROLES.DISPATCHER;

  let scopedWarehouseId = null;
  if (isWarehouseScoped) {
    if (!currentUser.warehouseId) {
      const message =
        currentUser.role === ROLES.DISPATCHER
          ? WAREHOUSE_MESSAGES.DISPATCHER_NOT_ASSIGNED
          : WAREHOUSE_MESSAGES.STAFF_NOT_ASSIGNED;
      throw new ApiError(403, message);
    }
    scopedWarehouseId = currentUser.warehouseId;
    stockFilter.warehouseId = scopedWarehouseId;
    issuedFilter.warehouseId = scopedWarehouseId;
  }

  const [warehouseStock, totalInStockOrders, totalIssuedOrders] =
    await Promise.all([
      inventoryRepository.aggregateStockByWarehouse(scopedWarehouseId, session),
      inventoryRepository.countAll({
        filter: stockFilter,
        session,
      }),
      inventoryRepository.countAll({
        filter: issuedFilter,
        session,
      }),
    ]);

  return {
    totalInStockOrders,
    totalIssuedOrders,
    warehouseStock,
  };
};

const countAll = async ({ filter = {}, session = null } = {}) => {
  return inventoryRepository.countAll({ filter, session });
};

export default {
  create,
  getAll,
  getById,
  getByOrderId,
  getInStockByOrderId,
  getByWarehouseAndOrder,
  updateLocation,
  updateStatus,
  updateQuantity,
  updateCondition,
  updateConditionById,
  markAsIssuedByOrderId,
  markAsInStockAtomic,
  softDelete,
  softDeleteByOrderId,
  softDeleteInStockByWarehouseAndOrder,
  getSummary,
  countAll,
};
