import mongoose from "mongoose";

import PAYMENT_METHODS from "../../constants/paymentMethods.js";
import {
  WALLET_TRANSACTION_TYPES,
  WALLET_TRANSACTION_DIRECTIONS,
} from "../../constants/walletTransactionTypes.js";
import { WALLET_TRANSACTION_STATUSES } from "../../constants/walletTransactionStatuses.js";
import ROLES from "../../constants/roles.js";
import TRIP_TYPES from "../../constants/tripTypes.js";
import {
  ORDER_MESSAGES,
  PAYMENT_MESSAGES,
  WAREHOUSE_MESSAGES,
} from "../../constants/messages.js";

import ApiError from "../../utils/ApiError.js";
import generateCode from "../../utils/generateCode.js";
import checkWarehouseAccess from "../../utils/checkWarehouseAccess.js";
import logger from "../../configs/logger.js";

import customerService from "../customer/customer.service.js";
import goodsCategoryService from "../goodsCategory/goodsCategory.service.js";
import routeService from "../route/route.service.js";
import tripService from "../trip/trip.service.js";
import userService from "../user/user.service.js";
import pricingService from "../pricing/pricing.service.js";
import notificationService from "../notification/notification.service.js";
import walletTransactionService from "../walletTransaction/walletTransaction.service.js";
import warehouseService from "../warehouse/warehouse.service.js";

import orderRepository from "./order.repository.js";

const SETTLEMENT_SENSITIVE_ORDER_FIELDS = [
  "customerId",
  "codAmount",
  "codCollected",
  "codCollectedAmount",
  "codRemittedAmount",
  "shippingFee",
  "shippingFeePaid",
  "shippingFeePaidAmount",
];

const TRACKING_STATUS_TRANSITIONS = {
  driver_assigned: ["pickup_scheduled", "picked_up"],
  pickup_scheduled: ["picked_up"],
  picked_up: [
    "stored",
    "transporting",
    "out_for_delivery",
    "delivery_scheduled",
  ],
  stored: ["transporting", "out_for_delivery", "delivery_scheduled"],
  transporting: ["out_for_delivery", "delivery_scheduled"],
  out_for_delivery: ["delivery_scheduled"],
  delivery_scheduled: ["out_for_delivery"],
};

const validateOrder = (order, requireNotDeleted = true) => {
  if (!order) {
    throw new ApiError(404, ORDER_MESSAGES.NOT_FOUND);
  }

  if (requireNotDeleted && order.deletedAt !== null) {
    throw new ApiError(400, ORDER_MESSAGES.ALREADY_DELETED);
  }

  return order;
};

const checkOrderOwnership = (order, user) => {
  if (user?.role === "customer") {
    const orderCustomerId = (
      order.customerId?._id || order.customerId
    )?.toString();

    if (!user.customerId || orderCustomerId !== user.customerId.toString()) {
      throw new ApiError(403, ORDER_MESSAGES.ACCESS_DENIED);
    }
  }
};

const assertDriverAssignedToTrip = (trip, user) => {
  if (user?.role !== ROLES.DRIVER) return;

  const assignedDriverId = (trip.driverId?._id || trip.driverId)?.toString();
  const assignedUserId = (
    trip.driverId?.userId?._id || trip.driverId?.userId
  )?.toString();
  const isAssigned =
    (user.driverId && assignedDriverId === user.driverId.toString()) ||
    (user.userId && assignedUserId === user.userId.toString());

  if (!isAssigned) {
    throw new ApiError(403, ORDER_MESSAGES.NOT_DRIVER_OF_TRIP);
  }
};

const assertOrderWarehouseAccess = async (order, user) => {
  if (user?.role === ROLES.DRIVER) {
    const tripId = order.tripId?._id || order.tripId;
    if (!tripId) {
      throw new ApiError(403, ORDER_MESSAGES.NOT_DRIVER_OF_TRIP);
    }

    const trip = order.tripId?.driverId
      ? order.tripId
      : await tripService.getById(tripId, false, user);
    assertDriverAssignedToTrip(trip, user);
    return;
  }

  if (user?.role !== ROLES.DISPATCHER) return;

  const tripId = order.tripId?._id || order.tripId;
  if (tripId) {
    if (order.warehouseId) {
      checkWarehouseAccess(order.warehouseId, user);
    }
    await tripService.getById(tripId, false, user);
    return;
  }

  checkWarehouseAccess(order.warehouseId, user);
};

const scopeOrderFilter = async (filter, user) => {
  if (user?.role !== ROLES.DISPATCHER) return filter;
  if (!user.warehouseId) {
    throw new ApiError(403, WAREHOUSE_MESSAGES.DISPATCHER_NOT_ASSIGNED);
  }

  const tripIds = await tripService.getIdsByWarehouseId(user.warehouseId);
  return {
    $and: [
      filter,
      {
        $and: [
          {
            $or: [
              { warehouseId: user.warehouseId },
              {
                tripId: { $in: tripIds },
                $or: [
                  { warehouseId: null },
                  { warehouseId: { $exists: false } },
                ],
              },
            ],
          },
          { $or: [{ tripId: null }, { tripId: { $in: tripIds } }] },
        ],
      },
    ],
  };
};

const getIdsByWarehouseId = async (warehouseId) => {
  const tripIds = await tripService.getIdsByWarehouseId(warehouseId);
  return orderRepository.findIdsByWarehouseId(warehouseId, tripIds);
};

const countByTripId = (tripId, session = null) => {
  return orderRepository.countByTripId(tripId, session);
};

const countRouteMismatchesByTripId = (tripId, routeId) => {
  return orderRepository.countRouteMismatchesByTripId(tripId, routeId);
};

// ==========================================
// ORDER SERVICES
// ==========================================

const create = async (
  {
    customerId,
    senderName,
    senderPhone,
    senderAddress,
    pickupLocation,
    recipientName,
    recipientPhone,
    recipientAddress,
    goodCategory,
    weight,
    volume,
    quantity,
    codAmount = 0,
    routeId,
    tripId,
    type = "normal",
    notes,
    createdBy,
    warehouseId = null,
  },
  session = null,
  user = null,
) => {
  if (!goodCategory) {
    throw new ApiError(400, ORDER_MESSAGES.CATEGORY_REQUIRED);
  }
  await goodsCategoryService.getById(goodCategory);

  if (!customerId) {
    throw new ApiError(400, ORDER_MESSAGES.CUSTOMER_REQUIRED);
  }
  const customer = await customerService.getById(customerId);

  if (user?.role === ROLES.CUSTOMER && tripId) {
    throw new ApiError(403, ORDER_MESSAGES.ACCESS_DENIED);
  }

  if (user?.role === ROLES.CUSTOMER && routeId) {
    throw new ApiError(400, ORDER_MESSAGES.CUSTOMER_ROUTE_NOT_ALLOWED);
  }

  if (routeId) {
    await routeService.getById(routeId);
  }

  if (user?.role === ROLES.DISPATCHER) {
    warehouseId = user.warehouseId;
    if (!warehouseId) {
      throw new ApiError(403, WAREHOUSE_MESSAGES.DISPATCHER_NOT_ASSIGNED);
    }
  } else if (user && user.role !== ROLES.ADMIN) {
    warehouseId = null;
  }

  let pickupDistanceKm;
  if (user?.role === ROLES.CUSTOMER) {
    if (
      !Number.isFinite(pickupLocation?.latitude) ||
      !Number.isFinite(pickupLocation?.longitude) ||
      pickupLocation.latitude < -90 ||
      pickupLocation.latitude > 90 ||
      pickupLocation.longitude < -180 ||
      pickupLocation.longitude > 180
    ) {
      throw new ApiError(400, ORDER_MESSAGES.PICKUP_LOCATION_REQUIRED);
    }

    const nearest = await warehouseService.getNearestActiveWarehouse(
      pickupLocation.latitude,
      pickupLocation.longitude,
    );
    warehouseId = nearest.warehouse._id;
    pickupDistanceKm = nearest.distanceKm;
  }

  if (warehouseId && user?.role === ROLES.ADMIN) {
    await warehouseService.getById(warehouseId, true, true);
  }

  if (tripId) {
    const trip = await tripService.getById(tripId, true, user);
    if (trip.status !== "planned") {
      throw new ApiError(400, ORDER_MESSAGES.TRIP_NOT_PLANNED);
    }
    const tripRouteId = trip.routeId?._id || trip.routeId;
    const tripWarehouseId =
      trip.warehouseId ||
      trip.driverId?.warehouseId?._id ||
      trip.driverId?.warehouseId;
    if (!routeId) {
      routeId = tripRouteId;
    }
    if (routeId && tripRouteId?.toString() !== routeId.toString()) {
      throw new ApiError(400, ORDER_MESSAGES.ROUTE_TRIP_MISMATCH);
    }
    if (warehouseId && warehouseId.toString() !== tripWarehouseId?.toString()) {
      throw new ApiError(400, WAREHOUSE_MESSAGES.ACCESS_DENIED);
    }
    warehouseId = warehouseId || tripWarehouseId;
  }

  if (createdBy) {
    await userService.getById(createdBy);
  }

  let orderCode;
  let isUnique = false;
  let attempts = 0;

  while (!isUnique && attempts < 5) {
    orderCode = generateCode("ORD-");
    const existing = await orderRepository.findByCode(orderCode);
    if (!existing) {
      isUnique = true;
    }
    attempts += 1;
  }

  if (!isUnique) {
    throw new ApiError(500, ORDER_MESSAGES.CODE_GEN_FAILED);
  }

  const feeResult = await pricingService.calculateFee({
    weight,
    volume,
    routeId,
    goodsCategoryId: goodCategory,
  });
  const effectiveShippingFee = Number(feeResult.totalShippingFee);
  if (!Number.isFinite(effectiveShippingFee) || effectiveShippingFee < 0) {
    throw new ApiError(500, ORDER_MESSAGES.INVALID_SHIPPING_FEE);
  }

  const calculatedTotal = effectiveShippingFee + Number(codAmount || 0);
  const initialOrderStatus = tripId ? "driver_assigned" : "created";

  const isInternalSession = !session;
  const dbSession = session || (await mongoose.startSession());
  if (isInternalSession) {
    dbSession.startTransaction();
  }

  try {
    if (tripId) {
      const currentTrip = await tripService.getById(
        tripId,
        true,
        user,
        dbSession,
      );
      if (currentTrip.status !== "planned") {
        throw new ApiError(400, ORDER_MESSAGES.TRIP_NOT_PLANNED);
      }
      const currentTripRouteId =
        currentTrip.routeId?._id || currentTrip.routeId;
      if (currentTripRouteId?.toString() !== routeId?.toString()) {
        throw new ApiError(400, ORDER_MESSAGES.ROUTE_TRIP_MISMATCH);
      }
    }

    const currentCustomer = await customerService.getById(
      customerId,
      dbSession,
    );
    const balanceBefore = Number(currentCustomer.walletBalance || 0);
    let balanceAfter = balanceBefore;

    if (effectiveShippingFee > 0) {
      const debitedCustomer = await customerService.debitWallet(
        customerId,
        effectiveShippingFee,
        dbSession,
      );
      if (!debitedCustomer) {
        throw new ApiError(400, PAYMENT_MESSAGES.INSUFFICIENT_WALLET_BALANCE);
      }

      balanceAfter = Number(debitedCustomer.walletBalance || 0);
      await customerService.updateById(
        customerId,
        {
          $inc: {
            totalSpent: effectiveShippingFee,
            loyaltyPoints: Math.floor(effectiveShippingFee / 10000),
          },
          lastPurchaseDate: new Date(),
        },
        dbSession,
      );
    }

    const newOrder = await orderRepository.create(
      {
        orderCode,
        customerId,
        senderName,
        senderPhone,
        senderAddress,
        pickupLocation,
        pickupDistanceKm,
        recipientName,
        recipientPhone,
        recipientAddress,
        goodCategory,
        weight,
        volume,
        quantity,
        codAmount,
        shippingFee: effectiveShippingFee,
        shippingFeePaid: true,
        shippingFeePaidAmount: effectiveShippingFee,
        totalAmount: calculatedTotal,
        routeId,
        tripId,
        warehouseId,
        type,
        paymentMethod: PAYMENT_METHODS.WALLET_BALANCE,
        paymentStatus: "success",
        paymentTime: new Date(),
        notes,
        status: initialOrderStatus,
        deliveryAttempts: 0,
      },
      dbSession,
    );

    if (tripId) {
      await tripService.syncTotalOrder(tripId, dbSession);
    }

    if (effectiveShippingFee > 0) {
      await walletTransactionService.recordTransaction(
        {
          customerId,
          type: WALLET_TRANSACTION_TYPES.PAYMENT,
          direction: WALLET_TRANSACTION_DIRECTIONS.DEBIT,
          amount: effectiveShippingFee,
          balanceBefore,
          balanceAfter,
          orderId: newOrder._id,
          status: WALLET_TRANSACTION_STATUSES.SUCCESS,
          notes: `Thanh toán phí vận chuyển đơn hàng ${newOrder.orderCode}`,
        },
        dbSession,
      );
    }

    await orderRepository.createTrackingLog(
      {
        orderId: newOrder._id,
        tripId,
        status: initialOrderStatus,
        notes: "Order created successfully",
        changedBy: createdBy,
      },
      dbSession,
    );

    if (isInternalSession) {
      await dbSession.commitTransaction();
    }

    try {
      await notificationService.create({
        userId: customer.userId._id || customer.userId,
        title: "Tạo đơn hàng thành công",
        message: `Đơn hàng #${newOrder.orderCode} của bạn đã được tạo thành công trên hệ thống.`,
        type: "ORDER_UPDATE",
        data: {
          orderId: newOrder._id,
          orderCode: newOrder.orderCode,
        },
      });
    } catch (error) {
      logger.error("Failed to create order notification", {
        orderId: newOrder._id,
        error: error.message,
      });
    }

    return newOrder;
  } catch (error) {
    if (isInternalSession) {
      await dbSession.abortTransaction();
    }
    throw error;
  } finally {
    if (isInternalSession) {
      dbSession.endSession();
    }
  }
};

const getAll = async ({
  filter = {},
  page = 1,
  limit = 10,
  sort = { createdAt: -1 },
  user = null,
} = {}) => {
  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const limitNumber = Math.max(1, parseInt(limit, 10) || 10);
  const skip = (pageNumber - 1) * limitNumber;

  const queryFilter = await scopeOrderFilter(
    { deletedAt: null, ...filter },
    user,
  );

  const [orders, total] = await Promise.all([
    orderRepository.findAll({
      filter: queryFilter,
      skip,
      limit: limitNumber,
      sort,
    }),
    orderRepository.countAll({ filter: queryFilter }),
  ]);

  return {
    data: orders,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages: Math.ceil(total / limitNumber),
    },
  };
};

const getMyOrders = async ({
  userId,
  customerId,
  filter = {},
  page = 1,
  limit = 10,
  sort = { createdAt: -1 },
} = {}) => {
  let effectiveCustomerId = customerId;
  if (!effectiveCustomerId && userId) {
    const customer = await customerService.getByUserId(userId);
    effectiveCustomerId = customer?._id;
  }

  return getAll({
    filter: {
      ...filter,
      customerId: effectiveCustomerId,
    },
    page,
    limit,
    sort,
  });
};

const getById = async (
  orderId,
  requireNotDeleted = true,
  user = null,
  session = null,
) => {
  const order = await orderRepository.findById(orderId, session);

  const validatedOrder = validateOrder(order, requireNotDeleted);
  checkOrderOwnership(validatedOrder, user);
  await assertOrderWarehouseAccess(validatedOrder, user);

  return validatedOrder;
};

const getByCode = async (orderCode, user = null) => {
  const order = await orderRepository.findByCode(orderCode);

  const validatedOrder = validateOrder(order, true);
  checkOrderOwnership(validatedOrder, user);
  await assertOrderWarehouseAccess(validatedOrder, user);

  return validatedOrder;
};

const getPublicTrackingByCode = async (orderCode) => {
  const order = await orderRepository.findByCode(orderCode);
  const validatedOrder = validateOrder(order, true);

  const trackingLogs = await orderRepository.findPublicTrackingLogsByOrderId(
    validatedOrder._id,
    { skip: 0, limit: 100, sort: { createdAt: 1 } },
  );

  return {
    orderCode: validatedOrder.orderCode,
    status: validatedOrder.status,
    weight: validatedOrder.weight,
    volume: validatedOrder.volume,
    type: validatedOrder.type,
    deliveredAt: validatedOrder.deliveredAt,
    createdAt: validatedOrder.createdAt,
    trackingLogs,
  };
};

const updateById = async ({
  orderId,
  updateData,
  session = null,
  conditions = {},
  user = null,
}) => {
  const existingOrder = await getById(orderId, true, user, session);

  if (user?.role === ROLES.DISPATCHER && updateData.warehouseId !== undefined) {
    throw new ApiError(403, WAREHOUSE_MESSAGES.ACCESS_DENIED);
  }

  if (updateData.warehouseId) {
    await warehouseService.getById(updateData.warehouseId, true, true);
  }

  if (updateData.tripId !== undefined) {
    throw new ApiError(
      400,
      ORDER_MESSAGES.ORDER_TRIP_CHANGE_REQUIRES_ASSIGNMENT,
    );
  }

  const restrictedStatuses = ["delivered", "returned", "cancelled"];
  if (restrictedStatuses.includes(existingOrder.status)) {
    const coreFields = [
      "goodCategory",
      "weight",
      "volume",
      "quantity",
      "routeId",
      "tripId",
      "senderAddress",
      "recipientAddress",
      "type",
    ];

    const hasCoreUpdate = coreFields.some(
      (field) => updateData[field] !== undefined,
    );
    if (hasCoreUpdate) {
      throw new ApiError(
        400,
        ORDER_MESSAGES.CANNOT_MODIFY_CORE(existingOrder.status),
      );
    }
  }

  const hasSettlementSensitiveUpdate = SETTLEMENT_SENSITIVE_ORDER_FIELDS.some(
    (field) => updateData[field] !== undefined,
  );
  const hasCodAmountChange =
    updateData.codAmount !== undefined &&
    Number(updateData.codAmount) !== Number(existingOrder.codAmount || 0);
  const currentCustomerId =
    existingOrder.customerId?._id || existingOrder.customerId;
  const requestedCustomerId =
    updateData.customerId?._id || updateData.customerId;
  const hasCustomerChange =
    requestedCustomerId !== undefined &&
    requestedCustomerId.toString() !== currentCustomerId.toString();
  const hasCodCollection =
    Number(existingOrder.codCollectedAmount || 0) > 0 ||
    Number(existingOrder.codRemittedAmount || 0) > 0;

  if (hasCodAmountChange && hasCodCollection) {
    throw new ApiError(409, ORDER_MESSAGES.COD_AMOUNT_LOCKED_AFTER_COLLECTION);
  }
  if (hasCustomerChange && (hasCodCollection || existingOrder.codSettled)) {
    throw new ApiError(409, ORDER_MESSAGES.CUSTOMER_LOCKED_AFTER_COD);
  }

  if (existingOrder.codSettled && hasSettlementSensitiveUpdate) {
    throw new ApiError(409, ORDER_MESSAGES.CANNOT_MODIFY_SETTLED_FINANCIALS);
  }

  if (updateData.customerId) {
    await customerService.getById(updateData.customerId);
  }

  if (updateData.goodCategory) {
    await goodsCategoryService.getById(updateData.goodCategory);
  }

  const effectiveTripId =
    updateData.tripId !== undefined
      ? updateData.tripId
      : existingOrder.tripId?._id || existingOrder.tripId;
  const effectiveRouteId =
    updateData.routeId !== undefined
      ? updateData.routeId
      : existingOrder.routeId?._id || existingOrder.routeId;
  let effectiveWarehouseId =
    updateData.warehouseId !== undefined
      ? updateData.warehouseId
      : existingOrder.warehouseId?._id || existingOrder.warehouseId;

  if (effectiveRouteId) {
    await routeService.getById(effectiveRouteId);
  }

  if (effectiveTripId) {
    const trip = await tripService.getById(effectiveTripId, true, user);
    const tripRouteId = trip.routeId?._id || trip.routeId;
    const tripWarehouseId =
      trip.warehouseId ||
      trip.driverId?.warehouseId?._id ||
      trip.driverId?.warehouseId;
    if (effectiveRouteId?.toString() !== tripRouteId?.toString()) {
      throw new ApiError(400, ORDER_MESSAGES.ROUTE_TRIP_MISMATCH);
    }
    if (
      effectiveWarehouseId &&
      tripWarehouseId?.toString() !== effectiveWarehouseId.toString()
    ) {
      throw new ApiError(400, WAREHOUSE_MESSAGES.ACCESS_DENIED);
    }
    effectiveWarehouseId = effectiveWarehouseId || tripWarehouseId;
  }

  const payload = { ...updateData };
  if (effectiveWarehouseId) {
    payload.warehouseId = effectiveWarehouseId;
  }

  const effectiveShippingFee =
    payload.shippingFee !== undefined
      ? payload.shippingFee
      : existingOrder.shippingFee;

  const effectiveCodAmount =
    payload.codAmount !== undefined
      ? payload.codAmount
      : existingOrder.codAmount;

  payload.totalAmount =
    Number(effectiveShippingFee || 0) + Number(effectiveCodAmount || 0);

  if (payload.codCollected === true && !payload.paymentStatus) {
    payload.paymentStatus = "success";
    if (!payload.paymentTime) {
      payload.paymentTime = new Date();
    }
  } else if (
    payload.codCollected === false &&
    !payload.paymentStatus &&
    existingOrder.codCollected === true
  ) {
    payload.paymentStatus = "pending";
    payload.paymentTime = null;
  }

  const updatedOrder = await orderRepository.updateById(
    orderId,
    payload,
    session,
    {
      ...conditions,
      ...(hasSettlementSensitiveUpdate ? { codSettled: { $ne: true } } : {}),
      ...(hasCodAmountChange || hasCustomerChange
        ? {
            codCollectedAmount: { $in: [null, 0] },
            codRemittedAmount: { $in: [null, 0] },
          }
        : {}),
    },
  );

  if (!updatedOrder && hasCodAmountChange) {
    throw new ApiError(409, ORDER_MESSAGES.COD_AMOUNT_LOCKED_AFTER_COLLECTION);
  }
  if (!updatedOrder && hasCustomerChange) {
    throw new ApiError(409, ORDER_MESSAGES.CUSTOMER_LOCKED_AFTER_COD);
  }

  if (!updatedOrder && hasSettlementSensitiveUpdate) {
    throw new ApiError(409, ORDER_MESSAGES.CANNOT_MODIFY_SETTLED_FINANCIALS);
  }

  return updatedOrder;
};

const recordFailureAttempt = ({ orderId, notes, session = null }) => {
  return orderRepository.recordFailureAttempt(orderId, notes, session);
};

const markAsDelivered = async ({
  orderId,
  tripId,
  latitude,
  longitude,
  address,
  notes = "Delivered successfully",
  podImageUrl = null,
  recipientReceivedName = null,
  deliveredBy,
  user = null,
}) => {
  const order = await getById(orderId, true, user);

  if (
    order.status !== "delivery_scheduled" &&
    order.status !== "transporting" &&
    order.status !== "out_for_delivery" &&
    order.status !== "picked_up"
  ) {
    throw new ApiError(400, ORDER_MESSAGES.CANNOT_MARK_DELIVERED(order.status));
  }

  if (deliveredBy) {
    await userService.getById(deliveredBy);
  }

  const effectiveTripId = tripId || order.tripId?._id || order.tripId;
  const assignedTripId = order.tripId?._id || order.tripId;
  if (
    tripId &&
    (!assignedTripId || tripId.toString() !== assignedTripId.toString())
  ) {
    throw new ApiError(400, ORDER_MESSAGES.ORDER_ALREADY_ASSIGNED);
  }
  if (user?.role === ROLES.DRIVER && !assignedTripId) {
    throw new ApiError(403, ORDER_MESSAGES.NOT_DRIVER_OF_TRIP);
  }

  let trip = null;
  if (effectiveTripId) {
    trip = await tripService.getById(effectiveTripId, false, user);
  }
  if (trip) assertDriverAssignedToTrip(trip, user);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const now = new Date();
    const updatedOrder = await orderRepository.updateById(
      orderId,
      {
        status: "delivered",
        deliveredAt: now,
        podImageUrl: podImageUrl || order.podImageUrl,
        recipientReceivedName:
          recipientReceivedName || order.recipientReceivedName,
        notes: notes || order.notes,
      },
      session,
      {
        status: {
          $in: [
            "delivery_scheduled",
            "transporting",
            "out_for_delivery",
            "picked_up",
          ],
        },
        deletedAt: null,
        ...(assignedTripId ? { tripId: assignedTripId } : {}),
      },
    );
    if (!updatedOrder) {
      throw new ApiError(409, ORDER_MESSAGES.ORDER_ASSIGNMENT_CHANGED);
    }

    const trackingLog = await orderRepository.createTrackingLog(
      {
        orderId,
        tripId: effectiveTripId,
        status: "delivered",
        latitude,
        longitude,
        address,
        notes,
        changedBy: deliveredBy,
      },
      session,
    );

    await session.commitTransaction();

    const customerUserId =
      order.customerId?.userId?._id || order.customerId?.userId;

    if (customerUserId) {
      try {
        await notificationService.create({
          userId: customerUserId,
          title: "Giao hàng thành công",
          message: `Đơn hàng #${order.orderCode} đã được giao thành công. Người nhận: ${recipientReceivedName || order.recipientName}`,
          type: "ORDER_UPDATE",
          data: {
            orderId: order._id,
            orderCode: order.orderCode,
          },
        });
      } catch (error) {
        logger.error("Failed to create delivery notification", {
          orderId: order._id,
          error: error.message,
        });
      }
    }

    return {
      order: updatedOrder,
      trackingLog,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const getRefundableShippingFee = (order) => {
  if (order.paymentMethod !== PAYMENT_METHODS.WALLET_BALANCE) {
    return 0;
  }

  const paidAmount = Number(
    order.shippingFeePaidAmount ??
      (order.shippingFeePaid ? order.shippingFee : 0),
  );
  return Math.max(0, Math.min(paidAmount, Number(order.shippingFee || 0)));
};

const refundShippingFeeToWallet = async (order, amount, session, reason) => {
  if (amount <= 0) {
    return;
  }

  const customerId = order.customerId?._id || order.customerId;
  const customer = await customerService.getById(customerId, session);
  const balanceBefore = Number(customer.walletBalance || 0);
  const balanceAfter = balanceBefore + amount;
  const loyaltyPointsToReverse = Math.floor(amount / 10000);

  const updatedCustomer = await customerService.updateById(
    customerId,
    {
      $inc: {
        walletBalance: amount,
        totalSpent: -amount,
        loyaltyPoints: -loyaltyPointsToReverse,
      },
    },
    session,
    {
      totalSpent: { $gte: amount },
      loyaltyPoints: { $gte: loyaltyPointsToReverse },
    },
  );
  if (!updatedCustomer) {
    throw new ApiError(409, ORDER_MESSAGES.CUSTOMER_FINANCIAL_STATE_CHANGED);
  }

  await walletTransactionService.recordTransaction(
    {
      customerId,
      type: WALLET_TRANSACTION_TYPES.REFUND,
      direction: WALLET_TRANSACTION_DIRECTIONS.CREDIT,
      amount,
      balanceBefore,
      balanceAfter,
      orderId: order._id,
      status: WALLET_TRANSACTION_STATUSES.SUCCESS,
      notes: `Hoàn phí vận chuyển đơn hàng ${order.orderCode}: ${reason}`,
    },
    session,
  );
};

const cancelOrder = async ({ orderId, reason, cancelledBy, user = null }) => {
  const order = await getById(orderId, true, user);

  const cancellableStatuses = [
    "created",
    "driver_assigned",
    "pickup_scheduled",
  ];
  if (!cancellableStatuses.includes(order.status)) {
    throw new ApiError(400, ORDER_MESSAGES.CANNOT_CANCEL_STATUS(order.status));
  }

  if (cancelledBy) {
    await userService.getById(cancelledBy);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const shippingFeeRefund = getRefundableShippingFee(order);
    let updatedOrder = await orderRepository.updateById(
      orderId,
      {
        status: "cancelled",
        notes: reason || order.notes,
      },
      session,
      { status: { $in: cancellableStatuses }, deletedAt: null },
    );
    if (!updatedOrder) {
      throw new ApiError(409, ORDER_MESSAGES.ORDER_ASSIGNMENT_CHANGED);
    }

    await refundShippingFeeToWallet(
      order,
      shippingFeeRefund,
      session,
      "hủy đơn",
    );
    if (shippingFeeRefund > 0) {
      updatedOrder = await orderRepository.updateById(
        orderId,
        { shippingFeePaid: false, shippingFeePaidAmount: 0 },
        session,
      );
    }

    const trackingLog = await orderRepository.createTrackingLog(
      {
        orderId,
        tripId: order.tripId?._id || order.tripId,
        status: "cancelled",
        notes: reason || "Order cancelled",
        changedBy: cancelledBy,
      },
      session,
    );

    await session.commitTransaction();

    return {
      order: updatedOrder,
      trackingLog,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const getByTripId = async ({
  tripId,
  page = 1,
  limit = 20,
  sort = { createdAt: -1 },
  user = null,
} = {}) => {
  const trip = await tripService.getById(tripId, false, user);
  assertDriverAssignedToTrip(trip, user);

  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const limitNumber = Math.max(1, parseInt(limit, 10) || 20);
  const skip = (pageNumber - 1) * limitNumber;

  const [orders, total] = await Promise.all([
    orderRepository.findByTripId(tripId, {
      skip,
      limit: limitNumber,
      sort,
    }),
    orderRepository.countByTripId(tripId),
  ]);

  return {
    data: orders,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages: Math.ceil(total / limitNumber),
    },
  };
};

const assignOrdersToTrip = async ({ tripId, orderIds = [] }, user = null) => {
  const trip = await tripService.getById(tripId, true, user);
  if (trip.status !== "planned") {
    throw new ApiError(400, ORDER_MESSAGES.TRIP_NOT_PLANNED);
  }

  const tripWarehouseId =
    trip.warehouseId ||
    trip.driverId?.warehouseId?._id ||
    trip.driverId?.warehouseId;

  if (!orderIds.length) {
    throw new ApiError(400, ORDER_MESSAGES.ORDER_IDS_REQUIRED_ASSIGN);
  }

  const orders = await orderRepository.findByIds(orderIds);
  if (orders.length !== orderIds.length) {
    throw new ApiError(404, ORDER_MESSAGES.ORDERS_NOT_FOUND);
  }

  const pickupStatuses = ["created", "driver_assigned", "pickup_scheduled"];
  const isOrderAssignable = (order, targetTrip) =>
    targetTrip.type === TRIP_TYPES.PICKUP
      ? pickupStatuses.includes(order.status)
      : order.status === "stored";
  const invalidOrder = orders.find((order) => !isOrderAssignable(order, trip));
  if (invalidOrder) {
    throw new ApiError(400, ORDER_MESSAGES.ORDER_TRIP_TYPE_MISMATCH);
  }

  for (const order of orders) {
    await assertOrderWarehouseAccess(order, user);

    const assignedTripId = order.tripId?._id || order.tripId;
    if (assignedTripId && assignedTripId.toString() !== tripId.toString()) {
      throw new ApiError(409, ORDER_MESSAGES.ORDER_ALREADY_ASSIGNED);
    }

    const orderRouteId = order.routeId?._id || order.routeId;
    const tripRouteId = trip.routeId?._id || trip.routeId;
    if (
      trip.type !== TRIP_TYPES.PICKUP &&
      (!orderRouteId || orderRouteId.toString() !== tripRouteId?.toString())
    ) {
      throw new ApiError(400, ORDER_MESSAGES.ROUTE_TRIP_MISMATCH);
    }

    const orderWarehouseId = order.warehouseId?._id || order.warehouseId;
    if (
      orderWarehouseId &&
      orderWarehouseId.toString() !== tripWarehouseId?.toString()
    ) {
      throw new ApiError(400, WAREHOUSE_MESSAGES.ACCESS_DENIED);
    }
  }

  if (user?.role === ROLES.DISPATCHER) {
    for (const order of orders) {
      if (!order.warehouseId && !order.tripId) {
        throw new ApiError(403, WAREHOUSE_MESSAGES.INVALID_WAREHOUSE_REF);
      }
    }
  }

  const storedOrderIds = orders
    .filter((o) => o.status === "stored")
    .map((o) => o._id);

  const pickupOrderIds = orders
    .filter((o) => o.status !== "stored")
    .map((o) => o._id);

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const currentTrip = await tripService.getById(tripId, true, user, session);
    if (currentTrip.status !== "planned") {
      throw new ApiError(400, ORDER_MESSAGES.TRIP_NOT_PLANNED);
    }
    const currentTripWarehouseId =
      currentTrip.warehouseId ||
      currentTrip.driverId?.warehouseId?._id ||
      currentTrip.driverId?.warehouseId;
    const currentTripRouteId = currentTrip.routeId?._id || currentTrip.routeId;
    const currentOrders = await orderRepository.findByIds(orderIds, session);
    if (currentOrders.length !== orderIds.length) {
      throw new ApiError(404, ORDER_MESSAGES.ORDERS_NOT_FOUND);
    }
    for (const order of currentOrders) {
      await assertOrderWarehouseAccess(order, user);
      if (!isOrderAssignable(order, currentTrip)) {
        throw new ApiError(400, ORDER_MESSAGES.ORDER_TRIP_TYPE_MISMATCH);
      }

      const currentAssignedTripId = order.tripId?._id || order.tripId;
      if (
        currentAssignedTripId &&
        currentAssignedTripId.toString() !== tripId.toString()
      ) {
        throw new ApiError(409, ORDER_MESSAGES.ORDER_ALREADY_ASSIGNED);
      }

      const currentOrderRouteId = order.routeId?._id || order.routeId;
      if (
        currentTrip.type !== TRIP_TYPES.PICKUP &&
        (!currentOrderRouteId ||
          currentOrderRouteId.toString() !== currentTripRouteId?.toString())
      ) {
        throw new ApiError(400, ORDER_MESSAGES.ROUTE_TRIP_MISMATCH);
      }

      const currentOrderWarehouseId =
        order.warehouseId?._id || order.warehouseId;
      if (
        currentOrderWarehouseId &&
        currentOrderWarehouseId.toString() !==
          currentTripWarehouseId?.toString()
      ) {
        throw new ApiError(400, WAREHOUSE_MESSAGES.ACCESS_DENIED);
      }
    }

    if (storedOrderIds.length > 0) {
      const result = await orderRepository.updateMany(
        {
          _id: { $in: storedOrderIds },
          status: "stored",
          $or: [{ tripId: null }, { tripId }],
        },
        { tripId, warehouseId: currentTripWarehouseId },
        session,
      );
      if (result.modifiedCount !== storedOrderIds.length) {
        throw new ApiError(409, ORDER_MESSAGES.ORDER_ASSIGNMENT_CHANGED);
      }
    }

    if (pickupOrderIds.length > 0) {
      const result = await orderRepository.updateMany(
        {
          _id: { $in: pickupOrderIds },
          status: { $in: ["created", "driver_assigned", "pickup_scheduled"] },
          $or: [{ tripId: null }, { tripId }],
        },
        {
          tripId,
          status: "driver_assigned",
          warehouseId: currentTripWarehouseId,
        },
        session,
      );
      if (result.modifiedCount !== pickupOrderIds.length) {
        throw new ApiError(409, ORDER_MESSAGES.ORDER_ASSIGNMENT_CHANGED);
      }
    }

    for (const order of currentOrders) {
      await orderRepository.createTrackingLog(
        {
          orderId: order._id,
          tripId,
          status: order.status === "stored" ? "stored" : "driver_assigned",
          notes: `Đơn hàng được gán vào chuyến ${currentTrip.tripCode || tripId}`,
          changedBy: user?.userId || user?._id,
        },
        session,
      );
    }

    await tripService.syncTotalOrder(tripId, session);

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  return { assignedCount: orderIds.length, tripId };
};

const unassignOrdersFromTrip = async ({ orderIds = [] }, user = null) => {
  if (!orderIds.length) {
    throw new ApiError(400, ORDER_MESSAGES.ORDER_IDS_REQUIRED_UNASSIGN);
  }

  const orders = await orderRepository.findByIds(orderIds);
  if (orders.length !== orderIds.length) {
    throw new ApiError(404, ORDER_MESSAGES.ORDERS_NOT_FOUND);
  }

  for (const order of orders) {
    await assertOrderWarehouseAccess(order, user);
    if (!order.tripId) {
      throw new ApiError(400, ORDER_MESSAGES.ORDER_ALREADY_ASSIGNED);
    }

    const trip = await tripService.getById(order.tripId, false, user);
    const canReleaseFailedPickup =
      trip.type === TRIP_TYPES.PICKUP &&
      ["completed", "cancelled"].includes(trip.status) &&
      ["driver_assigned", "pickup_scheduled"].includes(order.status);
    if (trip.status !== "planned" && !canReleaseFailedPickup) {
      throw new ApiError(400, ORDER_MESSAGES.TRIP_NOT_PLANNED);
    }

    const orderRouteId = order.routeId?._id || order.routeId;
    const tripRouteId = trip.routeId?._id || trip.routeId;
    if (orderRouteId?.toString() !== tripRouteId?.toString()) {
      throw new ApiError(400, ORDER_MESSAGES.ROUTE_TRIP_MISMATCH);
    }

    if (
      !["stored", "driver_assigned", "pickup_scheduled"].includes(order.status)
    ) {
      throw new ApiError(
        400,
        ORDER_MESSAGES.CANNOT_ASSIGN_ORDER_STATUS(
          order.orderCode,
          order.status,
        ),
      );
    }
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const affectedTripIds = new Map();
    for (const order of orders) {
      const sourceTripId = order.tripId?._id || order.tripId;
      const sourceTrip = await tripService.getById(
        sourceTripId,
        false,
        user,
        session,
      );

      const canReleaseFailedPickup =
        sourceTrip.type === TRIP_TYPES.PICKUP &&
        ["completed", "cancelled"].includes(sourceTrip.status) &&
        ["driver_assigned", "pickup_scheduled"].includes(order.status);
      if (sourceTrip.status !== "planned" && !canReleaseFailedPickup) {
        throw new ApiError(400, ORDER_MESSAGES.TRIP_NOT_PLANNED);
      }

      const tripRouteId = sourceTrip.routeId?._id || sourceTrip.routeId;
      const orderRouteId = order.routeId?._id || order.routeId;
      if (orderRouteId?.toString() !== tripRouteId?.toString()) {
        throw new ApiError(400, ORDER_MESSAGES.ROUTE_TRIP_MISMATCH);
      }

      const tripWarehouseId =
        sourceTrip.warehouseId ||
        sourceTrip.driverId?.warehouseId?._id ||
        sourceTrip.driverId?.warehouseId;
      const updateData =
        order.status === "stored"
          ? { tripId: null }
          : { tripId: null, status: "created" };
      if (!order.warehouseId) {
        updateData.warehouseId = tripWarehouseId;
      }

      const updatedOrder = await orderRepository.updateById(
        order._id,
        updateData,
        session,
        { tripId: sourceTripId, status: order.status, deletedAt: null },
      );
      if (!updatedOrder) {
        throw new ApiError(409, ORDER_MESSAGES.ORDER_ASSIGNMENT_CHANGED);
      }

      affectedTripIds.set(sourceTripId.toString(), sourceTripId);
    }

    for (const tripId of affectedTripIds.values()) {
      await tripService.syncTotalOrder(tripId, session);
    }

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  return { unassignedCount: orders.length };
};

const deleteById = async ({ orderId, session = null, user = null }) => {
  const order = await getById(orderId, true, user, session);

  if (order.status !== "created") {
    throw new ApiError(400, ORDER_MESSAGES.CANNOT_DELETE_STATUS(order.status));
  }

  const shippingFeeRefund = getRefundableShippingFee(order);
  const isInternalSession = !session;
  const dbSession = session || (await mongoose.startSession());
  if (isInternalSession) {
    dbSession.startTransaction();
  }

  try {
    const deletedOrder = await orderRepository.updateById(
      orderId,
      {
        deletedAt: new Date(),
        ...(shippingFeeRefund > 0
          ? { shippingFeePaid: false, shippingFeePaidAmount: 0 }
          : {}),
      },
      dbSession,
      { status: "created", deletedAt: null },
    );
    if (!deletedOrder) {
      throw new ApiError(409, ORDER_MESSAGES.CANCEL_STATUS_CHANGED);
    }

    const assignedTripId = order.tripId?._id || order.tripId;
    if (assignedTripId) {
      await tripService.syncTotalOrder(assignedTripId, dbSession);
    }

    await refundShippingFeeToWallet(
      order,
      shippingFeeRefund,
      dbSession,
      "xóa order",
    );

    if (isInternalSession) {
      await dbSession.commitTransaction();
    }

    return deletedOrder;
  } catch (error) {
    if (isInternalSession) {
      await dbSession.abortTransaction();
    }
    throw error;
  } finally {
    if (isInternalSession) {
      dbSession.endSession();
    }
  }
};

const countAll = async ({ filter = {}, user = null } = {}) => {
  const queryFilter = await scopeOrderFilter(
    { deletedAt: null, ...filter },
    user,
  );
  return orderRepository.countAll({ filter: queryFilter });
};

const getStatsByStatus = async ({ filter = {}, user } = {}) => {
  const queryFilter = await scopeOrderFilter(
    { deletedAt: null, ...filter },
    user,
  );
  return orderRepository.countByStatus(queryFilter);
};

const getRecentTrends = async ({ days = 7, warehouseId = null } = {}) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (days - 1));
  startDate.setHours(0, 0, 0, 0);
  return orderRepository.getRecentOrderTrends(startDate, warehouseId);
};

// ==========================================
// ORDER TRACKING LOG SERVICES
// ==========================================

const addTrackingLog = async ({
  orderId,
  tripId,
  status,
  latitude,
  longitude,
  address,
  notes,
  changedBy,
  warehouseId,
  expectedStatus,
  expectedWarehouseId,
  session = null,
  user = null,
  allowPickupConfirmation = false,
  clearTrip = false,
}) => {
  const order = await getById(orderId, true, user, session);
  const assignedTripId = order.tripId?._id || order.tripId;
  const currentWarehouseId = (
    order.warehouseId?._id || order.warehouseId
  )?.toString();
  const expectedWarehouseIdString = (
    expectedWarehouseId?._id || expectedWarehouseId
  )?.toString();

  if (
    (expectedStatus !== undefined && order.status !== expectedStatus) ||
    (expectedWarehouseId !== undefined &&
      currentWarehouseId !== expectedWarehouseIdString)
  ) {
    throw new ApiError(409, ORDER_MESSAGES.ORDER_ASSIGNMENT_CHANGED);
  }

  if (user && status === "stored") {
    throw new ApiError(400, ORDER_MESSAGES.STORAGE_REQUIRES_RECEIPT);
  }

  if (user && status === "picked_up" && !allowPickupConfirmation) {
    throw new ApiError(400, ORDER_MESSAGES.PICKUP_CONFIRMATION_REQUIRED);
  }

  if (
    tripId &&
    (!assignedTripId || tripId.toString() !== assignedTripId.toString())
  ) {
    throw new ApiError(400, ORDER_MESSAGES.ORDER_ALREADY_ASSIGNED);
  }

  if (
    user &&
    status !== order.status &&
    !TRACKING_STATUS_TRANSITIONS[order.status]?.includes(status)
  ) {
    throw new ApiError(
      400,
      ORDER_MESSAGES.INVALID_TRACKING_STATUS_TRANSITION(order.status, status),
    );
  }

  if (changedBy) {
    await userService.getById(changedBy);
  }

  if (tripId) {
    await tripService.getById(tripId, false, user);
  }

  const isInternalSession = !session;
  const dbSession = session || (await mongoose.startSession());
  if (isInternalSession) {
    dbSession.startTransaction();
  }

  try {
    const trackingLog = await orderRepository.createTrackingLog(
      {
        orderId,
        tripId: tripId || order.tripId?._id || order.tripId,
        status,
        latitude,
        longitude,
        address,
        notes,
        changedBy,
      },
      dbSession,
    );

    const updatePayload = { status };
    if (warehouseId !== undefined) {
      updatePayload.warehouseId = warehouseId;
    }
    if (clearTrip) {
      updatePayload.tripId = null;
    }

    const updatedOrder = await orderRepository.updateById(
      orderId,
      updatePayload,
      dbSession,
      {
        status: order.status,
        deletedAt: null,
        ...(expectedWarehouseId !== undefined
          ? { warehouseId: expectedWarehouseId }
          : {}),
        ...(assignedTripId ? { tripId: assignedTripId } : {}),
      },
    );
    if (!updatedOrder) {
      throw new ApiError(409, ORDER_MESSAGES.ORDER_ASSIGNMENT_CHANGED);
    }

    if (isInternalSession) {
      await dbSession.commitTransaction();
    }

    return trackingLog;
  } catch (error) {
    if (isInternalSession) {
      await dbSession.abortTransaction();
    }
    throw error;
  } finally {
    if (isInternalSession) {
      dbSession.endSession();
    }
  }
};

const confirmPickup = async ({
  orderId,
  outcome,
  notes = "",
  changedBy,
  user,
  session = null,
}) => {
  const order = await getById(orderId, true, user);
  const trip = order.tripId;

  if (!trip || trip.type !== TRIP_TYPES.PICKUP) {
    throw new ApiError(400, ORDER_MESSAGES.PICKUP_TRIP_REQUIRED);
  }

  if (trip.status !== "in_progress") {
    throw new ApiError(400, ORDER_MESSAGES.PICKUP_TRIP_NOT_IN_PROGRESS);
  }

  if (!["driver_assigned", "pickup_scheduled"].includes(order.status)) {
    throw new ApiError(
      400,
      ORDER_MESSAGES.PICKUP_ORDER_STATUS_INVALID(order.status),
    );
  }

  const status = outcome === "picked_up" ? "picked_up" : order.status;
  const trackingNotes =
    outcome === "failed" ? `Lấy hàng thất bại: ${notes}` : notes;

  return addTrackingLog({
    orderId,
    tripId: trip._id,
    status,
    notes: trackingNotes,
    changedBy,
    user,
    expectedStatus: order.status,
    session,
    allowPickupConfirmation: outcome === "picked_up",
  });
};

const getTrackingLogsByOrderId = async ({
  orderId,
  page = 1,
  limit = 20,
  sort = { createdAt: -1 },
  user = null,
} = {}) => {
  await getById(orderId, false, user);

  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const limitNumber = Math.max(1, parseInt(limit, 10) || 20);
  const skip = (pageNumber - 1) * limitNumber;

  const [logs, total] = await Promise.all([
    orderRepository.findTrackingLogsByOrderId(orderId, {
      skip,
      limit: limitNumber,
      sort,
    }),
    orderRepository.countTrackingLogsByOrderId(orderId),
  ]);

  return {
    data: logs,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages: Math.ceil(total / limitNumber),
    },
  };
};

const getLatestTrackingLog = async ({ orderId, user = null }) => {
  await getById(orderId, false, user);

  const log = await orderRepository.getLatestTrackingLogByOrderId(orderId);
  if (!log) {
    throw new ApiError(404, ORDER_MESSAGES.TRACKING_NOT_FOUND);
  }

  return log;
};

const claimForCodSettlement = (orderIds, conditions, session = null) => {
  return orderRepository.claimForCodSettlement(orderIds, conditions, session);
};

const releaseCodSettlement = (orderIds, session = null) => {
  return orderRepository.releaseCodSettlement(orderIds, session);
};

export default {
  create,
  getAll,
  getIdsByWarehouseId,
  countByTripId,
  countRouteMismatchesByTripId,
  getMyOrders,
  getById,
  getByCode,
  getPublicTrackingByCode,
  getByTripId,
  updateById,
  recordFailureAttempt,
  deleteById,
  countAll,
  getStatsByStatus,
  getRecentTrends,
  claimForCodSettlement,
  releaseCodSettlement,

  // Dedicated Business methods
  markAsDelivered,
  cancelOrder,
  assignOrdersToTrip,
  unassignOrdersFromTrip,
  confirmPickup,

  // Tracking Log methods
  addTrackingLog,
  getTrackingLogsByOrderId,
  getLatestTrackingLog,
};
