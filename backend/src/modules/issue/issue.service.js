import mongoose from "mongoose";

import ROLES from "../../constants/roles.js";
import TRIP_TYPES from "../../constants/tripTypes.js";
import ISSUE_STATUSES from "../../constants/issueStatuses.js";
import {
  INVENTORY_STATUSES,
  INVENTORY_CONDITIONS,
} from "../../constants/inventoryStatuses.js";
import {
  ISSUE_MESSAGES,
  WAREHOUSE_MESSAGES,
} from "../../constants/messages.js";

import ApiError from "../../utils/ApiError.js";
import generateCode from "../../utils/generateCode.js";
import checkWarehouseAccess from "../../utils/checkWarehouseAccess.js";
import { escapeRegex } from "../../utils/regexUtils.js";

import tripService from "../trip/trip.service.js";
import orderService from "../order/order.service.js";
import goodsCategoryService from "../goodsCategory/goodsCategory.service.js";
import warehouseService from "../warehouse/warehouse.service.js";
import userService from "../user/user.service.js";
import inventoryService from "../inventory/inventory.service.js";

import issueRepository from "./issue.repository.js";

const validateIssue = (issue) => {
  if (!issue) {
    throw new ApiError(404, ISSUE_MESSAGES.NOT_FOUND);
  }
};

const create = async (
  { orderId, goodsCategoryId, warehouseId, tripId, issuedBy, quantity, note },
  currentUser = null,
) => {
  if (quantity <= 0) {
    throw new ApiError(400, ISSUE_MESSAGES.QTY_GREATER_THAN_ZERO);
  }

  if (currentUser && currentUser.role === ROLES.WAREHOUSE_STAFF) {
    if (!currentUser.warehouseId) {
      throw new ApiError(403, ISSUE_MESSAGES.STAFF_NOT_ASSIGNED);
    }
    if (currentUser.warehouseId.toString() !== warehouseId.toString()) {
      throw new ApiError(403, ISSUE_MESSAGES.NOT_AUTHORIZED_WAREHOUSE);
    }
  }

  const trip = await tripService.getById(tripId, true);
  if (trip.status !== "planned" && trip.status !== "in_progress") {
    throw new ApiError(400, ISSUE_MESSAGES.TRIP_STATUS_INVALID(trip.status));
  }

  const order = await orderService.getById(orderId, true);
  if (order.status !== "stored") {
    throw new ApiError(
      400,
      ISSUE_MESSAGES.ORDER_STATUS_NOT_STORED(order.status),
    );
  }

  const orderTripId = order.tripId?._id
    ? order.tripId._id.toString()
    : order.tripId?.toString();
  if (!orderTripId) {
    throw new ApiError(400, ISSUE_MESSAGES.ORDER_NOT_ASSIGNED_TRIP);
  }

  if (orderTripId !== tripId.toString()) {
    throw new ApiError(400, ISSUE_MESSAGES.ORDER_ASSIGNED_DIFFERENT_TRIP);
  }

  await warehouseService.getById(warehouseId, true, true);

  if (goodsCategoryId) {
    await goodsCategoryService.getById(goodsCategoryId);
  }

  if (!issuedBy) {
    throw new ApiError(400, ISSUE_MESSAGES.ISSUED_BY_REQUIRED);
  }

  await userService.getById(issuedBy);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const inventory = await inventoryService.getByWarehouseAndOrder(
      warehouseId,
      orderId,
      session,
    );
    if (!inventory || inventory.deletedAt) {
      throw new ApiError(404, ISSUE_MESSAGES.INVENTORY_NOT_FOUND);
    }

    if (inventory.status !== INVENTORY_STATUSES.IN_STOCK) {
      throw new ApiError(400, ISSUE_MESSAGES.INVENTORY_NOT_IN_STOCK);
    }

    if (inventory.condition === INVENTORY_CONDITIONS.DAMAGED) {
      throw new ApiError(400, ISSUE_MESSAGES.CANNOT_ISSUE_DAMAGED);
    }

    if (inventory.quantity !== quantity) {
      throw new ApiError(400, ISSUE_MESSAGES.QTY_MISMATCH(inventory.quantity));
    }

    const inventoryCategoryId = inventory.goodsCategoryId?._id
      ? inventory.goodsCategoryId._id.toString()
      : inventory.goodsCategoryId?.toString();

    if (
      goodsCategoryId &&
      inventoryCategoryId &&
      goodsCategoryId.toString() !== inventoryCategoryId
    ) {
      throw new ApiError(400, ISSUE_MESSAGES.CATEGORY_MISMATCH);
    }

    const resolvedCategoryId = inventoryCategoryId;

    let issueCode;
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 5) {
      issueCode = generateCode("IS-");
      const existing = await issueRepository.findByIssueCode(issueCode);
      if (!existing) {
        isUnique = true;
      }
      attempts += 1;
    }

    if (!isUnique) {
      throw new ApiError(500, ISSUE_MESSAGES.CODE_GEN_FAILED);
    }

    const newIssue = await issueRepository.create(
      {
        issueCode,
        orderId,
        goodsCategoryId: resolvedCategoryId,
        warehouseId,
        tripId,
        issuedBy,
        quantity,
        note,
        status: ISSUE_STATUSES.COMPLETED,
        issuedAt: new Date(),
      },
      session,
    );

    await inventoryService.markAsIssuedByOrderId(orderId, warehouseId, session);

    const targetStatus =
      trip.type === TRIP_TYPES.TRANSFER ? "transporting" : "out_for_delivery";

    await orderService.addTrackingLog({
      orderId,
      tripId,
      status: targetStatus,
      notes: `Hàng xuất kho theo phiếu ${issueCode}`,
      changedBy: issuedBy,
      session,
    });

    await session.commitTransaction();
    return await issueRepository.findById(newIssue._id);
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    throw error;
  } finally {
    session.endSession();
  }
};

const getAll = async (query = {}, currentUser = null) => {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const filter = {};

  if (query.issueCode) {
    filter.issueCode = {
      $regex: escapeRegex(query.issueCode.trim()),
      $options: "i",
    };
  }

  const isWarehouseScoped =
    currentUser?.role === ROLES.WAREHOUSE_STAFF ||
    currentUser?.role === ROLES.DISPATCHER;

  if (isWarehouseScoped) {
    if (!currentUser.warehouseId) {
      const msg =
        currentUser.role === ROLES.DISPATCHER
          ? WAREHOUSE_MESSAGES.DISPATCHER_NOT_ASSIGNED
          : WAREHOUSE_MESSAGES.STAFF_NOT_ASSIGNED;
      throw new ApiError(403, msg);
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

  if (query.tripId) {
    filter.tripId = query.tripId;
  }

  if (query.issuedBy) {
    filter.issuedBy = query.issuedBy;
  }

  if (query.status) {
    filter.status = query.status;
  }

  if (query.fromDate || query.toDate) {
    filter.issuedAt = {};
    if (query.fromDate) {
      const fromDate = new Date(query.fromDate);
      fromDate.setUTCHours(0, 0, 0, 0);
      filter.issuedAt.$gte = fromDate;
    }

    if (query.toDate) {
      const toDate = new Date(query.toDate);
      toDate.setUTCHours(23, 59, 59, 999);
      filter.issuedAt.$lte = toDate;
    }
  }

  let sort = { createdAt: -1 };
  if (query.sortBy) {
    const order = query.sortOrder === "asc" ? 1 : -1;
    sort = { [query.sortBy]: order };
  }

  const [issues, total] = await Promise.all([
    issueRepository.findAll({ filter, skip, limit, sort }),
    issueRepository.countAll({ filter }),
  ]);

  return {
    data: issues,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getById = async (issueId, currentUser = null) => {
  const issue = await issueRepository.findById(issueId);

  validateIssue(issue);

  checkWarehouseAccess(
    issue.warehouseId,
    currentUser,
    WAREHOUSE_MESSAGES.ACCESS_DENIED,
  );

  return issue;
};

const getByCode = async (issueCode, currentUser = null) => {
  const issue = await issueRepository.findByIssueCode(issueCode);

  validateIssue(issue);

  checkWarehouseAccess(
    issue.warehouseId,
    currentUser,
    WAREHOUSE_MESSAGES.ACCESS_DENIED,
  );

  return issue;
};

const getByOrderId = async (orderId, currentUser = null) => {
  const scopedWarehouseId =
    currentUser?.role === ROLES.WAREHOUSE_STAFF ||
    currentUser?.role === ROLES.DISPATCHER
      ? currentUser.warehouseId
      : null;

  const issue = await issueRepository.findByOrderId(orderId, scopedWarehouseId);

  validateIssue(issue);

  checkWarehouseAccess(
    issue.warehouseId,
    currentUser,
    WAREHOUSE_MESSAGES.ACCESS_DENIED,
  );

  return issue;
};

const getByTripId = async (
  tripId,
  { page = 1, limit = 10, sort = { createdAt: -1 } } = {},
  currentUser = null,
) => {
  const trip = await tripService.getById(tripId, true);

  if (currentUser && currentUser.role === ROLES.DRIVER) {
    const assignedDriverId = trip.driverId?._id
      ? trip.driverId._id.toString()
      : trip.driverId?.toString();

    const driverUserId = trip.driverId?.userId?._id
      ? trip.driverId.userId._id.toString()
      : trip.driverId?.userId?.toString();

    const currentDriverId = currentUser.driverId
      ? currentUser.driverId.toString()
      : null;

    const currentUserId = currentUser.userId
      ? currentUser.userId.toString()
      : null;

    const isAuthorized =
      (currentDriverId && assignedDriverId === currentDriverId) ||
      (currentUserId && driverUserId === currentUserId);

    if (!isAuthorized) {
      throw new ApiError(403, WAREHOUSE_MESSAGES.ACCESS_DENIED);
    }
  }

  const tripIssueFilter = {};
  const isWarehouseScopedTrip =
    currentUser?.role === ROLES.WAREHOUSE_STAFF ||
    currentUser?.role === ROLES.DISPATCHER;

  if (currentUser && isWarehouseScopedTrip) {
    if (!currentUser.warehouseId) {
      const msg =
        currentUser.role === ROLES.DISPATCHER
          ? WAREHOUSE_MESSAGES.DISPATCHER_NOT_ASSIGNED
          : WAREHOUSE_MESSAGES.STAFF_NOT_ASSIGNED;
      throw new ApiError(403, msg);
    }
    tripIssueFilter.warehouseId = currentUser.warehouseId;
  }

  const skip = (page - 1) * limit;

  const [issues, total] = await Promise.all([
    issueRepository.findByTripId(tripId, {
      skip,
      limit,
      sort,
      filter: tripIssueFilter,
    }),
    issueRepository.countByTripId(tripId, tripIssueFilter),
  ]);

  return {
    data: issues,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const cancel = async (issueId, { note } = {}, currentUser = null) => {
  const existingIssue = await getById(issueId, currentUser);

  if (existingIssue.status === ISSUE_STATUSES.CANCELLED) {
    throw new ApiError(400, ISSUE_MESSAGES.ALREADY_CANCELLED);
  }

  const issueWarehouseId = existingIssue.warehouseId?._id
    ? existingIssue.warehouseId._id.toString()
    : existingIssue.warehouseId?.toString();

  const warehouse = await warehouseService.getById(issueWarehouseId, false);

  if (currentUser && currentUser.role === ROLES.WAREHOUSE_STAFF) {
    const currentUserId = (currentUser.userId || currentUser._id)?.toString();

    const issuedBy = existingIssue.issuedBy?._id
      ? existingIssue.issuedBy._id.toString()
      : existingIssue.issuedBy?.toString();

    const managerId = warehouse.managerId?._id
      ? warehouse.managerId._id.toString()
      : warehouse.managerId?.toString();

    const isStaffWarehouse =
      currentUser.warehouseId &&
      currentUser.warehouseId.toString() === issueWarehouseId;

    const isAuthorized =
      isStaffWarehouse &&
      (currentUserId === issuedBy || currentUserId === managerId);

    if (!isAuthorized) {
      throw new ApiError(403, ISSUE_MESSAGES.CANCEL_NOT_AUTHORIZED);
    }
  }

  const orderId = existingIssue.orderId?._id || existingIssue.orderId;
  const tripId = existingIssue.tripId?._id || existingIssue.tripId;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const latestIssue = await issueRepository.findById(issueId, session);
    if (!latestIssue || latestIssue.status === ISSUE_STATUSES.CANCELLED) {
      throw new ApiError(400, ISSUE_MESSAGES.ALREADY_CANCELLED);
    }

    const latestOrder = await orderService.getById(
      orderId,
      true,
      currentUser,
      session,
    );
    if (
      latestOrder.status !== "out_for_delivery" &&
      latestOrder.status !== "transporting"
    ) {
      throw new ApiError(
        400,
        ISSUE_MESSAGES.CANNOT_CANCEL_ORDER_STATUS(latestOrder.status),
      );
    }

    const latestTrip = await tripService.getById(
      tripId,
      true,
      currentUser,
      session,
    );
    if (latestTrip.status !== "planned") {
      throw new ApiError(
        400,
        ISSUE_MESSAGES.CANNOT_CANCEL_TRIP_STATUS(latestTrip.status),
      );
    }

    const inventory = await inventoryService.getByWarehouseAndOrder(
      issueWarehouseId,
      orderId,
      session,
      currentUser,
    );

    if (!inventory || inventory.deletedAt) {
      throw new ApiError(404, ISSUE_MESSAGES.CANCEL_FAILED_INVENTORY_NOT_FOUND);
    }

    const updated = await issueRepository.cancelAtomic(
      issueId,
      { note: note ?? latestIssue.note },
      session,
    );

    if (!updated) {
      throw new ApiError(409, ISSUE_MESSAGES.CANCEL_FAILED_MODIFIED);
    }

    const restoredInventory = await inventoryService.markAsInStockAtomic(
      inventory._id,
      session,
    );

    if (!restoredInventory) {
      throw new ApiError(409, ISSUE_MESSAGES.CANCEL_FAILED_NOT_ISSUED);
    }

    await orderService.addTrackingLog({
      orderId,
      tripId,
      status: "stored",
      notes: `Hủy phiếu xuất kho ${existingIssue.issueCode}`,
      changedBy:
        currentUser?.userId ||
        currentUser?._id ||
        existingIssue.issuedBy?._id ||
        existingIssue.issuedBy,
      session,
    });

    await session.commitTransaction();
    return updated;
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    throw error;
  } finally {
    session.endSession();
  }
};

const updateNote = async (issueId, { note }, currentUser = null) => {
  const existingIssue = await getById(issueId, currentUser);

  if (existingIssue.status === ISSUE_STATUSES.CANCELLED) {
    throw new ApiError(400, ISSUE_MESSAGES.CANNOT_UPDATE_CANCELLED);
  }

  checkWarehouseAccess(
    existingIssue.warehouseId,
    currentUser,
    WAREHOUSE_MESSAGES.ACCESS_DENIED,
  );

  const updatedIssue = await issueRepository.updateById(
    issueId,
    { note },
    null,
    {
      status: { $ne: ISSUE_STATUSES.CANCELLED },
    },
  );

  validateIssue(updatedIssue);

  return updatedIssue;
};

export default {
  create,
  getAll,
  getById,
  getByCode,
  getByOrderId,
  getByTripId,
  cancel,
  updateNote,
};
