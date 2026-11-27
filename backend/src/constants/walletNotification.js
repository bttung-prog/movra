import { WALLET_TRANSACTION_DIRECTIONS } from "./walletTransactionTypes";

export const WALLET_NOTIFICATION_EVENTS = {
  WALLET_TOPUP_PENDING: "WALLET_TOPUP_PENDING",
  WALLET_TOPUP_COMPLETED: "WALLET_TOPUP_COMPLETED",
  WALLET_TOPUP_REJECTED: "WALLET_TOPUP_REJECTED",
  WALLET_ADJUSTED: "WALLET_ADJUSTED",
  WALLET_TOPUP_REFUNDED: "WALLET_TOPUP_REFUNDED",
};

const formatAmount = (amount) => Number(amount || 0).toLocaleString("vi-VN");

const getPaymentCode = ({ payment, walletTransaction }) =>
  payment?.paymentCode || walletTransaction?.transactionCode || "";

const getDirectionLabel = (direction) =>
  direction === WALLET_TRANSACTION_DIRECTIONS.DEBIT ? "giảm" : "tăng";

export const WALLET_NOTIFICATION_TEMPLATES = {
  [WALLET_NOTIFICATION_EVENTS.WALLET_TOPUP_PENDING]: {
    title: "Yêu cầu nạp ví đang chờ xác nhận",
    message: ({ payment }) =>
      `Yêu cầu nạp ví #${payment?.paymentCode || ""} với số tiền ${formatAmount(payment?.paymentAmount)} đang chờ xác nhận.`,
  },

  [WALLET_NOTIFICATION_EVENTS.WALLET_TOPUP_COMPLETED]: {
    title: "Nạp ví thành công",
    message: ({ payment, balanceAfter }) =>
      `Đã cộng ${formatAmount(payment?.paymentAmount)} vào ví từ giao dịch #${payment?.paymentCode || ""}. Số dư hiện tại: ${formatAmount(balanceAfter)}.`,
  },

  [WALLET_NOTIFICATION_EVENTS.WALLET_TOPUP_REJECTED]: {
    title: "Yêu cầu nạp ví bị từ chối",
    message: ({ payment, notes } = {}) =>
      `Yêu cầu nạp ví #${payment?.paymentCode || ""} đã bị từ chối.` +
      (notes ? ` Lý do: ${notes}` : ""),
  },

  [WALLET_NOTIFICATION_EVENTS.WALLET_ADJUSTED]: {
    title: "Ví đã được điều chỉnh",
    message: ({ amount, direction, balanceAfter }) =>
      `Ví của bạn đã được điều chỉnh ${getDirectionLabel(direction)} ${formatAmount(amount)}. Số dư hiện tại: ${formatAmount(balanceAfter)}.`,
  },

  [WALLET_NOTIFICATION_EVENTS.WALLET_TOPUP_REFUNDED]: {
    title: "Khoản nạp ví đã bị thu hồi",
    message: ({ payment, walletTransaction, amount, balanceAfter }) =>
      `Khoản nạp ví #${getPaymentCode({ payment, walletTransaction })} đã bị thu hồi ${formatAmount(amount)}. Số dư hiện tại: ${formatAmount(balanceAfter)}.`,
  },
};
