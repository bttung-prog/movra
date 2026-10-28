const INTEGER_AMOUNT_MESSAGE =
  "Số tiền phải là số nguyên trong giới hạn cho phép";

export const integerAmount = (options = {}) => ({
  type: Number,
  validate: {
    validator: (value) =>
      value === null || value === undefined || Number.isSafeInteger(value),
    message: INTEGER_AMOUNT_MESSAGE,
  },
  ...options,
});

export const integerMoney = (options = {}) =>
  integerAmount({
    min: 0,
    ...options,
  });
