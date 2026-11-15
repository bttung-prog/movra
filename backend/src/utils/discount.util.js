const clampDiscountRate = (rate) => {
  const numeric = Number(rate);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(100, Math.max(0, numeric));
};

/**
 * Applies a contract discount rate to an integer money amount.
 * The discount is rounded to the nearest dong and never exceeds the gross amount.
 */
export const applyContractDiscount = (amount, rate = 0) => {
  const numericAmount = Number(amount);
  const grossAmount =
    Number.isFinite(numericAmount) && numericAmount > 0
      ? Math.round(numericAmount)
      : 0;
  const discountRate = clampDiscountRate(rate);
  const calculatedDiscount = Math.round((grossAmount * discountRate) / 100);
  const discountAmount = Math.min(grossAmount, Math.max(0, calculatedDiscount));

  return {
    grossAmount,
    discountRate,
    discountAmount,
    netAmount: grossAmount - discountAmount,
  };
};

export default { applyContractDiscount };
