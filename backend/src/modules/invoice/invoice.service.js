import INVOICE_STATUSES from "../../constants/invoiceStatuses.js";
import ROLES from "../../constants/roles.js";
import { INVOICE_MESSAGES, ORDER_MESSAGES } from "../../constants/messages.js";

import ApiError from "../../utils/ApiError.js";
import generateCode from "../../utils/generateCode.js";

import orderService from "../order/order.service.js";
import customerService from "../customer/customer.service.js";

import invoiceRepository from "./invoice.repository.js";

const calculateDueDate = (paymentTerms) => {
  const date = new Date();
  switch (paymentTerms) {
    case "net_15":
      date.setDate(date.getDate() + 15);
      break;
    case "net_30":
      date.setDate(date.getDate() + 30);
      break;
    case "immediate":
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

const assertValidMoney = (...amounts) => {
  if (
    amounts.some(
      (amount) =>
        amount !== undefined &&
        amount !== null &&
        (!Number.isSafeInteger(amount) || amount < 0),
    )
  ) {
    throw new ApiError(400, INVOICE_MESSAGES.AMOUNT_MUST_BE_INTEGER);
  }
};

const assertInvoiceWarehouseAccess = async (invoice, actor) => {
  if (actor?.role !== ROLES.DISPATCHER) return;

  const orderId = invoice.orderId?._id || invoice.orderId;
  if (!orderId) {
    throw new ApiError(403, INVOICE_MESSAGES.DISPATCHER_ORDER_LINK_REQUIRED);
  }
  await orderService.getById(orderId, true, actor);
};

const create = async (payload, session = null, actor = null) => {
  const {
    orderId,
    customerId,
    subTotal: inputSubTotal,
    tax = 0,
    discount = 0,
    dueDate: inputDueDate,
    paymentTerms = "immediate",
    items: inputItems,
    notes = "",
    issuedBy = null,
  } = payload;

  assertValidMoney(inputSubTotal, tax, discount);

  let finalCustomerId = customerId;
  let finalSubTotal = inputSubTotal;
  let finalItems = inputItems || [];
  let linkedOrder = null;

  if (orderId) {
    linkedOrder = await orderService.getById(orderId, true, actor);

    if (linkedOrder.status === "cancelled") {
      throw new ApiError(400, ORDER_MESSAGES.CANCELLED_ORDER_CANNOT_BE_BILLED);
    }

    if (linkedOrder.shippingFeePaid) {
      throw new ApiError(400, ORDER_MESSAGES.SHIPPING_FEE_ALREADY_PAID);
    }

    const existingInvoice = await invoiceRepository.findByOrderId(orderId);
    if (
      existingInvoice &&
      existingInvoice.status !== INVOICE_STATUSES.CANCELLED
    ) {
      throw new ApiError(400, INVOICE_MESSAGES.ALREADY_EXISTS);
    }

    if (!finalCustomerId && linkedOrder.customerId) {
      finalCustomerId = linkedOrder.customerId?._id || linkedOrder.customerId;
    }
    if (
      finalCustomerId &&
      linkedOrder.customerId &&
      finalCustomerId.toString() !==
        (linkedOrder.customerId?._id || linkedOrder.customerId).toString()
    ) {
      throw new ApiError(400, INVOICE_MESSAGES.CUSTOMER_ORDER_MISMATCH);
    }

    if (finalSubTotal === undefined || finalSubTotal === null) {
      finalSubTotal = linkedOrder.shippingFee;
    }

    if (finalItems.length === 0) {
      finalItems = [
        {
          description: `Cước vận chuyển cho đơn hàng ${linkedOrder.orderCode}`,
          quantity: 1,
          unitPrice: finalSubTotal,
          amount: finalSubTotal,
        },
      ];
    }
  }

  if (actor?.role === ROLES.DISPATCHER && !orderId) {
    throw new ApiError(403, INVOICE_MESSAGES.DISPATCHER_ORDER_REQUIRED);
  }

  if (!finalCustomerId) {
    throw new ApiError(400, INVOICE_MESSAGES.CUSTOMER_REQUIRED);
  }

  await customerService.getById(finalCustomerId);

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
  } else if (finalSubTotal === undefined || finalSubTotal < 0) {
    finalSubTotal = 0;
  }

  if (discount > finalSubTotal + tax) {
    throw new ApiError(400, INVOICE_MESSAGES.DISCOUNT_EXCEEDS_TOTAL);
  }

  const totalAmount = finalSubTotal + tax - discount;
  assertValidMoney(finalSubTotal, totalAmount);
  if (!Number.isSafeInteger(totalAmount)) {
    throw new ApiError(400, INVOICE_MESSAGES.AMOUNT_OUT_OF_RANGE);
  }
  const dueDate = inputDueDate || calculateDueDate(paymentTerms);
  const invoiceCode = generateCode("INV");

  const invoiceData = {
    invoiceCode,
    customerId: finalCustomerId,
    orderId: orderId || null,
    items: finalItems,
    subTotal: finalSubTotal,
    tax,
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
    if (error.code === 11000 && error.keyPattern?.orderId) {
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

  let queryFilter = filter;
  if (actor?.role === ROLES.DISPATCHER) {
    const orderIds = await orderService.getIdsByWarehouseId(actor.warehouseId);
    queryFilter = {
      $and: [filter, { orderId: { $in: orderIds } }],
    };
  }

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

const getById = async (id, actor = null) => {
  const invoice = await invoiceRepository.findById(id);
  if (!invoice) {
    throw new ApiError(404, INVOICE_MESSAGES.NOT_FOUND);
  }

  await assertInvoiceWarehouseAccess(invoice, actor);

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

  await assertInvoiceWarehouseAccess(invoice, actor);

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

const issueInvoice = async (id, issuedBy = null, actor = null) => {
  const invoice = await invoiceRepository.findById(id);
  if (!invoice) {
    throw new ApiError(404, INVOICE_MESSAGES.NOT_FOUND);
  }

  await assertInvoiceWarehouseAccess(invoice, actor);

  if (invoice.status !== INVOICE_STATUSES.DRAFT) {
    throw new ApiError(
      400,
      INVOICE_MESSAGES.CANNOT_UPDATE_STATUS(invoice.status),
    );
  }

  const updatedInvoice = await invoiceRepository.updateById(
    id,
    {
      status: INVOICE_STATUSES.ISSUED,
      issueDate: new Date(),
      ...(issuedBy ? { issuedBy } : {}),
    },
    null,
    { status: INVOICE_STATUSES.DRAFT, updatedAt: invoice.updatedAt },
  );

  if (!updatedInvoice) {
    throw new ApiError(409, INVOICE_MESSAGES.STATE_CHANGED);
  }

  return updatedInvoice;
};

const updateById = async (id, updateData, actor = null) => {
  const invoice = await invoiceRepository.findById(id);
  if (!invoice) {
    throw new ApiError(404, INVOICE_MESSAGES.NOT_FOUND);
  }
  await assertInvoiceWarehouseAccess(invoice, actor);

  if (invoice.status !== INVOICE_STATUSES.DRAFT) {
    throw new ApiError(
      400,
      INVOICE_MESSAGES.CANNOT_UPDATE_STATUS(invoice.status),
    );
  }

  const subTotal =
    updateData.subTotal !== undefined ? updateData.subTotal : invoice.subTotal;
  const tax = updateData.tax !== undefined ? updateData.tax : invoice.tax;
  const discount =
    updateData.discount !== undefined ? updateData.discount : invoice.discount;
  assertValidMoney(subTotal, tax, discount);
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

  if (discount > finalSubTotal + tax) {
    throw new ApiError(400, INVOICE_MESSAGES.DISCOUNT_EXCEEDS_TOTAL);
  }

  const totalAmount = finalSubTotal + tax - discount;
  assertValidMoney(finalSubTotal, totalAmount);
  if (!Number.isSafeInteger(totalAmount)) {
    throw new ApiError(400, INVOICE_MESSAGES.AMOUNT_OUT_OF_RANGE);
  }
  const remainingAmount = Math.max(0, totalAmount - (invoice.paidAmount || 0));

  const updatedInvoice = await invoiceRepository.updateById(
    id,
    {
      ...updateData,
      ...(items ? { items } : {}),
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

const cancelInvoice = async (id, reason, actor = null) => {
  const invoice = await invoiceRepository.findById(id);
  if (!invoice) {
    throw new ApiError(404, INVOICE_MESSAGES.NOT_FOUND);
  }
  await assertInvoiceWarehouseAccess(invoice, actor);

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
    id,
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

const getStats = async (filter = {}, actor = null) => {
  if (actor?.role === ROLES.DISPATCHER) {
    const orderIds = await orderService.getIdsByWarehouseId(actor.warehouseId);
    filter = { $and: [filter, { orderId: { $in: orderIds } }] };
  }
  return invoiceRepository.getStats(filter);
};

const getByOrderId = async (orderId, actor = null) => {
  const invoice = await invoiceRepository.findByOrderId(orderId);
  if (invoice) {
    await assertInvoiceWarehouseAccess(invoice, actor);
  }
  return invoice;
};

const getIdsByWarehouseId = async (warehouseId) => {
  const orderIds = await orderService.getIdsByWarehouseId(warehouseId);
  return invoiceRepository.findIdsByOrderIds(orderIds);
};

const updatePaymentProgress = async (
  id,
  updateData,
  session = null,
  conditions = {},
) => {
  return invoiceRepository.updateById(id, updateData, session, conditions);
};

export default {
  create,
  getAll,
  getById,
  getByCode,
  getByOrderId,
  getIdsByWarehouseId,
  issueInvoice,
  updateById,
  updatePaymentProgress,
  cancelInvoice,
  getStats,
};
