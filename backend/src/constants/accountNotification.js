export const ACCOUNT_NOTIFICATION_EVENTS = {
  ACCOUNT_ROLE_CHANGED: "ACCOUNT_ROLE_CHANGED",
};

const ROLE_LABELS = {
  admin: "Quản trị viên",
  customer: "Khách hàng",
  driver: "Tài xế",
  dispatcher: "Điều phối viên",
  accountant: "Kế toán",
  warehouse_staff: "Nhân viên kho",
};

const getRoleLabel = (role) => ROLE_LABELS[role] || role || "";

export const ACCOUNT_NOTIFICATION_TEMPLATES = {
  [ACCOUNT_NOTIFICATION_EVENTS.ACCOUNT_ROLE_CHANGED]: {
    title: "Vai trò tài khoản đã thay đổi",
    message: ({ previousRole, role }) =>
      `Vai trò tài khoản của bạn đã được thay đổi từ ${getRoleLabel(previousRole)} sang ${getRoleLabel(role)}.`,
  },
};
