export const INVOICE_NOTIFICATION_EVENTS = {
  INVOICE_ISSUED: "INVOICE_ISSUED",
  INVOICE_PARTIALLY_PAID: "INVOICE_PARTIALLY_PAID",
  INVOICE_PAID: "INVOICE_PAID",
  INVOICE_CANCELLED: "INVOICE_CANCELLED",
  INVOICE_OVERDUE: "INVOICE_OVERDUE",
};

const formatAmount = (amount) => Number(amount || 0).toLocaleString("vi-VN");

const formatDate = (date) =>
  date ? new Date(date).toLocaleDateString("vi-VN") : "";

export const INVOICE_NOTIFICATION_TEMPLATES = {
  [INVOICE_NOTIFICATION_EVENTS.INVOICE_ISSUED]: {
    title: "Hóa đơn đã được phát hành",
    message: ({ invoice }) =>
      `Hóa đơn ${invoice.invoiceCode} với số tiền ${formatAmount(invoice.totalAmount)} đã được phát hành. Hạn thanh toán: ${formatDate(invoice.dueDate)}.`,
  },

  [INVOICE_NOTIFICATION_EVENTS.INVOICE_PARTIALLY_PAID]: {
    title: "Hóa đơn đã được thanh toán một phần",
    message: ({ invoice }) =>
      `Hóa đơn ${invoice.invoiceCode} đã thanh toán ${formatAmount(invoice.paidAmount)}/${formatAmount(invoice.totalAmount)}. Số còn lại: ${formatAmount(invoice.remainingAmount)}.`,
  },

  [INVOICE_NOTIFICATION_EVENTS.INVOICE_PAID]: {
    title: "Hóa đơn đã được thanh toán đủ",
    message: ({ invoice }) =>
      `Hóa đơn ${invoice.invoiceCode} với số tiền ${formatAmount(invoice.totalAmount)} đã được thanh toán đủ.`,
  },

  [INVOICE_NOTIFICATION_EVENTS.INVOICE_CANCELLED]: {
    title: "Hóa đơn đã bị hủy",
    message: ({ invoice, notes } = {}) =>
      `Hóa đơn ${invoice.invoiceCode} đã bị hủy.` +
      (notes ? ` Lý do: ${notes}` : ""),
  },

  [INVOICE_NOTIFICATION_EVENTS.INVOICE_OVERDUE]: {
    title: "Hóa đơn quá hạn thanh toán",
    message: ({ invoice }) =>
      `Hóa đơn ${invoice.invoiceCode} đã quá hạn thanh toán vào ngày ${formatDate(invoice.dueDate)}. Vui lòng thanh toán số tiền còn lại (${formatAmount(invoice.remainingAmount)} VND).`,
  },
};
