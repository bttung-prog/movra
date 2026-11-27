export const WAREHOUSE_NOTIFICATION_EVENTS = {
  WAREHOUSE_ISSUE_CREATED: "WAREHOUSE_ISSUE_CREATED",
  WAREHOUSE_ISSUE_CANCELLED: "WAREHOUSE_ISSUE_CANCELLED",
  WAREHOUSE_RECEIPT_CREATED: "WAREHOUSE_RECEIPT_CREATED",
  WAREHOUSE_RECEIPT_CANCELLED: "WAREHOUSE_RECEIPT_CANCELLED",
  WAREHOUSE_RECEIPT_CONDITION_UPDATED: "WAREHOUSE_RECEIPT_CONDITION_UPDATED",
};

const getOrderCode = (order, record) =>
  order?.orderCode || record?.orderId?.orderCode || "";

const getWarehouseName = (warehouse, record) =>
  warehouse?.warehouseName || record?.warehouseId?.warehouseName || "kho";

const formatCondition = (condition) => {
  if (condition === "damaged") return "hàng hỏng";
  return "hàng tốt";
};

export const WAREHOUSE_NOTIFICATION_TEMPLATES = {
  [WAREHOUSE_NOTIFICATION_EVENTS.WAREHOUSE_ISSUE_CREATED]: {
    title: "Phiếu xuất kho mới",
    message: ({ issue, order, warehouse }) =>
      `Phiếu xuất kho ${issue?.issueCode || ""} đã được tạo cho đơn hàng #${getOrderCode(order, issue)} tại ${getWarehouseName(warehouse, issue)}.`,
  },

  [WAREHOUSE_NOTIFICATION_EVENTS.WAREHOUSE_ISSUE_CANCELLED]: {
    title: "Phiếu xuất kho đã bị hủy",
    message: ({ issue, order, warehouse, notes } = {}) =>
      `Phiếu xuất kho ${issue?.issueCode || ""} của đơn hàng #${getOrderCode(order, issue)} tại ${getWarehouseName(warehouse, issue)} đã bị hủy.` +
      (notes ? ` Ghi chú: ${notes}` : ""),
  },

  [WAREHOUSE_NOTIFICATION_EVENTS.WAREHOUSE_RECEIPT_CREATED]: {
    title: "Phiếu nhập kho mới",
    message: ({ receipt, order, warehouse }) =>
      `Phiếu nhập kho ${receipt?.receiptCode || ""} đã được tạo cho đơn hàng #${getOrderCode(order, receipt)} tại ${getWarehouseName(warehouse, receipt)}.`,
  },

  [WAREHOUSE_NOTIFICATION_EVENTS.WAREHOUSE_RECEIPT_CANCELLED]: {
    title: "Phiếu nhập kho đã bị hủy",
    message: ({ receipt, order, warehouse, notes } = {}) =>
      `Phiếu nhập kho ${receipt?.receiptCode || ""} của đơn hàng #${getOrderCode(order, receipt)} tại ${getWarehouseName(warehouse, receipt)} đã bị hủy.` +
      (notes ? ` Ghi chú: ${notes}` : ""),
  },

  [WAREHOUSE_NOTIFICATION_EVENTS.WAREHOUSE_RECEIPT_CONDITION_UPDATED]: {
    title: "Tình trạng hàng nhập kho đã thay đổi",
    message: ({
      receipt,
      order,
      warehouse,
      previousCondition,
      condition,
      notes,
    }) =>
      `Phiếu nhập kho ${receipt?.receiptCode || ""} của đơn hàng #${getOrderCode(order, receipt)} tại ${getWarehouseName(warehouse, receipt)} đã đổi tình trạng từ ${formatCondition(previousCondition)} sang ${formatCondition(condition)}.` +
      (notes ? ` Ghi chú: ${notes}` : ""),
  },
};
