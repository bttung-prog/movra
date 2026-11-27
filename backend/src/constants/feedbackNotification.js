export const FEEDBACK_NOTIFICATION_EVENTS = {
  FEEDBACK_CREATED: "FEEDBACK_CREATED",
  FEEDBACK_LOW_RATING: "FEEDBACK_LOW_RATING",
  FEEDBACK_REPLIED: "FEEDBACK_REPLIED",
};

export const FEEDBACK_NOTIFICATION_TEMPLATES = {
  [FEEDBACK_NOTIFICATION_EVENTS.FEEDBACK_CREATED]: {
    title: "Có đánh giá mới",
    message: ({ feedback }) =>
      `Đơn hàng ${feedback.orderId?.orderCode || feedback.orderId} vừa nhận được đánh giá ${feedback.rating} sao.`,
  },

  [FEEDBACK_NOTIFICATION_EVENTS.FEEDBACK_LOW_RATING]: {
    title: "Cảnh báo đánh giá thấp",
    message: ({ feedback }) =>
      `Đơn hàng ${feedback.orderId?.orderCode || feedback.orderId} nhận đánh giá thấp: ${feedback.rating} sao.`,
  },

  [FEEDBACK_NOTIFICATION_EVENTS.FEEDBACK_REPLIED]: {
    title: "Đánh giá đã có phản hồi",
    message: ({ feedback }) =>
      `Đánh giá cho đơn hàng ${feedback.orderId?.orderCode || feedback.orderId} đã có phản hồi từ quản trị viên.`,
  },
};
