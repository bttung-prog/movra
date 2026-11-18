// Pricing units:
// - weight/baseWeight: kg
// - extraWeightPrice: VND per ton (1,000 kg), rounded up per ton
// - baseDistance: km; extraDistancePrice: VND per km
// - length/width/height: cm; volumetric weight = (L × W × H / 3000) × quantity (kg)
export const KG_PER_TON = 1000;
export const VOLUMETRIC_WEIGHT_DIVISOR_CM3 = 3000;
export const CM3_PER_M3 = 1_000_000;
