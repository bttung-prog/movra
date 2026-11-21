import mongoose from "mongoose";

import { PAYMENT_METHODS } from "../../constants/paymentMethods.js";
import {
  WALLET_TRANSACTION_TYPES,
  WALLET_TRANSACTION_DIRECTIONS,
} from "../../constants/walletTransactionTypes.js";
import { WALLET_TRANSACTION_STATUSES } from "../../constants/walletTransactionStatuses.js";
import { ROLES } from "../../constants/roles.js";
import { TRIP_TYPES } from "../../constants/tripTypes.js";
import { TRIP_STATUSES } from "../../constants/tripStatuses.js";
import {
  CANCELLABLE_ORDER_STATUSES,
  ORDER_STATUSES,
  PICKUP_ASSIGNABLE_ORDER_STATUSES,
  SETTLEMENT_SENSITIVE_ORDER_FIELDS,
  TRACKING_STATUS_TRANSITIONS,
} from "../../constants/orderStatuses.js";
import {
  ORDER_MESSAGES,
  WAREHOUSE_MESSAGES,
} from "../../constants/messages.js";
import { SERVICE_TYPES } from "../../constants/serviceTypes.js";
import { SHIPPING_MODES } from "../../constants/shippingModes.js";
import { PAYMENT_STATUSES } from "../../constants/paymentStatuses.js";
import { PAYMENT_TERMS } from "../../constants/paymentTerms.js";
import { CM3_PER_M3 } from "../../constants/pricingUnits.js";

import { ApiError } from "../../utils/ApiError.js";
import { generateCode } from "../../utils/generateCode.js";
import { calculateVolumeCm3 } from "../../utils/volume.util.js";
import logger from "../../configs/logger.js";

import customerService from "../customer/customer.service.js";
import customerCreditService from "../customer/customerCredit.service.js";
import goodsCategoryService from "../goodsCategory/goodsCategory.service.js";
import routeService from "../route/route.service.js";
import tripService from "../trip/trip.service.js";
import userService from "../user/user.service.js";
import pricingService from "../pricing/pricing.service.js";
import routingHelper from "../route/routing.helper.js";
import notificationService from "../notification/notification.service.js";
import walletTransactionService from "../walletTransaction/walletTransaction.service.js";
import warehouseService from "../warehouse/warehouse.service.js";

import orderRepository from "./order.repository.js";
import orderTrackingLogRepository from "./orderTrackingLog.repository.js";
import orderAccess from "./order.access.js";

const getIdsByWarehouseId = async (warehouseId) => {
  return orderRepository.findIdsByWarehouseId(warehouseId);
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
    deliveryLocation,
    goodCategory,
    weight,
    length,
    width,
    height,
    quantity,
    codAmount = 0,
    routeId,
    type = SERVICE_TYPES.STANDARD,
    shippingMode = SHIPPING_MODES.CONSOLIDATED,
    notes,
    createdBy,
    warehouseId = null,
  },
  session = null,
  user = null,
) => {
  if (createdBy) {
    await userService.getById(createdBy);
  }

  await goodsCategoryService.getById(goodCategory);

  if (!customerId) {
    throw new ApiError(400, ORDER_MESSAGES.CUSTOMER_REQUIRED);
  }
  const customer = await customerService.getById(customerId);
  const paymentTerms = customer.defaultPaymentTerms || PAYMENT_TERMS.IMMEDIATE;
  const contractDiscountRate = Number(customer.contractDiscountRate || 0);

  const routing = await routingHelper.resolveOrderRouting({
    shippingMode,
    pickupLocation,
    deliveryLocation,
    warehouseId,
    routeId,
    user,
    requireWarehouse: true,
  });

  warehouseId = routing.warehouseId;
  routeId = routing.routeId;
  const {
    destinationWarehouseId,
    pickupDistanceKm,
    deliveryDistanceKm,
    totalDistanceKm,
  } = routing;

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

  const volume = calculateVolumeCm3(length, width, height);

  const feeResult = await pricingService.calculateFee({
    serviceType: type,
    shippingMode: routing.shippingMode,
    weight,
    length,
    width,
    height,
    quantity,
    ...(totalDistanceKm !== undefined ? { distance: totalDistanceKm } : {}),
    routeId,
    goodsCategoryId: goodCategory,
    contractDiscountRate,
  });
  const effectiveShippingFee = Number(feeResult.totalShippingFee);
  if (!Number.isFinite(effectiveShippingFee) || effectiveShippingFee < 0) {
    throw new ApiError(500, ORDER_MESSAGES.INVALID_SHIPPING_FEE);
  }

  const shippingFeeBeforeDiscount = Number(
    feeResult.shippingFeeBeforeDiscount ?? effectiveShippingFee,
  );
  const discountAmount = Number(feeResult.discountAmount ?? 0);
  const discountRateApplied = Number(
    feeResult.discountRate ?? contractDiscountRate,
  );

  if (paymentTerms !== PAYMENT_TERMS.IMMEDIATE) {
    await customerCreditService.assertCreditAvailable({
      customer,
      paymentTerms,
      additionalAmount: effectiveShippingFee,
    });
  }

  const calculatedTotal = effectiveShippingFee + Number(codAmount || 0);

  const isInternalSession = !session;
  const dbSession = session || (await mongoose.startSession());
  if (isInternalSession) {
    dbSession.startTransaction();
  }

  try {
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
        deliveryLocation,
        deliveryDistanceKm,
        totalDistanceKm,
        goodCategory,
        weight,
        length,
        width,
        height,
        volume,
        quantity,
        codAmount,
        shippingFee: effectiveShippingFee,
        shippingFeeBeforeDiscount,
        discountRateApplied,
        discountAmount,
        shippingFeePaid: false,
        shippingFeePaidAmount: 0,
        totalAmount: calculatedTotal,
        routeId,
        warehouseId,
        destinationWarehouseId,
        type,
        shippingMode: routing.shippingMode,
        paymentTerms,
        paymentMethod: null,
        paymentStatus: PAYMENT_STATUSES.PENDING,
        paymentTime: null,
        notes,
        status: ORDER_STATUSES.CREATED,
        deliveryAttempts: 0,
      },
      dbSession,
    );

    await orderTrackingLogRepository.create(
      {
        orderId: newOrder._id,
        status: ORDER_STATUSES.CREATED,
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

  const queryFilter = await orderAccess.scopeOrderFilter(
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

  const validatedOrder = orderAccess.validateOrder(order, requireNotDeleted);
  orderAccess.checkOrderOwnership(validatedOrder, user);
  await orderAccess.assertOrderWarehouseAccess(validatedOrder, user);

  return validatedOrder;
};

const getByCode = async (orderCode, user = null) => {
  const order = await orderRepository.findByCode(orderCode);

  const validatedOrder = orderAccess.validateOrder(order, true);
  orderAccess.checkOrderOwnership(validatedOrder, user);
  await orderAccess.assertOrderWarehouseAccess(validatedOrder, user);

  return validatedOrder;
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

  const restrictedStatuses = [
    ORDER_STATUSES.DELIVERED,
    ORDER_STATUSES.RETURNED,
    ORDER_STATUSES.CANCELLED,
  ];
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
    if (
      trip.type === TRIP_TYPES.TRANSFER &&
      effectiveRouteId?.toString() !== tripRouteId?.toString()
    ) {
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
    payload.paymentStatus = PAYMENT_STATUSES.COMPLETED;
    if (!payload.paymentTime) {
      payload.paymentTime = new Date();
    }
  } else if (
    payload.codCollected === false &&
    !payload.paymentStatus &&
    existingOrder.codCollected === true
  ) {
    payload.paymentStatus = PAYMENT_STATUSES.PENDING;
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
  codCollectedAmount = undefined,
  deliveredBy,
  user = null,
}) => {
  const order = await getById(orderId, true, user);

  const deliverableStatuses = [
    ORDER_STATUSES.DELIVERY_SCHEDULED,
    ORDER_STATUSES.TRANSPORTING,
    ORDER_STATUSES.OUT_FOR_DELIVERY,
    ORDER_STATUSES.PICKED_UP,
  ];

  if (!deliverableStatuses.includes(order.status)) {
    throw new ApiError(400, ORDER_MESSAGES.CANNOT_MARK_DELIVERED(order.status));
  }

  if (deliveredBy) {
    await userService.getById(deliveredBy);
  }

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

  if (assignedTripId) {
    const trip = await tripService.getById(assignedTripId, false, user);
    if (trip) {
      orderAccess.assertDriverAssignedToTrip(trip, user);
    }
  }

  const codAmount = Number(order.codAmount || 0);
  const alreadyCollected =
    order.codCollected && Number(order.codCollectedAmount || 0) >= codAmount;
  if (codAmount > 0 && !alreadyCollected) {
    if (codCollectedAmount === undefined || codCollectedAmount === null) {
      throw new ApiError(400, ORDER_MESSAGES.COD_COLLECTION_REQUIRED);
    }
    const numericCodCollected = Number(codCollectedAmount);
    if (
      !Number.isFinite(numericCodCollected) ||
      numericCodCollected !== codAmount
    ) {
      throw new ApiError(400, ORDER_MESSAGES.INVALID_COD_COLLECTED_AMOUNT);
    }
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const now = new Date();

    const updatedOrder = await orderRepository.updateById(
      orderId,
      {
        status: ORDER_STATUSES.DELIVERED,
        deliveredAt: now,
        podImageUrl: podImageUrl || order.podImageUrl,
        recipientReceivedName:
          recipientReceivedName || order.recipientReceivedName,
        notes: notes || order.notes,
        ...(codAmount > 0 && !alreadyCollected
          ? {
              codCollectedAmount: Number(codCollectedAmount),
              codCollected: true,
            }
          : {}),
      },
      session,
      {
        status: {
          $in: [
            ORDER_STATUSES.DELIVERY_SCHEDULED,
            ORDER_STATUSES.TRANSPORTING,
            ORDER_STATUSES.OUT_FOR_DELIVERY,
            ORDER_STATUSES.PICKED_UP,
          ],
        },
        deletedAt: null,
        ...(assignedTripId ? { tripId: assignedTripId } : {}),
      },
    );
    if (!updatedOrder) {
      throw new ApiError(409, ORDER_MESSAGES.ORDER_ASSIGNMENT_CHANGED);
    }

    const customerId = order.customerId?._id || order.customerId;
    if (customerId) {
      await customerService.updateById(
        customerId,
        {
          $inc: { totalSpent: Number(order.shippingFee || 0) },
          lastPurchaseDate: now,
        },
        session,
      );
    }

    const trackingLog = await orderTrackingLogRepository.create(
      {
        orderId,
        tripId: assignedTripId,
        status: ORDER_STATUSES.DELIVERED,
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

        await notificationService.create({
          userId: customerUserId,
          title: "Đánh giá dịch vụ giao hàng",
          message: `Đơn hàng #${order.orderCode} đã hoàn tất. Bạn có hài lòng với chuyến giao hàng này không? Vui lòng gửi đánh giá để giúp chúng tôi nâng cao chất lượng dịch vụ!`,
          type: "FEEDBACK_REQUEST",
          data: {
            orderId: order._id,
            orderCode: order.orderCode,
            tripId: assignedTripId,
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

  const customerUpdate = {
    $inc: {
      walletBalance: amount,
    },
  };
  const occConditions = {};

  const updatedCustomer = await customerService.updateById(
    customerId,
    customerUpdate,
    session,
    occConditions,
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

  if (!CANCELLABLE_ORDER_STATUSES.includes(order.status)) {
    throw new ApiError(400, ORDER_MESSAGES.CANNOT_CANCEL_STATUS(order.status));
  }

  if (cancelledBy) {
    await userService.getById(cancelledBy);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const assignedTripId = order.tripId?._id || order.tripId;
    const shippingFeeRefund = getRefundableShippingFee(order);
    let updatedOrder = await orderRepository.updateById(
      orderId,
      {
        status: ORDER_STATUSES.CANCELLED,
        tripId: null,
        notes: reason || order.notes,
      },
      session,
      { status: { $in: CANCELLABLE_ORDER_STATUSES }, deletedAt: null },
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

    const trackingLog = await orderTrackingLogRepository.create(
      {
        orderId,
        tripId: assignedTripId,
        status: ORDER_STATUSES.CANCELLED,
        notes: reason || "Order cancelled",
        changedBy: cancelledBy,
      },
      session,
    );

    if (assignedTripId) {
      await tripService.syncTotalOrder(assignedTripId, session);
    }

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

const deleteById = async ({ orderId, session = null, user = null }) => {
  const order = await getById(orderId, true, user, session);

  if (order.status !== ORDER_STATUSES.CREATED) {
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
      { status: ORDER_STATUSES.CREATED, deletedAt: null },
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
      "xóa đơn hàng",
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
  const queryFilter = await orderAccess.scopeOrderFilter(
    { deletedAt: null, ...filter },
    user,
  );
  return orderRepository.countAll({ filter: queryFilter });
};

const getStatsByStatus = async ({ filter = {}, user } = {}) => {
  const queryFilter = await orderAccess.scopeOrderFilter(
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

const claimForCodSettlement = (orderIds, conditions, session = null) => {
  return orderRepository.claimForCodSettlement(orderIds, conditions, session);
};

const releaseCodSettlement = (orderIds, session = null) => {
  return orderRepository.releaseCodSettlement(orderIds, session);
};

const markOrderAsFeedbacked = (orderId, session = null) => {
  return orderRepository.updateById(orderId, { isFeedbacked: true }, session);
};

const getByIds = async (orderIds = [], session = null) => {
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return [];
  }

  return orderRepository.findByIds(orderIds, session);
};

const getBillableOrdersForInvoice = async ({
  customerId,
  fromDate,
  toDate,
  excludeOrderIds = [],
}) => {
  if (!customerId || !fromDate || !toDate) {
    throw new ApiError(400, ORDER_MESSAGES.CUSTOMER_REQUIRED);
  }

  return orderRepository.findBillableByCustomer({
    customerId,
    fromDate,
    toDate,
    excludeOrderIds,
  });
};

const applyInvoicePayment = async ({
  orderIds = [],
  paidAmount = 0,
  paymentMethod = null,
  paymentTime = new Date(),
  session = null,
}) => {
  const orders = await getByIds(orderIds, session);
  const sortedOrders = [...orders].sort((first, second) => {
    const firstTime = new Date(first.createdAt || 0).getTime();
    const secondTime = new Date(second.createdAt || 0).getTime();

    if (firstTime !== secondTime) {
      return firstTime - secondTime;
    }

    return String(first._id).localeCompare(String(second._id));
  });

  let remainingPaidAmount = Math.max(0, Number(paidAmount) || 0);
  let updatedCount = 0;

  for (const order of sortedOrders) {
    const shippingFee = Number(order.shippingFee || 0);
    const allocation = Math.min(shippingFee, remainingPaidAmount);
    remainingPaidAmount -= allocation;
    const isFullyPaid = allocation >= shippingFee;

    await orderRepository.updateById(
      order._id,
      {
        shippingFeePaidAmount: allocation,
        shippingFeePaid: isFullyPaid,
        paymentStatus: isFullyPaid
          ? PAYMENT_STATUSES.COMPLETED
          : PAYMENT_STATUSES.PENDING,
        ...(paymentMethod ? { paymentMethod } : {}),
        ...(paymentTime ? { paymentTime } : {}),
      },
      session,
    );

    updatedCount += 1;
  }

  return updatedCount;
};

export default {
  create,
  getAll,
  getMyOrders,
  getById,
  getByIds,
  getByCode,
  updateById,
  deleteById,
  cancelOrder,
  markAsDelivered,
  recordFailureAttempt,
  countAll,
  getStatsByStatus,
  getRecentTrends,
  getIdsByWarehouseId,
  markOrderAsFeedbacked,
  claimForCodSettlement,
  releaseCodSettlement,
  applyInvoicePayment,
  getBillableOrdersForInvoice,
};
