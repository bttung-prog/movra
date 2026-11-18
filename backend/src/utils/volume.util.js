import { VOLUMETRIC_WEIGHT_DIVISOR_CM3 } from "../constants/pricingUnits.js";

/**
 * Calculates package volume in cubic centimetres from centimetre dimensions.
 */
export const calculateVolumeCm3 = (length, width, height) => {
  const volumeCm3 = Number(length) * Number(width) * Number(height);

  if (!Number.isFinite(volumeCm3) || volumeCm3 <= 0) {
    return 0;
  }

  return Number(volumeCm3.toFixed(2));
};

/**
 * Calculates volumetric weight in kilograms: (L × W × H cm³) / 3000.
 */
export const calculateVolumetricWeightKg = (
  length,
  width,
  height,
  quantity = 1,
) => {
  const volumeCm3 = Number(length) * Number(width) * Number(height);

  if (!Number.isFinite(volumeCm3) || volumeCm3 <= 0) {
    return 0;
  }

  return Number(
    ((volumeCm3 / VOLUMETRIC_WEIGHT_DIVISOR_CM3) * quantity).toFixed(2),
  );
};
