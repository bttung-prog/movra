import mongoose from "mongoose";

import PAYMENT_STATUSES from "../../constants/paymentStatuses.js";
import PAYMENT_METHODS, {
  PAYER_TYPES,
} from "../../constants/paymentMethods.js";
import PAYMENT_PURPOSES from "../../constants/paymentPurposes.js";
import INVOICE_STATUSES from "../../constants/invoiceStatuses.js";
import ROLES from "../../constants/roles.js";
import {
  PAYMENT_MESSAGES,
  INVOICE_MESSAGES,
  ORDER_MESSAGES,
} from "../../constants/messages.js";
import {
  WALLET_TRANSACTION_TYPES,
  WALLET_TRANSACTION_DIRECTIONS,
} from "../../constants/walletTransactionTypes.js";
import { WALLET_TRANSACTION_STATUSES } from "../../constants/walletTransactionStatuses.js";

import ApiError from "../../utils/ApiError.js";
import generateCode from "../../utils/generateCode.js";

import invoiceService from "../invoice/invoice.service.js";
import orderService from "../order/order.service.js";
import tripService from "../trip/trip.service.js";
import customerService from "../customer/customer.service.js";
import walletTransactionService from "../walletTransaction/walletTransaction.service.js";

import paymentRepository from "./payment.repository.js";

const assertPaymentWarehouseAccess = async (payment, actor) => {
  if (actor?.role !== ROLES.DISPATCHER) return;

  let hasScopedResource = false;
  const invoiceId = payment.invoiceId?._id || payment.invoiceId;
  const orderId = payment.orderId?._id || payment.orderId;
  const tripId = payment.tripId?._id || payment.tripId;

  if (invoiceId) {
    await invoiceService.getById(invoiceId, actor);
    hasScopedResource = true;
  }
  if (orderId) {
    await orderService.getById(orderId, true, actor);
    hasScopedResource = true;
  }
  if (tripId) {
    await tripService.getById(tripId, false, actor);
    hasScopedResource = true;
  }
  for (const codOrder of payment.codOrders || []) {
    const codOrderId = codOrder.orderId?._id || codOrder.orderId;
    await orderService.getById(codOrderId, true, actor);
    hasScopedResource = true;
  }

  if (!hasScopedResource) {
    throw new ApiError(403, PAYMENT_MESSAGES.ACCESS_DENIED);
  }
};

const scopePaymentFilter = async (filter, actor) => {
  if (actor?.role !== ROLES.DISPATCHER) return filter;

  const [orderIds, tripIds, invoiceIds] = await Promise.all([
    orderService.getIdsByWarehouseId(actor.warehouseId),
    tripService.getIdsByWarehouseId(actor.warehouseId),
    invoiceService.getIdsByWarehouseId(actor.warehouseId),
  ]);

  return {
    $and: [
      filter,
      { $or: [{ orderId: null }, { orderId: { $in: orderIds } }] },
      { $or: [{ invoiceId: null }, { invoiceId: { $in: invoiceIds } }] },
      { $or: [{ tripId: null }, { tripId: { $in: tripIds } }] },
      { codOrders: { $not: { $elemMatch: { orderId: { $nin: orderIds } } } } },
      {
        $or: [
          { orderId: { $in: orderIds } },
          { invoiceId: { $in: invoiceIds } },
          { tripId: { $in: tripIds } },
          { "codOrders.orderId": { $in: orderIds } },
        ],
      },
    ],
  };
};

const assertCustomerOwnsResource = (resourceCustomerId, actor) => {
  if (actor?.role !== ROLES.CUSTOMER) {
    return;
  }

  const ownerId = resourceCustomerId?._id || resourceCustomerId;
  if (
    !actor.customerId ||
    !ownerId ||
    ownerId.toString() !== actor.customerId.toString()
  ) {
    throw new ApiError(403, PAYMENT_MESSAGES.ACCESS_DENIED);
  }
};

const syncCompletedPaymentEffects = async ({
  invoiceId,
  orderId,
  paymentAmount,
  paymentMethod,
  payerType,
  customerId,
  paymentId = null,
  session,
  actor = null,
}) => {
  let targetCustomerId = customerId;
  let invoicePaidAmount = null;
  let invoiceIsPaid = null;

  if (invoiceId) {
    const invoice = await invoiceService.getById(invoiceId, actor);
    if (invoice) {
      if (
        ![
          INVOICE_STATUSES.ISSUED,
          INVOICE_STATUSES.PARTIALLY_PAID,
          INVOICE_STATUSES.OVERDUE,
        ].includes(invoice.status)
      ) {
        throw new ApiError(
          409,
          INVOICE_MESSAGES.CANNOT_PAY_UNISSUED(invoice.status),
        );
      }
      if (paymentAmount > invoice.remainingAmount) {
        throw new ApiError(
          409,
          PAYMENT_MESSAGES.EXCEEDS_REMAINING_AMOUNT(invoice.remainingAmount),
        );
      }

      targetCustomerId =
        targetCustomerId || invoice.customerId?._id || invoice.customerId;
      const newPaidAmount = (invoice.paidAmount || 0) + paymentAmount;
      invoicePaidAmount = newPaidAmount;
      const newRemainingAmount = invoice.remainingAmount - paymentAmount;
      const newStatus =
        newRemainingAmount === 0
          ? INVOICE_STATUSES.PAID
          : INVOICE_STATUSES.PARTIALLY_PAID;
      invoiceIsPaid = newStatus === INVOICE_STATUSES.PAID;

      const updatedInvoice = await invoiceService.updatePaymentProgress(
        invoiceId,
        {
          paidAmount: newPaidAmount,
          remainingAmount: newRemainingAmount,
          status: newStatus,
        },
        session,
        {
          status: {
            $in: [
              INVOICE_STATUSES.ISSUED,
              INVOICE_STATUSES.PARTIALLY_PAID,
              INVOICE_STATUSES.OVERDUE,
            ],
          },
          paidAmount: invoice.paidAmount || 0,
          remainingAmount: { $gte: paymentAmount },
        },
      );
      if (!updatedInvoice) {
        throw new ApiError(
          409,
          PAYMENT_MESSAGES.EXCEEDS_REMAINING_AMOUNT(invoice.remainingAmount),
        );
      }

      const targetOrderId = invoice.orderId?._id || invoice.orderId;
      if (!orderId && targetOrderId && newStatus === INVOICE_STATUSES.PAID) {
        orderId = targetOrderId;
      }
    }
  }

  if (orderId) {
    const isDirectOrderPayment =
      payerType === PAYER_TYPES.CUSTOMER && !invoiceId;
    const order = await orderService.getById(
      orderId,
      true,
      actor,
      isDirectOrderPayment ? session : null,
    );
    if (order) {
      targetCustomerId =
        targetCustomerId || order.customerId?._id || order.customerId;
      const updateData = {
        paymentStatus: invoiceIsPaid === false ? "pending" : "success",
        paymentTime: new Date(),
      };

      if (payerType === PAYER_TYPES.CUSTOMER) {
        const shippingFee = Number(order.shippingFee || 0);
        const previouslyPaidAmount = Number(
          order.shippingFeePaidAmount ??
            (order.shippingFeePaid ? shippingFee : 0),
        );
        const remainingShippingFee = Math.max(
          0,
          shippingFee - previouslyPaidAmount,
        );
        if (isDirectOrderPayment) {
          if (remainingShippingFee <= 0) {
            throw new ApiError(400, ORDER_MESSAGES.SHIPPING_FEE_ALREADY_PAID);
          }
          if (paymentAmount > remainingShippingFee) {
            throw new ApiError(
              400,
              PAYMENT_MESSAGES.EXCEEDS_ORDER_SHIPPING_BALANCE(
                remainingShippingFee,
              ),
            );
          }
        }

        const amountPaidTowardOrder =
          invoicePaidAmount ?? previouslyPaidAmount + paymentAmount;
        updateData.shippingFeePaidAmount = Math.min(
          shippingFee,
          Math.max(0, amountPaidTowardOrder),
        );
        updateData.shippingFeePaid =
          updateData.shippingFeePaidAmount >= shippingFee;
        if (!invoiceId) {
          updateData.paymentStatus = updateData.shippingFeePaid
            ? "success"
            : "pending";
        }
      }

      const updateConditions =
        payerType === PAYER_TYPES.CUSTOMER && !invoiceId
          ? {
              shippingFee: order.shippingFee,
              shippingFeePaid:
                order.shippingFeePaid === true ? true : { $in: [null, false] },
              shippingFeePaidAmount:
                order.shippingFeePaidAmount == null
                  ? { $in: [null, 0] }
                  : Number(order.shippingFeePaidAmount),
            }
          : {};

      const updatedOrder = await orderService.updateById({
        orderId,
        updateData,
        session,
        conditions: updateConditions,
        user: actor,
      });
      if (isDirectOrderPayment && !updatedOrder) {
        throw new ApiError(409, PAYMENT_MESSAGES.ORDER_PAYMENT_CHANGED);
      }
    }
  }

  if (targetCustomerId) {
    const customer = await customerService.getById(targetCustomerId, session);
    const customerUpdate = {
      $inc: {
        totalSpent: paymentAmount,
        loyaltyPoints: Math.floor(paymentAmount / 10000),
      },
      lastPurchaseDate: new Date(),
    };

    if (paymentMethod === PAYMENT_METHODS.WALLET_BALANCE) {
      const balanceBefore = Number(customer.walletBalance || 0);
      if (balanceBefore < paymentAmount) {
        throw new ApiError(400, PAYMENT_MESSAGES.INSUFFICIENT_WALLET_BALANCE);
      }
      const balanceAfter = balanceBefore - paymentAmount;
      customerUpdate.$inc.walletBalance = -paymentAmount;

      const updatedCustomer = await customerService.updateById(
        targetCustomerId,
        customerUpdate,
        session,
        { walletBalance: { $gte: paymentAmount } },
      );
      if (!updatedCustomer) {
        throw new ApiError(400, PAYMENT_MESSAGES.INSUFFICIENT_WALLET_BALANCE);
      }

      await walletTransactionService.recordTransaction(
        {
          transactionCode: generateCode("WTRX"),
          customerId: targetCustomerId,
          type: WALLET_TRANSACTION_TYPES.PAYMENT,
          direction: WALLET_TRANSACTION_DIRECTIONS.DEBIT,
          amount: paymentAmount,
          balanceBefore,
          balanceAfter,
          paymentId,
          orderId: orderId || null,
          status: WALLET_TRANSACTION_STATUSES.SUCCESS,
          notes:
            `Thanh toán ${invoiceId ? `hóa đơn ${invoiceId}` : `đơn hàng ${orderId || ""}`}`.trim(),
        },
        session,
      );
      return;
    }

    await customerService.updateById(targetCustomerId, customerUpdate, session);
  }
};

const create = async (payload, actor) => {
  const {
    invoiceId,
    orderId: inputOrderId,
    payerType: requestedPayerType = PAYER_TYPES.CUSTOMER,
    paymentAmount,
    paymentMethod,
    transactionReference,
    proofUrl,
    notes = "",
    isImmediateVerify = false,
  } = payload;
  if (
    actor?.role === ROLES.CUSTOMER &&
    requestedPayerType !== PAYER_TYPES.CUSTOMER
  ) {
    throw new ApiError(403, PAYMENT_MESSAGES.CUSTOMER_PAYER_TYPE_ONLY);
  }
  const payerType =
    actor?.role === ROLES.CUSTOMER ? PAYER_TYPES.CUSTOMER : requestedPayerType;

  let invoice = null;
  let finalOrderId = inputOrderId;
  let linkedInvoiceId = invoiceId;
  let customerId = null;

  if (!linkedInvoiceId && finalOrderId) {
    const activeInvoice = await invoiceService.getByOrderId(
      finalOrderId,
      actor,
    );
    if (
      activeInvoice &&
      activeInvoice.status !== INVOICE_STATUSES.CANCELLED &&
      activeInvoice.status !== INVOICE_STATUSES.PAID
    ) {
      linkedInvoiceId = activeInvoice._id;
    }
  }

  if (linkedInvoiceId) {
    invoice = await invoiceService.getById(linkedInvoiceId, actor);
    if (!invoice) {
      throw new ApiError(404, INVOICE_MESSAGES.NOT_FOUND);
    }
    assertCustomerOwnsResource(invoice.customerId, actor);

    if (
      invoice.status === INVOICE_STATUSES.PAID ||
      invoice.remainingAmount <= 0
    ) {
      throw new ApiError(400, INVOICE_MESSAGES.ALREADY_PAID);
    }

    if (invoice.status === INVOICE_STATUSES.CANCELLED) {
      throw new ApiError(400, INVOICE_MESSAGES.CANNOT_PAY_CANCELLED);
    }

    if (
      ![
        INVOICE_STATUSES.ISSUED,
        INVOICE_STATUSES.PARTIALLY_PAID,
        INVOICE_STATUSES.OVERDUE,
      ].includes(invoice.status)
    ) {
      throw new ApiError(
        400,
        INVOICE_MESSAGES.CANNOT_PAY_UNISSUED(invoice.status),
      );
    }

    if (paymentAmount > invoice.remainingAmount) {
      throw new ApiError(
        400,
        PAYMENT_MESSAGES.EXCEEDS_REMAINING_AMOUNT(invoice.remainingAmount),
      );
    }

    finalOrderId = finalOrderId || invoice.orderId?._id || invoice.orderId;
    customerId = invoice.customerId?._id || invoice.customerId;
  }

  if (
    finalOrderId &&
    (actor?.role === ROLES.CUSTOMER ||
      payerType === PAYER_TYPES.CUSTOMER ||
      !customerId)
  ) {
    const order = await orderService.getById(finalOrderId, true, actor);
    assertCustomerOwnsResource(order.customerId, actor);

    if (payerType === PAYER_TYPES.CUSTOMER) {
      if (order.status === "cancelled") {
        throw new ApiError(
          400,
          ORDER_MESSAGES.CANCELLED_ORDER_CANNOT_BE_BILLED,
        );
      }

      if (order.shippingFeePaid) {
        throw new ApiError(400, ORDER_MESSAGES.SHIPPING_FEE_ALREADY_PAID);
      }

      if (!linkedInvoiceId) {
        const shippingFee = Number(order.shippingFee || 0);
        const paidAmount = Number(
          order.shippingFeePaidAmount ??
            (order.shippingFeePaid ? shippingFee : 0),
        );
        const remainingShippingFee = Math.max(0, shippingFee - paidAmount);
        if (paymentAmount > remainingShippingFee) {
          throw new ApiError(
            400,
            PAYMENT_MESSAGES.EXCEEDS_ORDER_SHIPPING_BALANCE(
              remainingShippingFee,
            ),
          );
        }
      }

      customerId = customerId || order.customerId?._id || order.customerId;
    } else if (!customerId) {
      customerId = order.customerId?._id || order.customerId;
    }
  }

  customerId = customerId || actor?.customerId || null;

  if (actor?.role === ROLES.DISPATCHER) {
    if (!finalOrderId && !linkedInvoiceId) {
      throw new ApiError(403, PAYMENT_MESSAGES.ACCESS_DENIED);
    }
    if (finalOrderId) {
      await orderService.getById(finalOrderId, true, actor);
    }
    if (linkedInvoiceId) {
      const invoiceOrderId = invoice?.orderId?._id || invoice?.orderId;
      if (
        invoiceOrderId &&
        finalOrderId &&
        invoiceOrderId.toString() !== finalOrderId.toString()
      ) {
        throw new ApiError(400, PAYMENT_MESSAGES.ACCESS_DENIED);
      }
    }
  }

  if (paymentMethod === PAYMENT_METHODS.WALLET_BALANCE) {
    if (!customerId) {
      throw new ApiError(400, PAYMENT_MESSAGES.CUSTOMER_REQUIRED_FOR_WALLET);
    }

    const customer = await customerService.getById(customerId);
    if (customer.walletBalance < paymentAmount) {
      throw new ApiError(400, PAYMENT_MESSAGES.INSUFFICIENT_WALLET_BALANCE);
    }
  }

  const isStaff = [ROLES.ADMIN, ROLES.DISPATCHER].includes(actor?.role);
  const shouldCompleteImmediately =
    paymentMethod === PAYMENT_METHODS.WALLET_BALANCE ||
    (isStaff && Boolean(isImmediateVerify));
  const initialStatus = shouldCompleteImmediately
    ? PAYMENT_STATUSES.COMPLETED
    : PAYMENT_STATUSES.PENDING;

  const paymentCode = generateCode("PAY");

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const paymentData = {
      paymentCode,
      invoiceId: linkedInvoiceId || null,
      orderId: finalOrderId || null,
      customerId: customerId || null,
      payerType,
      paymentDate: new Date(),
      paymentAmount,
      paymentMethod,
      paymentStatus: initialStatus,
      transactionReference: transactionReference || null,
      handledBy: shouldCompleteImmediately
        ? actor?.userId || actor?._id || null
        : null,
      proofUrl: proofUrl || null,
      notes,
    };

    const newPayment = await paymentRepository.create(paymentData, session);

    if (initialStatus === PAYMENT_STATUSES.COMPLETED) {
      await syncCompletedPaymentEffects({
        invoiceId: linkedInvoiceId,
        orderId: finalOrderId,
        paymentAmount,
        paymentMethod,
        payerType,
        customerId,
        paymentId: newPayment._id,
        session,
        actor,
      });
    }

    await session.commitTransaction();
    return newPayment;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const createWalletTopUp = async (paymentData, session = null) => {
  const transactionReference = paymentData.transactionReference?.trim();
  if (!transactionReference) {
    throw new ApiError(400, PAYMENT_MESSAGES.INVALID_TOPUP_REFERENCE);
  }

  const duplicateReference = await paymentRepository.findTopUpByReference(
    paymentData.paymentMethod,
    transactionReference,
  );
  if (duplicateReference) {
    throw new ApiError(409, PAYMENT_MESSAGES.DUPLICATE_TOPUP_REFERENCE);
  }

  try {
    return await paymentRepository.create(
      {
        ...paymentData,
        transactionReference,
        payerType: PAYER_TYPES.CUSTOMER,
        purpose: PAYMENT_PURPOSES.WALLET_TOP_UP,
        paymentStatus: PAYMENT_STATUSES.PENDING,
      },
      session,
    );
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.transactionReference) {
      throw new ApiError(409, PAYMENT_MESSAGES.DUPLICATE_TOPUP_REFERENCE);
    }
    throw error;
  }
};

const createDriverRemittance = async (payload, driverUser, actor = null) => {
  const {
    tripId,
    orderIds = [],
    orders = [],
    paymentAmount,
    paymentMethod,
    transactionReference,
    proofUrl,
    notes = "",
  } = payload;

  const paymentCode = generateCode("PAY");

  if (tripId) {
    await tripService.getById(tripId, true, actor);
  }

  const requestedOrders =
    orders.length > 0 ? orders : orderIds.map((orderId) => ({ orderId }));
  const codOrders = [];
  const seenOrderIds = new Set();
  let expectedRemittanceAmount = 0;

  for (const requestedOrder of requestedOrders) {
    const orderId = requestedOrder.orderId;
    if (seenOrderIds.has(orderId.toString())) {
      throw new ApiError(400, PAYMENT_MESSAGES.DUPLICATE_COD_ORDER);
    }
    seenOrderIds.add(orderId.toString());

    const orderDoc = await orderService.getById(orderId, true, actor);
    if (orderDoc.status !== "delivered") {
      throw new ApiError(400, PAYMENT_MESSAGES.COD_ORDER_NOT_DELIVERED);
    }
    if (orderDoc.codSettled) {
      throw new ApiError(409, PAYMENT_MESSAGES.COD_ALREADY_SETTLED);
    }

    const assignedDriverId =
      orderDoc.tripId?.driverId?._id || orderDoc.tripId?.driverId;
    if (
      driverUser?.driverId &&
      assignedDriverId?.toString() !== driverUser.driverId.toString()
    ) {
      throw new ApiError(
        403,
        PAYMENT_MESSAGES.DRIVER_NOT_ASSIGNED_TO_COD_ORDER,
      );
    }

    const orderTripId = orderDoc.tripId?._id || orderDoc.tripId;
    if (tripId && orderTripId?.toString() !== tripId.toString()) {
      throw new ApiError(400, PAYMENT_MESSAGES.COD_ORDER_TRIP_MISMATCH);
    }

    const expectedCod = Number(orderDoc.codAmount || 0);
    if (expectedCod <= 0) {
      throw new ApiError(400, PAYMENT_MESSAGES.ORDER_HAS_NO_COD);
    }
    const collectedSoFar = Number(orderDoc.codCollectedAmount || 0);
    const remittedSoFar = Number(orderDoc.codRemittedAmount || 0);
    const remainingToCollect = Math.max(0, expectedCod - collectedSoFar);
    const unremittedAmount = Math.max(0, collectedSoFar - remittedSoFar);
    const collectedAmount =
      requestedOrder.collectedAmount !== undefined
        ? Number(requestedOrder.collectedAmount)
        : unremittedAmount > 0
          ? 0
          : remainingToCollect;

    if (
      !Number.isFinite(collectedAmount) ||
      collectedAmount < 0 ||
      collectedAmount > remainingToCollect
    ) {
      throw new ApiError(400, PAYMENT_MESSAGES.INVALID_COD_COLLECTED_AMOUNT);
    }

    const availableToRemit = unremittedAmount + collectedAmount;
    expectedRemittanceAmount += availableToRemit;
    codOrders.push({
      orderId,
      expectedCod,
      collectedAmount,
      availableToRemit,
      remittedAmount: 0,
      shortfallAmount: 0,
    });
  }

  let remainingPaymentAmount = Number(paymentAmount);
  for (const codOrder of codOrders) {
    codOrder.remittedAmount = Math.min(
      codOrder.availableToRemit,
      remainingPaymentAmount,
    );
    codOrder.shortfallAmount =
      codOrder.availableToRemit - codOrder.remittedAmount;
    remainingPaymentAmount -= codOrder.remittedAmount;
    delete codOrder.availableToRemit;
  }

  const discrepancyAmount = paymentAmount - expectedRemittanceAmount;

  const paymentData = {
    paymentCode,
    tripId: tripId || null,
    orderId: codOrders.length === 1 ? codOrders[0].orderId : null,
    codOrders,
    discrepancyAmount,
    driverId: driverUser?.driverId || null,
    payerType: PAYER_TYPES.DRIVER,
    paymentDate: new Date(),
    paymentAmount,
    paymentMethod,
    paymentStatus: PAYMENT_STATUSES.PENDING,
    transactionReference: transactionReference || null,
    handledBy: null,
    proofUrl: proofUrl || null,
    notes: notes || `Tài xế nộp tiền COD/cước theo chuyến ${tripId || ""}`,
  };

  return paymentRepository.create(paymentData);
};

const verifyPayment = async (paymentId, payload, verifierUser) => {
  const { status, notes = "" } = payload;

  const payment = await paymentRepository.findById(paymentId);
  if (!payment) {
    throw new ApiError(404, PAYMENT_MESSAGES.NOT_FOUND);
  }
  await assertPaymentWarehouseAccess(payment, verifierUser);

  if (payment.paymentStatus !== PAYMENT_STATUSES.PENDING) {
    throw new ApiError(400, PAYMENT_MESSAGES.ALREADY_VERIFIED);
  }

  if (status === PAYMENT_STATUSES.FAILED) {
    const updatedPayment = await paymentRepository.updateById(
      paymentId,
      {
        paymentStatus: PAYMENT_STATUSES.FAILED,
        handledBy: verifierUser.userId,
        notes: payment.notes
          ? `${payment.notes} | Từ chối: ${notes}`
          : `Từ chối: ${notes}`,
      },
      null,
      { paymentStatus: PAYMENT_STATUSES.PENDING },
    );
    if (!updatedPayment) {
      throw new ApiError(409, PAYMENT_MESSAGES.ALREADY_VERIFIED);
    }
    return updatedPayment;
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const updatedPayment = await paymentRepository.updateById(
      paymentId,
      {
        paymentStatus: PAYMENT_STATUSES.COMPLETED,
        handledBy: verifierUser.userId,
        notes: notes
          ? `${payment.notes || ""} | Duyệt: ${notes}`
          : payment.notes,
      },
      session,
      { paymentStatus: PAYMENT_STATUSES.PENDING },
    );
    if (!updatedPayment) {
      throw new ApiError(409, PAYMENT_MESSAGES.ALREADY_VERIFIED);
    }

    if (payment.purpose === PAYMENT_PURPOSES.WALLET_TOP_UP) {
      const customerId = payment.customerId?._id || payment.customerId;
      const customer = await customerService.getById(customerId, session);
      const balanceBefore = Number(customer.walletBalance || 0);
      const balanceAfter = balanceBefore + Number(payment.paymentAmount);

      await customerService.updateById(
        customerId,
        { $inc: { walletBalance: payment.paymentAmount } },
        session,
      );

      await walletTransactionService.recordTransaction(
        {
          customerId,
          type: WALLET_TRANSACTION_TYPES.TOP_UP,
          direction: WALLET_TRANSACTION_DIRECTIONS.CREDIT,
          amount: payment.paymentAmount,
          balanceBefore,
          balanceAfter,
          paymentId: payment._id,
          handledBy: verifierUser.userId,
          status: WALLET_TRANSACTION_STATUSES.SUCCESS,
          notes: `Nạp tiền ví theo giao dịch ${payment.paymentCode}`,
        },
        session,
      );
    } else if (payment.payerType !== PAYER_TYPES.DRIVER) {
      await syncCompletedPaymentEffects({
        invoiceId: payment.invoiceId?._id || payment.invoiceId,
        orderId: payment.orderId?._id || payment.orderId,
        paymentAmount: payment.paymentAmount,
        paymentMethod: payment.paymentMethod,
        payerType: payment.payerType,
        customerId: payment.customerId?._id || payment.customerId || null,
        paymentId: payment._id,
        session,
        actor: verifierUser,
      });
    }

    if (
      payment.payerType === PAYER_TYPES.DRIVER ||
      (payment.codOrders && payment.codOrders.length > 0)
    ) {
      const ordersToUpdate = [];
      if (payment.codOrders && payment.codOrders.length > 0) {
        payment.codOrders.forEach((item) => {
          const oid = item.orderId?._id || item.orderId;
          if (oid) ordersToUpdate.push(oid);
        });
      }
      if (payment.orderId) {
        const singleOid = payment.orderId?._id || payment.orderId;
        if (
          !ordersToUpdate.some((id) => id.toString() === singleOid.toString())
        ) {
          ordersToUpdate.push(singleOid);
        }
      }

      for (const oid of ordersToUpdate) {
        const codOrder = payment.codOrders.find(
          (item) =>
            (item.orderId?._id || item.orderId).toString() === oid.toString(),
        );
        if (!codOrder) continue;

        const order = await orderService.getById(
          oid,
          true,
          verifierUser,
          session,
        );
        if (order.status !== "delivered") {
          throw new ApiError(409, PAYMENT_MESSAGES.ORDER_NOT_DELIVERED);
        }

        const codAmount = Number(order.codAmount || 0);
        const collectedBefore = Number(order.codCollectedAmount || 0);
        const remittedBefore = Number(order.codRemittedAmount || 0);
        const collectedAfter =
          collectedBefore + Number(codOrder.collectedAmount);
        const remittedAfter = remittedBefore + Number(codOrder.remittedAmount);

        if (collectedAfter > codAmount || remittedAfter > collectedAfter) {
          throw new ApiError(409, PAYMENT_MESSAGES.COD_AMOUNT_CHANGED);
        }

        const updatedOrder = await orderService.updateById({
          orderId: oid,
          updateData: {
            codCollectedAmount: collectedAfter,
            codRemittedAmount: remittedAfter,
            codCollected: collectedAfter >= codAmount,
          },
          session,
          user: verifierUser,
          conditions: {
            codCollectedAmount:
              order.codCollectedAmount == null
                ? { $in: [null, 0] }
                : collectedBefore,
            codRemittedAmount:
              order.codRemittedAmount == null
                ? { $in: [null, 0] }
                : remittedBefore,
          },
        });

        if (!updatedOrder) {
          throw new ApiError(409, PAYMENT_MESSAGES.COD_AMOUNT_CHANGED);
        }
      }
    }

    await session.commitTransaction();
    return updatedPayment;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const refundPayment = async (paymentId, payload, actor) => {
  const { reason, refundAmount } = payload;

  const existingPayment = await paymentRepository.findById(paymentId);
  if (!existingPayment) {
    throw new ApiError(404, PAYMENT_MESSAGES.NOT_FOUND);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const payment = await paymentRepository.findById(paymentId, session);
    if (
      ![
        PAYMENT_STATUSES.COMPLETED,
        PAYMENT_STATUSES.PARTIALLY_REFUNDED,
      ].includes(payment.paymentStatus)
    ) {
      throw new ApiError(
        400,
        PAYMENT_MESSAGES.CANNOT_REFUND_STATUS(payment.paymentStatus),
      );
    }

    const previousRefundedAmount = Number(payment.refundedAmount || 0);
    const remainingRefundableAmount = Math.max(
      0,
      Number(payment.paymentAmount) - previousRefundedAmount,
    );
    const effectiveRefundAmount =
      refundAmount === undefined
        ? remainingRefundableAmount
        : Number(refundAmount);
    if (!Number.isFinite(effectiveRefundAmount) || effectiveRefundAmount <= 0) {
      throw new ApiError(400, PAYMENT_MESSAGES.REFUND_EXCEEDS_REMAINING);
    }
    if (effectiveRefundAmount > remainingRefundableAmount) {
      throw new ApiError(400, PAYMENT_MESSAGES.REFUND_EXCEEDS_REMAINING);
    }

    const refundedAmount = previousRefundedAmount + effectiveRefundAmount;
    const nextPaymentStatus =
      refundedAmount >= Number(payment.paymentAmount)
        ? PAYMENT_STATUSES.REFUNDED
        : PAYMENT_STATUSES.PARTIALLY_REFUNDED;
    const refundedAt = new Date();
    const refundEntry = {
      amount: effectiveRefundAmount,
      reason,
      refundedAt,
      refundedBy: actor.userId,
    };
    const refundConditions = {
      paymentStatus: {
        $in: [PAYMENT_STATUSES.COMPLETED, PAYMENT_STATUSES.PARTIALLY_REFUNDED],
      },
      ...(previousRefundedAmount === 0
        ? {
            $or: [
              { refundedAmount: 0 },
              { refundedAmount: { $exists: false } },
            ],
          }
        : { refundedAmount: previousRefundedAmount }),
    };

    const updatedPayment = await paymentRepository.updateById(
      paymentId,
      {
        $set: {
          paymentStatus: nextPaymentStatus,
          refundDetails: {
            amount: effectiveRefundAmount,
            refundReason: reason,
            refundedAt,
            refundedBy: actor.userId,
          },
        },
        $inc: { refundedAmount: effectiveRefundAmount },
        $push: { refundHistory: refundEntry },
      },
      session,
      refundConditions,
    );
    if (!updatedPayment) {
      throw new ApiError(409, PAYMENT_MESSAGES.REFUND_STATE_CHANGED);
    }

    const invoiceId = payment.invoiceId?._id || payment.invoiceId;
    if (invoiceId) {
      const invoice = await invoiceService.getById(invoiceId);
      if (invoice) {
        const newPaidAmount = Math.max(
          0,
          (invoice.paidAmount || 0) - effectiveRefundAmount,
        );
        const newRemainingAmount = Math.min(
          invoice.totalAmount,
          invoice.totalAmount - newPaidAmount,
        );
        const newStatus =
          newPaidAmount === 0
            ? INVOICE_STATUSES.ISSUED
            : INVOICE_STATUSES.PARTIALLY_PAID;

        await invoiceService.updatePaymentProgress(
          invoiceId,
          {
            paidAmount: newPaidAmount,
            remainingAmount: newRemainingAmount,
            status: newStatus,
          },
          session,
        );

        const targetOrderId = invoice.orderId?._id || invoice.orderId;
        if (targetOrderId) {
          const order = await orderService.getById(targetOrderId);
          const shippingFee = Number(order.shippingFee || 0);
          const shippingFeePaidAmount = Math.min(
            shippingFee,
            Math.max(0, newPaidAmount),
          );

          await orderService.updateById({
            orderId: targetOrderId,
            updateData: {
              paymentStatus: "pending",
              shippingFeePaidAmount,
              shippingFeePaid: shippingFeePaidAmount >= shippingFee,
            },
            session,
          });
        }
      }
    }

    if (
      !invoiceId &&
      payment.orderId &&
      payment.payerType === PAYER_TYPES.CUSTOMER
    ) {
      const orderId = payment.orderId?._id || payment.orderId;
      const order = await orderService.getById(orderId);
      const shippingFee = Number(order.shippingFee || 0);
      const previousShippingFeePaidAmount = Number(
        order.shippingFeePaidAmount ??
          (order.shippingFeePaid ? shippingFee : 0),
      );
      const shippingFeePaidAmount = Math.max(
        0,
        previousShippingFeePaidAmount - effectiveRefundAmount,
      );

      await orderService.updateById({
        orderId,
        updateData: {
          paymentStatus: "pending",
          shippingFeePaidAmount,
          shippingFeePaid: shippingFeePaidAmount >= shippingFee,
        },
        session,
      });
    }

    const customerId = payment.customerId?._id || payment.customerId;
    const isWalletTopUp =
      payment.purpose === PAYMENT_PURPOSES.WALLET_TOP_UP ||
      (!payment.invoiceId &&
        !payment.orderId &&
        customerId &&
        payment.payerType === PAYER_TYPES.CUSTOMER);
    if (isWalletTopUp && !customerId) {
      throw new ApiError(409, PAYMENT_MESSAGES.CUSTOMER_REQUIRED_FOR_WALLET);
    }
    if (customerId && isWalletTopUp) {
      const customer = await customerService.getById(customerId, session);
      const balanceBefore = Number(customer.walletBalance || 0);
      const debitedCustomer = await customerService.debitWallet(
        customerId,
        effectiveRefundAmount,
        session,
      );
      if (!debitedCustomer) {
        throw new ApiError(400, PAYMENT_MESSAGES.INSUFFICIENT_WALLET_BALANCE);
      }
      const balanceAfter = Number(debitedCustomer.walletBalance || 0);

      await walletTransactionService.recordTransaction(
        {
          transactionCode: generateCode("WTRX"),
          customerId,
          type: WALLET_TRANSACTION_TYPES.REFUND,
          direction: WALLET_TRANSACTION_DIRECTIONS.DEBIT,
          amount: effectiveRefundAmount,
          balanceBefore,
          balanceAfter,
          paymentId,
          status: WALLET_TRANSACTION_STATUSES.SUCCESS,
          notes:
            `Thu hồi tiền nạp ví ${payment.paymentCode}: ${reason || ""}`.trim(),
        },
        session,
      );
    } else if (customerId && !isWalletTopUp) {
      const customer = await customerService.getById(customerId, session);
      const pointsBeforeRefund = Math.floor(
        Math.max(0, Number(payment.paymentAmount) - previousRefundedAmount) /
          10000,
      );
      const pointsAfterRefund = Math.floor(
        Math.max(0, Number(payment.paymentAmount) - refundedAmount) / 10000,
      );
      const pointsToReverse = pointsBeforeRefund - pointsAfterRefund;

      const customerUpdate = {
        $inc: {
          totalSpent: -effectiveRefundAmount,
          loyaltyPoints: -pointsToReverse,
        },
      };

      if (payment.paymentMethod === PAYMENT_METHODS.WALLET_BALANCE) {
        const balanceBefore = Number(customer.walletBalance || 0);
        const balanceAfter = balanceBefore + effectiveRefundAmount;
        customerUpdate.$inc.walletBalance = effectiveRefundAmount;

        const updatedCustomer = await customerService.updateById(
          customerId,
          customerUpdate,
          session,
          {
            totalSpent: { $gte: effectiveRefundAmount },
            loyaltyPoints: { $gte: pointsToReverse },
          },
        );
        if (!updatedCustomer) {
          throw new ApiError(409, PAYMENT_MESSAGES.REFUND_STATE_CHANGED);
        }

        await walletTransactionService.recordTransaction(
          {
            transactionCode: generateCode("WTRX"),
            customerId,
            type: WALLET_TRANSACTION_TYPES.REFUND,
            direction: WALLET_TRANSACTION_DIRECTIONS.CREDIT,
            amount: effectiveRefundAmount,
            balanceBefore,
            balanceAfter,
            paymentId,
            orderId: payment.orderId?._id || payment.orderId || null,
            status: WALLET_TRANSACTION_STATUSES.SUCCESS,
            notes:
              `Hoàn tiền thanh toán mã ${payment.paymentCode}: ${reason || ""}`.trim(),
          },
          session,
        );
      } else {
        const updatedCustomer = await customerService.updateById(
          customerId,
          customerUpdate,
          session,
          {
            totalSpent: { $gte: effectiveRefundAmount },
            loyaltyPoints: { $gte: pointsToReverse },
          },
        );
        if (!updatedCustomer) {
          throw new ApiError(409, PAYMENT_MESSAGES.REFUND_STATE_CHANGED);
        }
      }
    }

    await session.commitTransaction();
    return updatedPayment;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const getAll = async ({
  filter = {},
  page = 1,
  limit = 10,
  sort = { createdAt: -1 },
  actor = null,
} = {}) => {
  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const limitNumber = Math.max(1, parseInt(limit, 10) || 10);
  const skip = (pageNumber - 1) * limitNumber;

  const queryFilter = await scopePaymentFilter(filter, actor);

  const [payments, total] = await Promise.all([
    paymentRepository.findAll({
      filter: queryFilter,
      skip,
      limit: limitNumber,
      sort,
    }),
    paymentRepository.countAll({ filter: queryFilter }),
  ]);

  return {
    data: payments,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages: Math.ceil(total / limitNumber),
    },
  };
};

const getById = async (id, actor = null) => {
  const payment = await paymentRepository.findById(id);
  if (!payment) {
    throw new ApiError(404, PAYMENT_MESSAGES.NOT_FOUND);
  }

  await assertPaymentWarehouseAccess(payment, actor);

  if (actor?.role === ROLES.CUSTOMER) {
    const paymentCustomerId = (
      payment.customerId?._id || payment.customerId
    )?.toString();

    if (
      !actor.customerId ||
      paymentCustomerId !== actor.customerId.toString()
    ) {
      throw new ApiError(403, PAYMENT_MESSAGES.ACCESS_DENIED);
    }
  }

  if (actor?.role === ROLES.DRIVER) {
    const paymentDriverId = (
      payment.driverId?._id || payment.driverId
    )?.toString();
    if (!actor.driverId || paymentDriverId !== actor.driverId.toString()) {
      throw new ApiError(403, PAYMENT_MESSAGES.ACCESS_DENIED);
    }
  }

  return payment;
};

const getByCode = async (paymentCode, actor = null) => {
  const payment = await paymentRepository.findByCode(paymentCode);
  if (!payment) {
    throw new ApiError(404, PAYMENT_MESSAGES.NOT_FOUND);
  }

  await assertPaymentWarehouseAccess(payment, actor);

  if (actor?.role === ROLES.CUSTOMER) {
    const paymentCustomerId = (
      payment.customerId?._id || payment.customerId
    )?.toString();

    if (
      !actor.customerId ||
      paymentCustomerId !== actor.customerId.toString()
    ) {
      throw new ApiError(403, PAYMENT_MESSAGES.ACCESS_DENIED);
    }
  }

  if (actor?.role === ROLES.DRIVER) {
    const paymentDriverId = (
      payment.driverId?._id || payment.driverId
    )?.toString();
    if (!actor.driverId || paymentDriverId !== actor.driverId.toString()) {
      throw new ApiError(403, PAYMENT_MESSAGES.ACCESS_DENIED);
    }
  }

  return payment;
};

const getStats = async (filter = {}, actor = null) => {
  const queryFilter = await scopePaymentFilter(filter, actor);
  return paymentRepository.getStats(queryFilter);
};

export default {
  create,
  createWalletTopUp,
  createDriverRemittance,
  verifyPayment,
  refundPayment,
  getAll,
  getById,
  getByCode,
  getStats,
};
