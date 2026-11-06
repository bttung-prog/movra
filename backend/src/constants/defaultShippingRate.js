import { SERVICE_TYPES } from "./serviceTypes.js";

export const DEFAULT_RATES_BY_SERVICE_TYPE = {
  [SERVICE_TYPES.STANDARD]: {
    name: "Bảng cước mặc định",
    serviceType: SERVICE_TYPES.STANDARD,
    basePrice: 16500,
    baseWeight: 2,
    extraWeightPrice: 5000,
    baseDistance: 2,
    extraDistancePrice: 2000,
    categorySurcharges: [],
  },

  [SERVICE_TYPES.EXPRESS]: {
    name: "Bảng cước Hỏa tốc mặc định",
    serviceType: SERVICE_TYPES.EXPRESS,
    basePrice: 25000,
    baseWeight: 2,
    extraWeightPrice: 7000,
    baseDistance: 2,
    extraDistancePrice: 3500,
    categorySurcharges: [],
  },

  [SERVICE_TYPES.HEAVY]: {
    name: "Bảng cước Hàng nặng mặc định",
    serviceType: SERVICE_TYPES.HEAVY,
    basePrice: 50000,
    baseWeight: 10,
    extraWeightPrice: 3000,
    baseDistance: 5,
    extraDistancePrice: 2500,
    categorySurcharges: [],
  },

  [SERVICE_TYPES.SAME_DAY]: {
    name: "Bảng cước Giao trong ngày mặc định",
    serviceType: SERVICE_TYPES.SAME_DAY,
    basePrice: 75000,
    baseWeight: 2,
    extraWeightPrice: 6000,
    baseDistance: 2,
    extraDistancePrice: 3000,
    categorySurcharges: [],
  },
};

export const DEFAULT_RATE =
  DEFAULT_RATES_BY_SERVICE_TYPE[SERVICE_TYPES.STANDARD];
