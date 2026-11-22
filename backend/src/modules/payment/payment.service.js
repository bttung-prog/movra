import mongoose from "mongoose";

import { PAYMENT_STATUSES } from "../../constants/paymentStatuses.js";
import {
  PAYMENT_METHODS,
  PAYER_TYPES,
} from "../../constants/paymentMethods.js";
import { PAYMENT_PURPOSES } from "../../constants/paymentPurposes.js";
import { INVOICE_STATUSES } from "../../constants/invoiceStatuses.js";
import { ORDER_STATUSES } from "../../constants/orderStatuses.js";
import { ROLES } from "../../constants/roles.js";
import {
  PAYMENT_MESSAGES,
  INVOICE_MESSAGES,
  ORDER_MESSAGES,
  WAREHOUSE_MESSAGES,
} from "../../constants/messages.js";
import {
  WALLET_TRANSACTION_TYPES,
  WALLET_TRANSACTION_DIRECTIONS,
} from "../../constants/walletTransactionTypes.js";
import { WALLET_TRANSACTION_STATUSES } from "../../constants/walletTransactionStatuses.js";

import { ApiError } from "../../utils/ApiError.js";
import { generateCode } from "../../utils/generateCode.js";

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

  const codOrderIds = (payment.codOrders || [])
    .map((item) => (item.orderId?._id || item.orderId)?.toString())
    .filter(Boolean);

  if (codOrderIds.length > 0) {
    const uniqueCodOrderIds = Array.from(new Set(codOrderIds));
    const accessibleCount = await orderService.countAccessibleOrdersByWarehouse(
      uniqueCodOrderIds,
      actor.warehouseId,
    );
    if (accessibleCount !== uniqueCodOrderIds.length) {
      throw new ApiError(403, WAREHOUSE_MESSAGES.ACCESS_DENIED);
    }
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

const buildVietQrUrl = (amount, paymentCode) => {
  const { VIETQR_BANK_ID, VIETQR_ACCOUNT_NUMBER, VIETQR_ACCOUNT_NAME } =
    process.env;

  if (!VIETQR_BANK_ID || !VIETQR_ACCOUNT_NUMBER) {
    throw new ApiError(500, PAYMENT_MESSAGES.VIETQR_CONFIGURATION_MISSING);
  }

  const template = process.env.VIETQR_TEMPLATE || "compact2";
  const query = new URLSearchParams({
    amount: String(amount),
    addInfo: paymentCode,
  });
  if (VIETQR_ACCOUNT_NAME) {
    query.set("accountName", VIETQR_ACCOUNT_NAME);
  }

  return `https://img.vietqr.io/image/${encodeURIComponent(VIETQR_BANK_ID)}-${encodeURIComponent(VIETQR_ACCOUNT_NUMBER)}-${encodeURIComponent(template)}.png?${query}`;
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
  releaseInvoiceReservation = false,
}) => {
  let targetCustomerId = customerId;
  let invoicePaidAmount = null;
  let invoiceIsPaid = null;
  let invoiceOrderIds = [];

  if (orderId && !invoiceId) {
    throw new ApiError(409, PAYMENT_MESSAGES.ORDER_INVOICE_REQUIRED);
  }

  if (invoiceId) {
    const invoice = await invoiceService.getById(invoiceId, actor, session);
    invoiceOrderIds = invoiceService.getInvoiceOrderIds(invoice);
    if (
      orderId &&
      !invoiceOrderIds.some(
        (invoiceOrderId) => invoiceOrderId.toString() === orderId.toString(),
      )
    ) {
      throw new ApiError(409, INVOICE_MESSAGES.ORDER_MISMATCH);
    }

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
        ...(releaseInvoiceReservation
          ? { $inc: { pendingAmount: -paymentAmount } }
          : {}),
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
        ...(releaseInvoiceReservation
          ? { pendingAmount: { $gte: paymentAmount } }
          : {}),
      },
    );
    if (!updatedInvoice) {
      throw new ApiError(
        409,
        PAYMENT_MESSAGES.EXCEEDS_REMAINING_AMOUNT(invoice.remainingAmount),
      );
    }

    const targetOrderId = invoiceOrderIds[0] || null;
    if (!orderId && targetOrderId && newStatus === INVOICE_STATUSES.PAID) {
      orderId = targetOrderId;
    }
  }

  if (invoiceOrderIds.length > 1) {
    await orderService.applyInvoicePayment({
      orderIds: invoiceOrderIds,
      paidAmount: invoicePaidAmount,
      paymentMethod: payerType === PAYER_TYPES.CUSTOMER ? paymentMethod : null,
      paymentTime: new Date(),
      session,
    });
  }

  let order = null;
  if (invoiceOrderIds.length <= 1 && orderId) {
    order = await orderService.getById(orderId, true, actor, session);
    if (order) {
      targetCustomerId =
        targetCustomerId || order.customerId?._id || order.customerId;
      const updateData = {
        paymentStatus:
          invoiceIsPaid === false
            ? PAYMENT_STATUSES.PENDING
            : PAYMENT_STATUSES.COMPLETED,
        paymentTime: new Date(),
      };

      if (payerType === PAYER_TYPES.CUSTOMER) {
        updateData.paymentMethod = paymentMethod;
        const shippingFee = Number(order.shippingFee || 0);
        updateData.shippingFeePaidAmount = Math.min(
          shippingFee,
          Math.max(0, invoicePaidAmount ?? 0),
        );
        updateData.shippingFeePaid =
          updateData.shippingFeePaidAmount >= shippingFee;
      }

      await orderService.updateById({
        orderId,
        updateData,
        session,
        user: actor,
      });
    }
  }

  if (targetCustomerId) {
    const customer = await customerService.getById(targetCustomerId, session);

    const customerUpdate = {
      lastPurchaseDate: new Date(),
    };

    if (paymentMethod === PAYMENT_METHODS.WALLET_BALANCE) {
      const balanceBefore = Number(customer.walletBalance || 0);
      if (balanceBefore < paymentAmount) {
        throw new ApiError(400, PAYMENT_MESSAGES.INSUFFICIENT_WALLET_BALANCE);
      }
      const balanceAfter = balanceBefore - paymentAmount;

      const updatedCustomer = await customerService.updateById(
        targetCustomerId,
        {
          ...customerUpdate,
          $inc: { walletBalance: -paymentAmount },
        },
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
  let availableInvoiceAmount = null;

  if (!linkedInvoiceId && finalOrderId) {
    const activeInvoice = await invoiceService.getByOrderId(
      finalOrderId,
      actor,
    );
    if (!activeInvoice) {
      await orderService.getById(finalOrderId, true, actor);
      throw new ApiError(400, PAYMENT_MESSAGES.ORDER_INVOICE_REQUIRED);
    }
    linkedInvoiceId = activeInvoice._id;
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
        INVOICE_STATUSES.DRAFT,
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

    availableInvoiceAmount =
      invoice.remainingAmount - Number(invoice.pendingAmount || 0);
    if (paymentAmount > availableInvoiceAmount) {
      throw new ApiError(
        400,
        PAYMENT_MESSAGES.EXCEEDS_REMAINING_AMOUNT(availableInvoiceAmount),
      );
    }

    const invoiceOrderIds = invoiceService.getInvoiceOrderIds(invoice);
    if (
      finalOrderId &&
      !invoiceOrderIds.some(
        (invoiceOrderId) =>
          invoiceOrderId.toString() === finalOrderId.toString(),
      )
    ) {
      throw new ApiError(400, INVOICE_MESSAGES.ORDER_MISMATCH);
    }

    finalOrderId = finalOrderId || invoiceOrderIds[0] || null;
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

  const isStaff = [ROLES.ADMIN, ROLES.ACCOUNTANT].includes(actor?.role);
  const shouldCompleteImmediately =
    paymentMethod === PAYMENT_METHODS.WALLET_BALANCE ||
    (isStaff && Boolean(isImmediateVerify));
  const initialStatus = shouldCompleteImmediately
    ? PAYMENT_STATUSES.COMPLETED
    : PAYMENT_STATUSES.PENDING;

  const paymentCode = generateCode("PAY");
  const qrCodeUrl =
    paymentMethod === PAYMENT_METHODS.BANK && payerType === PAYER_TYPES.CUSTOMER
      ? buildVietQrUrl(paymentAmount, paymentCode)
      : null;

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
      qrCodeUrl,
      paymentStatus: initialStatus,
      invoiceAmountReserved:
        Boolean(linkedInvoiceId) && initialStatus === PAYMENT_STATUSES.PENDING,
      transactionReference: transactionReference || null,
      handledBy: shouldCompleteImmediately
        ? actor?.userId || actor?._id || null
        : null,
      proofUrl: proofUrl || null,
      notes,
    };

    if (invoice?.status === INVOICE_STATUSES.DRAFT) {
      await invoiceService.issueInvoice(linkedInvoiceId, null, session);
    }

    if (paymentData.invoiceAmountReserved) {
      const reservedInvoice = await invoiceService.reservePendingPayment(
        linkedInvoiceId,
        paymentAmount,
        session,
      );
      if (!reservedInvoice) {
        throw new ApiError(
          409,
          PAYMENT_MESSAGES.EXCEEDS_REMAINING_AMOUNT(
            availableInvoiceAmount ?? 0,
          ),
        );
      }
    }

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

  const uniqueOrderIds = Array.from(
    new Set(orderIds.map((id) => id?.toString())),
  );
  if (uniqueOrderIds.length !== orderIds.length) {
    throw new ApiError(400, PAYMENT_MESSAGES.DUPLICATE_COD_ORDER);
  }

  const orderDocs = await orderService.getOrdersForRemittance(uniqueOrderIds);

  if (orderDocs.length !== uniqueOrderIds.length) {
    throw new ApiError(404, ORDER_MESSAGES.NOT_FOUND);
  }

  if (actor?.role === ROLES.DISPATCHER) {
    const userWarehouseId = actor.warehouseId?.toString();
    const isAllAccessible = orderDocs.every((order) => {
      const orderWarehouseId = (
        order.warehouseId?._id || order.warehouseId
      )?.toString();
      const orderDestWarehouseId = (
        order.destinationWarehouseId?._id || order.destinationWarehouseId
      )?.toString();
      return (
        (orderWarehouseId && orderWarehouseId === userWarehouseId) ||
        (orderDestWarehouseId && orderDestWarehouseId === userWarehouseId)
      );
    });
    if (!isAllAccessible) {
      throw new ApiError(403, WAREHOUSE_MESSAGES.ACCESS_DENIED);
    }
  }

  const codOrders = [];
  let expectedRemittanceAmount = 0;

  for (const orderDoc of orderDocs) {
    if (orderDoc.status !== ORDER_STATUSES.DELIVERED) {
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
    const remittedSoFar = Number(orderDoc.codRemittedAmount || 0);
    if (remittedSoFar >= expectedCod) {
      throw new ApiError(400, PAYMENT_MESSAGES.COD_ALREADY_REMITTED);
    }

    const availableToRemit = expectedCod - remittedSoFar;
    expectedRemittanceAmount += availableToRemit;
    codOrders.push({
      orderId: orderDoc._id,
      expectedCod,
      collectedAmount: 0,
      remittedAmount: availableToRemit,
      shortfallAmount: 0,
    });
  }

  if (Number(paymentAmount) !== expectedRemittanceAmount) {
    throw new ApiError(
      400,
      PAYMENT_MESSAGES.REMITTANCE_AMOUNT_MISMATCH(expectedRemittanceAmount),
    );
  }

  const pendingRemittance =
    await paymentRepository.findPendingRemittanceByOrderIds(uniqueOrderIds);
  if (pendingRemittance) {
    throw new ApiError(
      409,
      PAYMENT_MESSAGES.PENDING_REMITTANCE_EXISTS(pendingRemittance.paymentCode),
    );
  }

  const discrepancyAmount = 0;

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

const verify = async (paymentId, payload, verifierUser) => {
  const { status, notes = "" } = payload;

  const payment = await paymentRepository.findById(paymentId);
  if (!payment) {
    throw new ApiError(404, PAYMENT_MESSAGES.NOT_FOUND);
  }
  if (payment.paymentStatus !== PAYMENT_STATUSES.PENDING) {
    throw new ApiError(400, PAYMENT_MESSAGES.ALREADY_VERIFIED);
  }

  if (status === PAYMENT_STATUSES.FAILED) {
    if (payment.invoiceAmountReserved) {
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const updatedPayment = await paymentRepository.updateById(
          paymentId,
          {
            paymentStatus: PAYMENT_STATUSES.FAILED,
            invoiceAmountReserved: false,
            handledBy: verifierUser.userId,
            notes: payment.notes
              ? `${payment.notes} | Từ chối: ${notes}`
              : `Từ chối: ${notes}`,
          },
          session,
          {
            paymentStatus: PAYMENT_STATUSES.PENDING,
            invoiceAmountReserved: true,
          },
        );
        if (!updatedPayment) {
          throw new ApiError(409, PAYMENT_MESSAGES.ALREADY_VERIFIED);
        }

        const invoiceId = payment.invoiceId?._id || payment.invoiceId;
        const releasedInvoice = await invoiceService.releasePendingPayment(
          invoiceId,
          payment.paymentAmount,
          session,
        );
        if (!releasedInvoice) {
          throw new ApiError(409, PAYMENT_MESSAGES.ALREADY_VERIFIED);
        }

        await session.commitTransaction();
        return updatedPayment;
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    }

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
        invoiceAmountReserved: false,
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
        releaseInvoiceReservation: Boolean(payment.invoiceAmountReserved),
      });
    }

    if (
      payment.payerType === PAYER_TYPES.DRIVER ||
      (payment.codOrders && payment.codOrders.length > 0)
    ) {
      const orderIdsToUpdate = (payment.codOrders || [])
        .map((item) => (item.orderId?._id || item.orderId)?.toString())
        .filter(Boolean);

      if (payment.orderId) {
        const singleOid = (payment.orderId?._id || payment.orderId)?.toString();
        if (singleOid && !orderIdsToUpdate.includes(singleOid)) {
          orderIdsToUpdate.push(singleOid);
        }
      }

      if (orderIdsToUpdate.length > 0) {
        const orders = await orderService.getOrdersForRemittance(
          orderIdsToUpdate,
          session,
        );
        const orderMap = new Map(orders.map((o) => [o._id.toString(), o]));
        const bulkOps = [];

        for (const codOrder of payment.codOrders || []) {
          const oid = (codOrder.orderId?._id || codOrder.orderId)?.toString();
          const order = orderMap.get(oid);
          if (!order) {
            throw new ApiError(404, ORDER_MESSAGES.NOT_FOUND);
          }

          if (order.status !== ORDER_STATUSES.DELIVERED) {
            throw new ApiError(409, PAYMENT_MESSAGES.ORDER_NOT_DELIVERED);
          }

          const codAmount = Number(order.codAmount || 0);
          const collectedBefore = Number(order.codCollectedAmount || 0);
          const remittedBefore = Number(order.codRemittedAmount || 0);
          const collectedAfter =
            collectedBefore + Number(codOrder.collectedAmount || 0);
          const remittedAfter =
            remittedBefore + Number(codOrder.remittedAmount || 0);

          if (collectedAfter > codAmount || remittedAfter > collectedAfter) {
            throw new ApiError(409, PAYMENT_MESSAGES.COD_AMOUNT_CHANGED);
          }

          const isCodCollected = collectedAfter >= codAmount;
          const updateSet = {
            codCollectedAmount: collectedAfter,
            codRemittedAmount: remittedAfter,
            codCollected: isCodCollected,
          };

          bulkOps.push({
            updateOne: {
              filter: {
                _id: order._id,
                codSettled: { $ne: true },
                codCollectedAmount:
                  order.codCollectedAmount == null
                    ? { $in: [null, 0] }
                    : collectedBefore,
                codRemittedAmount:
                  order.codRemittedAmount == null
                    ? { $in: [null, 0] }
                    : remittedBefore,
              },
              update: { $set: updateSet },
            },
          });
        }

        if (bulkOps.length > 0) {
          const result = await orderService.bulkUpdateOrders(bulkOps, session);
          if (result.matchedCount !== bulkOps.length) {
            throw new ApiError(409, PAYMENT_MESSAGES.COD_AMOUNT_CHANGED);
          }
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

const refund = async (paymentId, payload, actor) => {
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

        const targetOrderIds = invoiceService.getInvoiceOrderIds(invoice);
        if (targetOrderIds.length > 1) {
          await orderService.applyInvoicePayment({
            orderIds: targetOrderIds,
            paidAmount: newPaidAmount,
            paymentTime: new Date(),
            session,
          });
        } else if (targetOrderIds.length === 1) {
          const targetOrderId = targetOrderIds[0];
          const order = await orderService.getById(targetOrderId);
          const shippingFee = Number(order.shippingFee || 0);
          const shippingFeePaidAmount = Math.min(
            shippingFee,
            Math.max(0, newPaidAmount),
          );

          await orderService.updateById({
            orderId: targetOrderId,
            updateData: {
              paymentStatus: PAYMENT_STATUSES.PENDING,
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
          paymentStatus: PAYMENT_STATUSES.PENDING,
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

      // Spending totals are recognized at delivery, so only reverse them when
      // the refunded payment belongs to a delivered order (or to a legacy
      // payment that is not linked to an order).
      let paymentOrder = null;
      if (payment.orderId) {
        paymentOrder = await orderService.getById(
          payment.orderId?._id || payment.orderId,
          true,
          null,
          session,
        );
      }
      const shouldReverseSpending =
        !paymentOrder || paymentOrder.status === ORDER_STATUSES.DELIVERED;

      let spentToReverse = 0;
      if (shouldReverseSpending) {
        const currentSpent = Math.max(0, Number(customer.totalSpent || 0));
        spentToReverse = Math.min(currentSpent, effectiveRefundAmount);
      }

      const customerUpdate = {
        $inc: {},
      };
      if (spentToReverse > 0) {
        customerUpdate.$inc.totalSpent = -spentToReverse;
      }

      const occConditions = {};
      if (spentToReverse > 0) {
        occConditions.totalSpent = { $gte: spentToReverse };
      }

      if (payment.paymentMethod === PAYMENT_METHODS.WALLET_BALANCE) {
        const balanceBefore = Number(customer.walletBalance || 0);
        const balanceAfter = balanceBefore + effectiveRefundAmount;
        customerUpdate.$inc.walletBalance = effectiveRefundAmount;

        const updatedCustomer = await customerService.updateById(
          customerId,
          customerUpdate,
          session,
          occConditions,
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
      } else if (Object.keys(customerUpdate.$inc).length > 0) {
        const updatedCustomer = await customerService.updateById(
          customerId,
          customerUpdate,
          session,
          occConditions,
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
  verify,
  refund,
  getAll,
  getById,
  getByCode,
  getStats,
};
