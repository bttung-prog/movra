export const PAYMENT_NOTIFICATION_EVENTS = {
  PAYMENT_PENDING: "PAYMENT_PENDING",
  PAYMENT_COMPLETED: "PAYMENT_COMPLETED",
  PAYMENT_VERIFIED: "PAYMENT_VERIFIED",
  PAYMENT_REJECTED: "PAYMENT_REJECTED",
  REFUND_COMPLETED: "REFUND_COMPLETED",
  DRIVER_REMITTANCE_CREATED: "DRIVER_REMITTANCE_CREATED",
  DRIVER_REMITTANCE_VERIFIED: "DRIVER_REMITTANCE_VERIFIED",
  DRIVER_REMITTANCE_REJECTED: "DRIVER_REMITTANCE_REJECTED",
};

const formatAmount = (amount) => Number(amount || 0).toLocaleString("vi-VN");

export const PAYMENT_NOTIFICATION_TEMPLATES = {
  [PAYMENT_NOTIFICATION_EVENTS.PAYMENT_PENDING]: {
    title: "Thanh toán đang chờ xử lý",
    message: ({ payment }) =>
      `Thanh toán #${payment.paymentCode} với số tiền ${formatAmount(payment.paymentAmount)} đang chờ xác nhận.`,
  },

  [PAYMENT_NOTIFICATION_EVENTS.PAYMENT_COMPLETED]: {
    title: "Thanh toán thành công",
    message: ({ payment }) =>
      `Thanh toán #${payment.paymentCode} với số tiền ${formatAmount(payment.paymentAmount)} đã hoàn tất.`,
  },

  [PAYMENT_NOTIFICATION_EVENTS.PAYMENT_VERIFIED]: {
    title: "Thanh toán đã được xác nhận",
    message: ({ payment }) =>
      `Thanh toán #${payment.paymentCode} với số tiền ${formatAmount(payment.paymentAmount)} đã được xác nhận.`,
  },

  [PAYMENT_NOTIFICATION_EVENTS.PAYMENT_REJECTED]: {
    title: "Thanh toán bị từ chối",
    message: ({ payment, notes } = {}) =>
      `Thanh toán #${payment.paymentCode} đã bị từ chối.` +
      (notes ? ` Lý do: ${notes}` : ""),
  },

  [PAYMENT_NOTIFICATION_EVENTS.REFUND_COMPLETED]: {
    title: "Hoàn tiền thành công",
    message: ({ payment, refundAmount, notes } = {}) =>
      `Đã hoàn ${formatAmount(refundAmount)} cho thanh toán #${payment.paymentCode}.` +
      (notes ? ` Lý do: ${notes}` : ""),
  },

  [PAYMENT_NOTIFICATION_EVENTS.DRIVER_REMITTANCE_CREATED]: {
    title: "Có phiếu nộp tiền mới",
    message: ({ payment }) =>
      `Tài xế đã tạo phiếu nộp tiền #${payment.paymentCode} với số tiền ${formatAmount(payment.paymentAmount)}.`,
  },

  [PAYMENT_NOTIFICATION_EVENTS.DRIVER_REMITTANCE_VERIFIED]: {
    title: "Phiếu nộp tiền đã được duyệt",
    message: ({ payment }) =>
      `Phiếu nộp tiền #${payment.paymentCode} với số tiền ${formatAmount(payment.paymentAmount)} đã được duyệt.`,
  },

  [PAYMENT_NOTIFICATION_EVENTS.DRIVER_REMITTANCE_REJECTED]: {
    title: "Phiếu nộp tiền bị từ chối",
    message: ({ payment, notes } = {}) =>
      `Phiếu nộp tiền #${payment.paymentCode} đã bị từ chối.` +
      (notes ? ` Lý do: ${notes}` : ""),
  },
};
