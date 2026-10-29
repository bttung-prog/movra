import { describe, expect, it } from "vitest";

import dashboardValidator from "../../../src/modules/dashboard/dashboard.validator.js";

describe("dashboardValidator.driverPerformanceQuerySchema", () => {
  it("defaults the result limit to five", () => {
    const { error, value } =
      dashboardValidator.driverPerformanceQuerySchema.validate({});

    expect(error).toBeUndefined();
    expect(value).toEqual({ limit: 5 });
  });

  it("accepts integer limits from one through one hundred", () => {
    for (const limit of [1, 5, 100]) {
      expect(
        dashboardValidator.driverPerformanceQuerySchema.validate({ limit })
          .error,
      ).toBeUndefined();
    }
  });

  it.each([
    ["zero", 0],
    ["negative", -1],
    ["fractional", 1.5],
    ["over maximum", 101],
    ["non-numeric", "many"],
  ])("rejects a %s limit", (_case, limit) => {
    expect(
      dashboardValidator.driverPerformanceQuerySchema.validate({ limit }).error,
    ).toBeDefined();
  });
});
