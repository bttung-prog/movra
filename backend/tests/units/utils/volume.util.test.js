import { describe, expect, it } from "vitest";

import {
  calculateVolumeCm3,
  calculateVolumetricWeightKg,
} from "../../../src/utils/volume.util.js";

describe("volume util", () => {
  it("calculates package volume in cubic centimetres", () => {
    expect(calculateVolumeCm3(30, 20, 10)).toBe(6000);
  });

  it("calculates volumetric weight per package and quantity", () => {
    expect(calculateVolumetricWeightKg(30, 20, 10)).toBe(2);
    expect(calculateVolumetricWeightKg(30, 20, 10, 3)).toBe(6);
  });

  it("returns zero for invalid or missing dimensions", () => {
    expect(calculateVolumeCm3(0, 20, 10)).toBe(0);
    expect(calculateVolumeCm3(undefined, 20, 10)).toBe(0);
    expect(calculateVolumetricWeightKg(0, 20, 10)).toBe(0);
    expect(calculateVolumetricWeightKg(undefined, 20, 10)).toBe(0);
  });
});
