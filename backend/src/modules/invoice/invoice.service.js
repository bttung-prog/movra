import logger from "../../configs/logger.js";

import { INVOICE_STATUSES } from "../../constants/invoiceStatuses.js";
import { PAYMENT_TERMS } from "../../constants/paymentTerms.js";
import { ROLES } from "../../constants/roles.js";
import { DEFAULT_VAT_RATE } from "../../constants/vat.js";
import { ORDER_STATUSES } from "../../constants/orderStatuses.js";
import { INVOICE_MESSAGES, ORDER_MESSAGES } from "../../constants/messages.js";

import { ApiError } from "../../utils/ApiError.js";
import { generateCode } from "../../utils/generateCode.js";

import orderService from "../order/order.service.js";
import customerService from "../customer/customer.service.js";
import notificationService from "../notification/notification.service.js";

import invoiceRepository from "./invoice.repository.js";

const calculateDueDate = (paymentTerms) => {
  const date = new Date();
  switch (paymentTerms) {
    case PAYMENT_TERMS.NET_15:
      date.setDate(date.getDate() + 15);
      break;
    case PAYMENT_TERMS.NET_30:
      date.setDate(date.getDate() + 30);
      break;
    case PAYMENT_TERMS.IMMEDIATE:
    default:
      date.setDate(date.getDate() + 3);
      break;
  }
  return date;
};

const validateInvoiceItems = (items) => {
  return items.map((item) => {
    const amount = item.quantity * item.unitPrice;
    if (!Number.isSafeInteger(amount) || item.amount !== amount) {
      throw new ApiError(400, INVOICE_MESSAGES.ITEM_AMOUNT_MISMATCH);
    }
    return { ...item, amount };
  });
};

const sumInvoiceItems = (items) => {
  const subTotal = items.reduce((total, item) => total + item.amount, 0);
  if (!Number.isSafeInteger(subTotal)) {
    throw new ApiError(400, INVOICE_MESSAGES.AMOUNT_OUT_OF_RANGE);
  }
  return subTotal;
};

const getInvoiceOrderIds = (invoice) => {
  const orderIds = [];
  const seen = new Set();

  const addOrderId = (value) => {
    const id = value?._id || value;
    if (!id) return;

    const key = String(id);
    if (seen.has(key)) return;

    seen.add(key);
    orderIds.push(id);
  };

  for (const id of invoice?.orderIds || []) {
    addOrderId(id);
  }

  return orderIds;
};

const create = async (payload, session = null, actor = null) => {
  const {
    orderId,
    orderIds: inputOrderIds,
    billingPeriod,
    customerId,
    subTotal: inputSubTotal,
    tax: inputTax,
    vatRate: inputVatRate,
    discount = 0,
    dueDate: inputDueDate,
    paymentTerms = PAYMENT_TERMS.IMMEDIATE,
    items: inputItems,
    notes = "",
    issuedBy = null,
  } = payload;

  let finalCustomerId = customerId;
  let finalItems = inputItems || [];
  let targetOrders = [];

  if (orderId) {
    targetOrders = [await orderService.getById(orderId, true, actor)];
  } else if (inputOrderIds?.length > 0) {
    targetOrders = await orderService.getByIds(inputOrderIds);
    if (targetOrders.length !== new Set(inputOrderIds.map(String)).size) {
      throw new ApiError(400, ORDER_MESSAGES.ORDERS_NOT_FOUND);
    }
  } else if (billingPeriod) {
    if (!customerId) {
      throw new ApiError(400, INVOICE_MESSAGES.CUSTOMER_REQUIRED);
    }

    const activeOrderIds = await getActiveOrderIdsByCustomer(customerId);
    targetOrders = await orderService.getBillableOrdersForInvoice({
      customerId,
      fromDate: billingPeriod.fromDate,
      toDate: billingPeriod.toDate,
      excludeOrderIds: activeOrderIds,
    });

    if (targetOrders.length === 0) {
      throw new ApiError(400, INVOICE_MESSAGES.NO_ELIGIBLE_ORDERS);
    }
  }

  const finalOrderIds = [];
  const seenOrderIds = new Set();

  for (const order of targetOrders) {
    if (order.deletedAt) {
      throw new ApiError(400, ORDER_MESSAGES.ALREADY_DELETED);
    }

    if (order.status === ORDER_STATUSES.CANCELLED) {
      throw new ApiError(400, ORDER_MESSAGES.CANCELLED_ORDER_CANNOT_BE_BILLED);
    }

    if (order.shippingFeePaid) {
      throw new ApiError(400, ORDER_MESSAGES.SHIPPING_FEE_ALREADY_PAID);
    }

    const orderCustomerId = order.customerId?._id || order.customerId;
    if (!finalCustomerId) {
      finalCustomerId = orderCustomerId;
    }
    if (
      finalCustomerId &&
      orderCustomerId &&
      finalCustomerId.toString() !== orderCustomerId.toString()
    ) {
      throw new ApiError(400, INVOICE_MESSAGES.CUSTOMER_ORDER_MISMATCH);
    }

    const key = String(order._id);
    if (!seenOrderIds.has(key)) {
      seenOrderIds.add(key);
      finalOrderIds.push(order._id);
    }
  }

  if (finalOrderIds.length > 0) {
    const existingInvoice =
      await invoiceRepository.findActiveByOrderIds(finalOrderIds);
    if (existingInvoice) {
      throw new ApiError(400, INVOICE_MESSAGES.ALREADY_EXISTS);
    }

    if (finalItems.length === 0) {
      finalItems = targetOrders.map((order) => {
        const shippingFee = Number(order.shippingFee || 0);
        return {
          description: `Cước vận chuyển cho đơn hàng ${order.orderCode}`,
          quantity: 1,
          unitPrice: shippingFee,
          amount: shippingFee,
        };
      });
    }
  }

  if (!finalCustomerId) {
    throw new ApiError(400, INVOICE_MESSAGES.CUSTOMER_REQUIRED);
  }

  const customer = await customerService.getById(finalCustomerId);

  let finalSubTotal = inputSubTotal;
  if (finalItems.length > 0) {
    finalItems = validateInvoiceItems(finalItems);
    const itemsSubTotal = sumInvoiceItems(finalItems);
    if (
      inputSubTotal !== undefined &&
      inputSubTotal !== null &&
      inputSubTotal !== itemsSubTotal
    ) {
      throw new ApiError(400, INVOICE_MESSAGES.SUBTOTAL_ITEMS_MISMATCH);
    }
    finalSubTotal = itemsSubTotal;
  } else if (
    finalSubTotal === undefined ||
    finalSubTotal === null ||
    finalSubTotal < 0
  ) {
    finalSubTotal = 0;
  }

  const vatRate =
    inputVatRate === undefined ? DEFAULT_VAT_RATE : Number(inputVatRate);
  const tax =
    inputTax === undefined
      ? Math.round((finalSubTotal * vatRate) / 100)
      : inputTax;

  if (discount > finalSubTotal + tax) {
    throw new ApiError(400, INVOICE_MESSAGES.DISCOUNT_EXCEEDS_TOTAL);
  }

  const totalAmount = finalSubTotal + tax - discount;
  if (!Number.isSafeInteger(totalAmount)) {
    throw new ApiError(400, INVOICE_MESSAGES.AMOUNT_OUT_OF_RANGE);
  }
  const dueDate = inputDueDate || calculateDueDate(paymentTerms);
  const invoiceCode = generateCode("INV");

  const invoiceData = {
    invoiceCode,
    customerId: finalCustomerId,
    orderIds: finalOrderIds,
    billingPeriod: billingPeriod || undefined,
    companyName: customer.companyName || null,
    taxCode: customer.taxCode || null,
    companyAddress: customer.companyAddress || null,
    items: finalItems,
    subTotal: finalSubTotal,
    tax,
    vatRate,
    discount,
    totalAmount,
    paidAmount: 0,
    remainingAmount: totalAmount,
    status: INVOICE_STATUSES.DRAFT,
    paymentTerms,
    dueDate,
    issuedBy,
    notes,
  };

  try {
    return await invoiceRepository.create(invoiceData, session);
  } catch (error) {
    if (
      error.code === 11000 &&
      (error.keyPattern?.orderIds || error.keyPattern?.orderId)
    ) {
      throw new ApiError(409, INVOICE_MESSAGES.ALREADY_EXISTS);
    }
    throw error;
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

  const queryFilter = filter;

  const [invoices, total] = await Promise.all([
    invoiceRepository.findAll({
      filter: queryFilter,
      skip,
      limit: limitNumber,
      sort,
    }),
    invoiceRepository.countAll({ filter: queryFilter }),
  ]);

  return {
    data: invoices,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages: Math.ceil(total / limitNumber),
    },
  };
};

const getById = async (invoiceId, actor = null, session = null) => {
  const invoice = await invoiceRepository.findById(invoiceId, session);
  if (!invoice) {
    throw new ApiError(404, INVOICE_MESSAGES.NOT_FOUND);
  }

  if (actor?.role === ROLES.CUSTOMER) {
    const invoiceCustomerId =
      invoice.customerId?._id?.toString() || invoice.customerId?.toString();
    if (
      invoiceCustomerId &&
      actor.customerId &&
      invoiceCustomerId !== actor.customerId.toString()
    ) {
      throw new ApiError(403, INVOICE_MESSAGES.ACCESS_DENIED);
    }
  }

  return invoice;
};

const getByCode = async (invoiceCode, actor = null) => {
  const invoice = await invoiceRepository.findByCode(invoiceCode);
  if (!invoice) {
    throw new ApiError(404, INVOICE_MESSAGES.NOT_FOUND);
  }

  if (actor?.role === ROLES.CUSTOMER) {
    const invoiceCustomerId =
      invoice.customerId?._id?.toString() || invoice.customerId?.toString();
    if (
      invoiceCustomerId &&
      actor.customerId &&
      invoiceCustomerId !== actor.customerId.toString()
    ) {
      throw new ApiError(403, INVOICE_MESSAGES.ACCESS_DENIED);
    }
  }

  return invoice;
};

const issueInvoice = async (invoiceId, issuedBy = null, session = null) => {
  const invoice = await invoiceRepository.findById(invoiceId, session);
  if (!invoice) {
    throw new ApiError(404, INVOICE_MESSAGES.NOT_FOUND);
  }

  if (invoice.status !== INVOICE_STATUSES.DRAFT) {
    throw new ApiError(
      400,
      INVOICE_MESSAGES.CANNOT_UPDATE_STATUS(invoice.status),
    );
  }

  const updatedInvoice = await invoiceRepository.updateById(
    invoiceId,
    {
      status: INVOICE_STATUSES.ISSUED,
      issueDate: new Date(),
      ...(issuedBy ? { issuedBy } : {}),
    },
    session,
    { status: INVOICE_STATUSES.DRAFT, updatedAt: invoice.updatedAt },
  );

  if (!updatedInvoice) {
    throw new ApiError(409, INVOICE_MESSAGES.STATE_CHANGED);
  }

  return updatedInvoice;
};

const reservePendingPayment = async (invoiceId, amount, session) => {
  const reservedInvoice = await invoiceRepository.updateById(
    invoiceId,
    { $inc: { pendingAmount: amount } },
    session,
    {
      status: {
        $in: [
          INVOICE_STATUSES.ISSUED,
          INVOICE_STATUSES.PARTIALLY_PAID,
          INVOICE_STATUSES.OVERDUE,
        ],
      },
      $expr: {
        $lte: [
          {
            $add: [{ $ifNull: ["$pendingAmount", 0] }, amount],
          },
          "$remainingAmount",
        ],
      },
    },
  );
  return reservedInvoice;
};

const releasePendingPayment = async (invoiceId, amount, session) => {
  return invoiceRepository.updateById(
    invoiceId,
    { $inc: { pendingAmount: -amount } },
    session,
    { pendingAmount: { $gte: amount } },
  );
};

const updateById = async (invoiceId, updateData, actor = null) => {
  const invoice = await invoiceRepository.findById(invoiceId);
  if (!invoice) {
    throw new ApiError(404, INVOICE_MESSAGES.NOT_FOUND);
  }

  if (invoice.status !== INVOICE_STATUSES.DRAFT) {
    throw new ApiError(
      400,
      INVOICE_MESSAGES.CANNOT_UPDATE_STATUS(invoice.status),
    );
  }

  const subTotal =
    updateData.subTotal !== undefined ? updateData.subTotal : invoice.subTotal;
  const discount =
    updateData.discount !== undefined ? updateData.discount : invoice.discount;
  let items = updateData.items;
  let finalSubTotal = subTotal;

  if (items?.length > 0) {
    items = validateInvoiceItems(items);
    const itemsSubTotal = sumInvoiceItems(items);
    if (
      updateData.subTotal !== undefined &&
      updateData.subTotal !== itemsSubTotal
    ) {
      throw new ApiError(400, INVOICE_MESSAGES.SUBTOTAL_ITEMS_MISMATCH);
    }
    if (updateData.subTotal === undefined) {
      finalSubTotal = itemsSubTotal;
    }
  }

  const vatRate =
    updateData.vatRate !== undefined
      ? Number(updateData.vatRate)
      : Number(invoice.vatRate || 0);

  const tax =
    updateData.tax !== undefined
      ? updateData.tax
      : updateData.vatRate !== undefined
        ? Math.round((finalSubTotal * vatRate) / 100)
        : (invoice.tax ?? 0);

  if (discount > finalSubTotal + tax) {
    throw new ApiError(400, INVOICE_MESSAGES.DISCOUNT_EXCEEDS_TOTAL);
  }

  const totalAmount = finalSubTotal + tax - discount;
  if (!Number.isSafeInteger(totalAmount)) {
    throw new ApiError(400, INVOICE_MESSAGES.AMOUNT_OUT_OF_RANGE);
  }
  const remainingAmount = Math.max(0, totalAmount - (invoice.paidAmount || 0));

  const updatedInvoice = await invoiceRepository.updateById(
    invoiceId,
    {
      ...updateData,
      ...(items ? { items } : {}),
      ...(updateData.vatRate !== undefined ? { vatRate } : {}),
      subTotal: finalSubTotal,
      tax,
      discount,
      totalAmount,
      remainingAmount,
    },
    null,
    { status: INVOICE_STATUSES.DRAFT, updatedAt: invoice.updatedAt },
  );
  if (!updatedInvoice) {
    throw new ApiError(409, INVOICE_MESSAGES.STATE_CHANGED);
  }
  return updatedInvoice;
};

const cancelInvoice = async (invoiceId, reason) => {
  const invoice = await invoiceRepository.findById(invoiceId);
  if (!invoice) {
    throw new ApiError(404, INVOICE_MESSAGES.NOT_FOUND);
  }

  if (
    invoice.status === INVOICE_STATUSES.PAID ||
    invoice.status === INVOICE_STATUSES.PARTIALLY_PAID ||
    invoice.paidAmount > 0
  ) {
    throw new ApiError(
      400,
      INVOICE_MESSAGES.CANNOT_CANCEL_PAID(invoice.paidAmount),
    );
  }

  if (invoice.pendingAmount > 0) {
    throw new ApiError(400, INVOICE_MESSAGES.CANNOT_CANCEL_PENDING);
  }

  if (invoice.status === INVOICE_STATUSES.CANCELLED) {
    throw new ApiError(
      400,
      INVOICE_MESSAGES.CANNOT_CANCEL_STATUS(invoice.status),
    );
  }

  const notes = invoice.notes
    ? `${invoice.notes} | Lý do hủy: ${reason}`
    : `Lý do hủy: ${reason}`;

  const updatedInvoice = await invoiceRepository.updateById(
    invoiceId,
    {
      status: INVOICE_STATUSES.CANCELLED,
      notes,
    },
    null,
    {
      status: {
        $in: [
          INVOICE_STATUSES.DRAFT,
          INVOICE_STATUSES.ISSUED,
          INVOICE_STATUSES.OVERDUE,
        ],
      },
      paidAmount: { $in: [0, null] },
      updatedAt: invoice.updatedAt,
    },
  );
  if (!updatedInvoice) {
    throw new ApiError(409, INVOICE_MESSAGES.STATE_CHANGED);
  }
  return updatedInvoice;
};

const getStats = async (filter = {}) => {
  return invoiceRepository.getStats(filter);
};

const getByOrderId = async (orderId) => {
  return invoiceRepository.findByOrderId(orderId);
};

const getActiveOrderIdsByCustomer = async (customerId) => {
  const invoices =
    await invoiceRepository.findActiveOrderLinksByCustomer(customerId);

  const orderIds = [];
  const seen = new Set();

  for (const invoice of invoices) {
    for (const orderId of getInvoiceOrderIds(invoice)) {
      const key = String(orderId);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      orderIds.push(orderId);
    }
  }

  return orderIds;
};

const sumOutstandingByCustomer = (customerId) => {
  return invoiceRepository.sumOutstandingByCustomer(customerId);
};

const updatePaymentProgress = async (
  invoiceId,
  updateData,
  session = null,
  conditions = {},
) => {
  return invoiceRepository.updateById(
    invoiceId,
    updateData,
    session,
    conditions,
  );
};

const processOverdueInvoices = async (cutoffDate = new Date()) => {
  const candidates = await invoiceRepository.findOverdueCandidates(cutoffDate);
  if (!candidates || candidates.length === 0) {
    return {
      scannedCount: 0,
      updatedCount: 0,
      invoices: [],
    };
  }

  const candidateIds = candidates.map((candidate) => candidate._id);
  const updateResult = await invoiceRepository.updateMany(
    {
      _id: { $in: candidateIds },
      status: {
        $in: [INVOICE_STATUSES.ISSUED, INVOICE_STATUSES.PARTIALLY_PAID],
      },
    },
    { $set: { status: INVOICE_STATUSES.OVERDUE } },
  );

  if (!updateResult || updateResult.modifiedCount === 0) {
    return {
      scannedCount: candidates.length,
      updatedCount: 0,
      invoices: [],
    };
  }

  const refreshedInvoices = await invoiceRepository.findByIds(candidateIds);
  const updatedInvoices = refreshedInvoices.filter(
    (invoice) => invoice.status === INVOICE_STATUSES.OVERDUE,
  );

  const notifications = updatedInvoices.flatMap((invoice) => {
    const targetUserId =
      invoice.customerId?.userId?._id || invoice.customerId?.userId;
    if (!targetUserId) {
      return [];
    }

    const formattedDueDate = invoice.dueDate
      ? new Date(invoice.dueDate).toLocaleDateString("vi-VN")
      : "";
    const formattedAmount = Number(invoice.remainingAmount || 0).toLocaleString(
      "vi-VN",
    );
    const orderIds = getInvoiceOrderIds(invoice);

    return [
      {
        userId: targetUserId,
        title: "Hóa đơn quá hạn thanh toán",
        message: `Hóa đơn ${invoice.invoiceCode} đã quá hạn thanh toán vào ngày ${formattedDueDate}. Vui lòng thanh toán số tiền còn lại (${formattedAmount} VND).`,
        type: "PAYMENT",
        data: {
          invoiceId: invoice._id,
          invoiceCode: invoice.invoiceCode,
          orderId: orderIds[0] || null,
          orderIds,
        },
      },
    ];
  });

  if (notifications.length > 0) {
    try {
      await notificationService.createMany(notifications);
    } catch (notifError) {
      logger.error(
        `[OverdueJob] Lỗi gửi thông báo hóa đơn quá hạn: ${notifError.message}`,
      );
    }
  }

  return {
    scannedCount: candidates.length,
    updatedCount: updatedInvoices.length,
    invoices: updatedInvoices,
  };
};

export default {
  create,
  getAll,
  getById,
  getByCode,
  getByOrderId,
  getActiveOrderIdsByCustomer,
  sumOutstandingByCustomer,
  getInvoiceOrderIds,
  issueInvoice,
  reservePendingPayment,
  releasePendingPayment,
  updateById,
  updatePaymentProgress,
  cancelInvoice,
  getStats,
  processOverdueInvoices,
};
