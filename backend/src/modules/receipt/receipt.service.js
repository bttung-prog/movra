import mongoose from "mongoose";

import ROLES from "../../constants/roles.js";
import RECEIPT_STATUSES from "../../constants/receiptStatuses.js";
import {
  INVENTORY_STATUSES,
  INVENTORY_CONDITIONS,
} from "../../constants/inventoryStatuses.js";
import {
  RECEIPT_MESSAGES,
  WAREHOUSE_MESSAGES,
} from "../../constants/messages.js";

import ApiError from "../../utils/ApiError.js";
import generateCode from "../../utils/generateCode.js";
import checkWarehouseAccess from "../../utils/checkWarehouseAccess.js";
import { escapeRegex } from "../../utils/regexUtils.js";

import orderService from "../order/order.service.js";
import goodsCategoryService from "../goodsCategory/goodsCategory.service.js";
import warehouseService from "../warehouse/warehouse.service.js";
import userService from "../user/user.service.js";
import inventoryService from "../inventory/inventory.service.js";
import tripService from "../trip/trip.service.js";

import receiptRepository from "./receipt.repository.js";

const validateReceipt = (receipt) => {
  if (!receipt) {
    throw new ApiError(404, RECEIPT_MESSAGES.NOT_FOUND);
  }
};

const create = async (
  {
    orderId,
    goodsCategoryId,
    warehouseId,
    receivedBy,
    quantity,
    condition = INVENTORY_CONDITIONS.GOOD,
    location = "RECEIVING_AREA",
    receivedAt,
    note = "",
  },
  currentUser = null,
  session = null,
) => {
  if (quantity <= 0) {
    throw new ApiError(400, RECEIPT_MESSAGES.QTY_GREATER_THAN_ZERO);
  }

  if (currentUser && currentUser.role === ROLES.WAREHOUSE_STAFF) {
    if (!currentUser.warehouseId) {
      throw new ApiError(403, RECEIPT_MESSAGES.STAFF_NOT_ASSIGNED);
    }
    if (currentUser.warehouseId.toString() !== warehouseId.toString()) {
      throw new ApiError(403, RECEIPT_MESSAGES.NOT_AUTHORIZED_WAREHOUSE);
    }
  }

  const order = await orderService.getById(orderId, true);
  const previousWarehouseId = order.warehouseId || null;
  const previousWarehouseIdString = previousWarehouseId?.toString();
  if (order.status !== "picked_up") {
    throw new ApiError(
      400,
      RECEIPT_MESSAGES.ORDER_STATUS_INVALID(order.status),
    );
  }

  if (order.quantity && quantity !== order.quantity) {
    throw new ApiError(
      400,
      RECEIPT_MESSAGES.QTY_MISMATCH(quantity, order.quantity),
    );
  }

  const orderCategoryId = order.goodCategory?._id?.toString();

  if (
    goodsCategoryId &&
    orderCategoryId &&
    goodsCategoryId.toString() !== orderCategoryId
  ) {
    throw new ApiError(400, RECEIPT_MESSAGES.CATEGORY_MISMATCH);
  }

  const resolvedCategoryId = orderCategoryId;
  if (!resolvedCategoryId) {
    throw new ApiError(400, RECEIPT_MESSAGES.CATEGORY_REQUIRED);
  }

  if (!receivedBy) {
    throw new ApiError(400, RECEIPT_MESSAGES.RECEIVED_BY_REQUIRED);
  }

  await userService.getById(receivedBy);
  await goodsCategoryService.getById(resolvedCategoryId);
  const warehouse = await warehouseService.getById(warehouseId, true, true);

  const inStockElsewhere = await inventoryService.getInStockByOrderId(orderId);
  if (inStockElsewhere) {
    const stockWarehouseId = inStockElsewhere.warehouseId?._id?.toString();

    if (stockWarehouseId === warehouseId.toString()) {
      throw new ApiError(400, RECEIPT_MESSAGES.ORDER_ALREADY_IN_STOCK);
    } else {
      throw new ApiError(400, RECEIPT_MESSAGES.ORDER_IN_ANOTHER_WAREHOUSE);
    }
  }

  let receiptCode;
  let isUnique = false;
  let attempts = 0;

  while (!isUnique && attempts < 5) {
    receiptCode = generateCode("RC-");
    const existing = await receiptRepository.findByReceiptCode(receiptCode);
    if (!existing) {
      isUnique = true;
    }
    attempts += 1;
  }

  if (!isUnique) {
    throw new ApiError(500, RECEIPT_MESSAGES.CODE_GEN_FAILED);
  }

  const isInternalSession = !session;
  const dbSession = session || (await mongoose.startSession());
  if (isInternalSession) {
    dbSession.startTransaction();
  }

  try {
    const newReceipt = await receiptRepository.create(
      {
        receiptCode,
        orderId,
        goodsCategoryId: resolvedCategoryId,
        warehouseId,
        previousWarehouseId,
        previousOrderStatus: order.status,
        receivedBy,
        quantity,
        condition,
        receivedAt: receivedAt || new Date(),
        status: RECEIPT_STATUSES.COMPLETED,
        note,
      },
      dbSession,
    );

    await inventoryService.create(
      {
        warehouseId,
        orderId,
        goodsCategoryId: resolvedCategoryId,
        quantity,
        location,
        condition,
        status: INVENTORY_STATUSES.IN_STOCK,
      },
      dbSession,
    );

    await orderService.addTrackingLog({
      orderId,
      tripId: order.tripId?._id || order.tripId,
      status: "stored",
      notes:
        previousWarehouseIdString &&
        previousWarehouseIdString !== warehouseId.toString()
          ? `Chuyển kho từ ${previousWarehouseId} đến ${warehouse.warehouseName} theo phiếu ${receiptCode}`
          : `Hàng đã nhập kho ${warehouse.warehouseName} theo phiếu ${receiptCode}`,
      changedBy: receivedBy,
      warehouseId,
      expectedStatus: order.status,
      expectedWarehouseId: previousWarehouseId,
      clearTrip: true,
      session: dbSession,
    });

    const pickupTripId = order.tripId?._id || order.tripId;
    if (pickupTripId) {
      await tripService.syncTotalOrder(pickupTripId, dbSession);
    }

    if (isInternalSession) {
      await dbSession.commitTransaction();
    }
    return await receiptRepository.findById(newReceipt._id);
  } catch (error) {
    if (isInternalSession && dbSession.inTransaction()) {
      await dbSession.abortTransaction();
    }
    if (error.code === 11000) {
      throw new ApiError(409, RECEIPT_MESSAGES.ORDER_PROCESSING);
    }
    throw error;
  } finally {
    if (isInternalSession) {
      dbSession.endSession();
    }
  }
};

const getAll = async (query = {}, currentUser = null) => {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const filter = {};

  if (query.receiptCode) {
    filter.receiptCode = {
      $regex: escapeRegex(query.receiptCode.trim()),
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

  if (query.receivedBy) {
    filter.receivedBy = query.receivedBy;
  }

  if (query.status) {
    filter.status = query.status;
  }

  if (query.condition) {
    filter.condition = query.condition;
  }

  if (query.fromDate || query.toDate) {
    filter.receivedAt = {};
    if (query.fromDate) {
      const fromDate = new Date(query.fromDate);
      fromDate.setUTCHours(0, 0, 0, 0);
      filter.receivedAt.$gte = fromDate;
    }

    if (query.toDate) {
      const toDate = new Date(query.toDate);
      toDate.setUTCHours(23, 59, 59, 999);
      filter.receivedAt.$lte = toDate;
    }
  }

  let sort = { createdAt: -1 };
  if (query.sortBy) {
    const order = query.sortOrder === "asc" ? 1 : -1;
    sort = { [query.sortBy]: order };
  }

  const [receipts, total] = await Promise.all([
    receiptRepository.findAll({ filter, skip, limit, sort }),
    receiptRepository.countAll({ filter }),
  ]);

  return {
    data: receipts,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getById = async (receiptId, currentUser = null) => {
  const receipt = await receiptRepository.findById(receiptId);

  validateReceipt(receipt);

  checkWarehouseAccess(
    receipt.warehouseId,
    currentUser,
    WAREHOUSE_MESSAGES.ACCESS_DENIED,
  );

  return receipt;
};

const getByOrderId = async (orderId, currentUser = null) => {
  const scopedWarehouseId =
    currentUser?.role === ROLES.WAREHOUSE_STAFF ||
    currentUser?.role === ROLES.DISPATCHER
      ? currentUser.warehouseId
      : null;

  const receipt = await receiptRepository.findByOrderId(
    orderId,
    scopedWarehouseId,
  );

  validateReceipt(receipt);

  checkWarehouseAccess(
    receipt.warehouseId,
    currentUser,
    WAREHOUSE_MESSAGES.ACCESS_DENIED,
  );

  return receipt;
};

const cancel = async (receiptId, { note } = {}, currentUser = null) => {
  const existingReceipt = await getById(receiptId, currentUser);

  if (existingReceipt.status === RECEIPT_STATUSES.CANCELLED) {
    throw new ApiError(400, RECEIPT_MESSAGES.ALREADY_CANCELLED);
  }

  const receiptWarehouseId = existingReceipt.warehouseId?._id?.toString();

  const warehouse = await warehouseService.getById(receiptWarehouseId, false);

  if (currentUser && currentUser.role === ROLES.WAREHOUSE_STAFF) {
    const currentUserId = (currentUser.userId || currentUser._id)?.toString();

    const createdBy = existingReceipt.receivedBy?._id?.toString();

    const managerId = warehouse.managerId?._id?.toString();

    const isStaffWarehouse =
      currentUser.warehouseId &&
      currentUser.warehouseId.toString() === receiptWarehouseId;

    const isAuthorized =
      isStaffWarehouse &&
      (currentUserId === createdBy || currentUserId === managerId);

    if (!isAuthorized) {
      throw new ApiError(403, RECEIPT_MESSAGES.CANCEL_NOT_AUTHORIZED);
    }
  }

  const rawOrderId = existingReceipt.orderId?._id?.toString();

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const updated = await receiptRepository.cancelAtomic(
      receiptId,
      {
        note: note !== undefined ? note : existingReceipt.note,
      },
      session,
    );

    if (!updated) {
      throw new ApiError(409, RECEIPT_MESSAGES.CANCEL_FAILED_MODIFIED);
    }

    const deletedInventory =
      await inventoryService.softDeleteInStockByWarehouseAndOrder(
        receiptWarehouseId,
        rawOrderId,
        session,
        currentUser,
      );

    if (!deletedInventory) {
      throw new ApiError(400, RECEIPT_MESSAGES.CANNOT_CANCEL_NOT_IN_STOCK);
    }

    let restoredStatus = existingReceipt.previousOrderStatus;
    if (!restoredStatus) {
      const logsResult = await orderService.getTrackingLogsByOrderId({
        orderId: rawOrderId,
        limit: 5,
      });

      const previousLog = logsResult?.data?.find((l) => l.status !== "stored");
      if (!previousLog) {
        throw new ApiError(409, RECEIPT_MESSAGES.CANNOT_RESTORE_ORDER_STATUS);
      }

      restoredStatus = previousLog.status;
    }

    await orderService.addTrackingLog({
      orderId: rawOrderId,
      status: restoredStatus,
      notes: `Hủy phiếu nhập kho ${existingReceipt.receiptCode}`,
      changedBy:
        currentUser?.userId ||
        currentUser?._id ||
        existingReceipt.receivedBy?._id ||
        existingReceipt.receivedBy,
      ...(existingReceipt.previousWarehouseId !== undefined
        ? {
            warehouseId:
              existingReceipt.previousWarehouseId?._id ||
              existingReceipt.previousWarehouseId,
          }
        : {}),
      expectedStatus: "stored",
      expectedWarehouseId: receiptWarehouseId,
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

const updateById = async (receiptId, updateData, currentUser = null) => {
  const existingReceipt = await getById(receiptId, currentUser);

  if (existingReceipt.status === RECEIPT_STATUSES.CANCELLED) {
    throw new ApiError(400, RECEIPT_MESSAGES.CANNOT_UPDATE_CANCELLED);
  }

  if (updateData.status === RECEIPT_STATUSES.CANCELLED) {
    return cancel(receiptId, updateData, currentUser);
  }

  checkWarehouseAccess(
    existingReceipt.warehouseId,
    currentUser,
    WAREHOUSE_MESSAGES.ACCESS_DENIED,
  );

  if (
    updateData.warehouseId !== undefined ||
    updateData.orderId !== undefined ||
    updateData.goodsCategoryId !== undefined ||
    updateData.quantity !== undefined
  ) {
    throw new ApiError(400, RECEIPT_MESSAGES.CANNOT_MODIFY_CORE);
  }

  const allowedUpdates = {};
  if (updateData.note !== undefined) allowedUpdates.note = updateData.note;

  if (updateData.condition !== undefined) {
    allowedUpdates.condition = updateData.condition;
  }

  const receiptWarehouseId = existingReceipt.warehouseId?._id?.toString();

  const rawOrderId = existingReceipt.orderId?._id?.toString();

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const updated = await receiptRepository.updateById(
      receiptId,
      allowedUpdates,
      session,
    );

    if (allowedUpdates.condition && rawOrderId) {
      const currentInventory = await inventoryService.getByWarehouseAndOrder(
        receiptWarehouseId,
        rawOrderId,
        session,
      );

      if (
        !currentInventory ||
        currentInventory.status !== INVENTORY_STATUSES.IN_STOCK
      ) {
        throw new ApiError(400, RECEIPT_MESSAGES.CANNOT_MODIFY_NOT_IN_STOCK);
      }

      await inventoryService.updateConditionById(
        currentInventory._id,
        allowedUpdates.condition,
        currentUser,
        session,
      );
    }

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

const getByCode = async (receiptCode, currentUser = null) => {
  const receipt = await receiptRepository.findByReceiptCode(receiptCode);

  validateReceipt(receipt);

  checkWarehouseAccess(
    receipt.warehouseId,
    currentUser,
    WAREHOUSE_MESSAGES.ACCESS_DENIED,
  );

  return receipt;
};

export default {
  create,
  getAll,
  getById,
  getByCode,
  getByOrderId,
  cancel,
  updateById,
};
