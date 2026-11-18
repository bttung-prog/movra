import { SERVICE_TYPES } from "./serviceTypes.js";

// basePrice: VND
// baseWeight: kg (weight included in the basePrice; 1000 kg = 1 tonne)
// extraWeightPrice: VND/tonne (applies only to the weight exceeding the baseWeight, rounded up
// to the nearest tonne)
// baseDistance: km (distance included in the basePrice)
// extraDistancePrice: VND/km
export const DEFAULT_RATES_BY_SERVICE_TYPE = {
  [SERVICE_TYPES.STANDARD]: {
    name: "Bảng cước mặc định",
    serviceType: SERVICE_TYPES.STANDARD,
    basePrice: 3000,
    baseWeight: 1000,
    extraWeightPrice: 3000,
    baseDistance: 1,
    extraDistancePrice: 3000,
    categorySurcharges: [],
  },

  [SERVICE_TYPES.EXPRESS]: {
    name: "Bảng cước Hỏa tốc mặc định",
    serviceType: SERVICE_TYPES.EXPRESS,
    basePrice: 4500,
    baseWeight: 1000,
    extraWeightPrice: 5000,
    baseDistance: 1,
    extraDistancePrice: 5000,
    categorySurcharges: [],
  },

  [SERVICE_TYPES.SAME_DAY]: {
    name: "Bảng cước Giao trong ngày mặc định",
    serviceType: SERVICE_TYPES.SAME_DAY,
    basePrice: 6500,
    baseWeight: 1000,
    extraWeightPrice: 7000,
    baseDistance: 1,
    extraDistancePrice: 7000,
    categorySurcharges: [],
  },
};

export const DEFAULT_RATE =
  DEFAULT_RATES_BY_SERVICE_TYPE[SERVICE_TYPES.STANDARD];
