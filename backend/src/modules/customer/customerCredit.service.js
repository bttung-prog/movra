import { PAYMENT_TERMS } from "../../constants/paymentTerms.js";
import { CUSTOMER_MESSAGES } from "../../constants/messages.js";

import { ApiError } from "../../utils/ApiError.js";

import invoiceService from "../invoice/invoice.service.js";
import orderRepository from "../order/order.repository.js";

const toNonNegativeNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
};

/**
 * Builds the customer's committed credit usage from an already-loaded
 * customer document. Callers must validate/pass a customer document
 * (for example via assertCreditAvailable or customerService.getById).
 */
const getCreditSnapshot = async (customer) => {
  const customerId = customer._id;
  const creditLimit = toNonNegativeNumber(customer.creditLimit);

  const activeInvoiceOrderIds =
    await invoiceService.getActiveOrderIdsByCustomer(customerId);

  const [invoicedDebt, unbilledCommitment] = await Promise.all([
    invoiceService.sumOutstandingByCustomer(customerId),
    orderRepository.sumUnbilledShippingFeeByCustomer(
      customerId,
      activeInvoiceOrderIds,
    ),
  ]);

  const normalizedInvoicedDebt = toNonNegativeNumber(invoicedDebt);
  const normalizedUnbilledCommitment = toNonNegativeNumber(unbilledCommitment);
  const totalDebt = normalizedInvoicedDebt + normalizedUnbilledCommitment;

  return {
    creditLimit,
    invoicedDebt: normalizedInvoicedDebt,
    unbilledCommitment: normalizedUnbilledCommitment,
    totalDebt,
    availableCredit: Math.max(0, creditLimit - totalDebt),
  };
};

const assertCreditAvailable = async ({
  customer,
  paymentTerms = PAYMENT_TERMS.IMMEDIATE,
  additionalAmount = 0,
} = {}) => {
  if (paymentTerms === PAYMENT_TERMS.IMMEDIATE) {
    return null;
  }

  const amount = toNonNegativeNumber(additionalAmount);
  if (amount === 0) {
    return null;
  }

  if (!customer?._id) {
    throw new ApiError(404, CUSTOMER_MESSAGES.NOT_FOUND);
  }

  if (toNonNegativeNumber(customer.creditLimit) === 0) {
    throw new ApiError(409, CUSTOMER_MESSAGES.CREDIT_LIMIT_NOT_APPROVED);
  }

  const snapshot = await getCreditSnapshot(customer);

  if (snapshot.totalDebt + amount > snapshot.creditLimit) {
    throw new ApiError(
      409,
      CUSTOMER_MESSAGES.CREDIT_LIMIT_EXCEEDED(snapshot.availableCredit, amount),
    );
  }

  return snapshot;
};

export default {
  getCreditSnapshot,
  assertCreditAvailable,
};
