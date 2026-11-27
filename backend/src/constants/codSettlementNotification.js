import { PAYOUT_METHODS } from "./payoutMethods";

export const COD_SETTLEMENT_NOTIFICATION_EVENTS = {
  CONFIRMED: "COD_SETTLEMENT_CONFIRMED",
  COMPLETED: "COD_SETTLEMENT_COMPLETED",
  CANCELLED: "COD_SETTLEMENT_CANCELLED",
};

const formatAmount = (amount) => Number(amount || 0).toLocaleString("vi-VN");

const getOrderLabel = (settlement) =>
  settlement?.orderId?.orderCode || settlement?.orderId || "";

const getPayoutLabel = (settlement) =>
  settlement?.payoutMethod === PAYOUT_METHODS.BANK_TRANSFER
    ? "chuyển khoản"
    : "ví";

export const COD_SETTLEMENT_NOTIFICATION_TEMPLATES = {
  [COD_SETTLEMENT_NOTIFICATION_EVENTS.CONFIRMED]: {
    title: "Khoản COD đã được xác nhận",
    message: ({ settlement }) =>
      `Khoản COD ${formatAmount(settlement.netPayoutAmount)} cho đơn ${getOrderLabel(settlement)} đã được xác nhận và đang chờ chi trả.`,
  },

  [COD_SETTLEMENT_NOTIFICATION_EVENTS.COMPLETED]: {
    title: "Khoản COD đã được chi trả",
    message: ({ settlement }) =>
      `Khoản COD ${formatAmount(settlement.netPayoutAmount)} cho đơn ${getOrderLabel(settlement)} đã được chi trả qua ${getPayoutLabel(settlement)}.`,
  },

  [COD_SETTLEMENT_NOTIFICATION_EVENTS.CANCELLED]: {
    title: "Khoản COD đã bị hủy",
    message: ({ settlement, notes } = {}) =>
      `Khoản COD cho đơn ${getOrderLabel(settlement)} đã bị hủy.` +
      (notes ? ` Lý do: ${notes}` : ""),
  },
};
