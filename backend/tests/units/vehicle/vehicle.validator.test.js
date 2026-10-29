import { describe, expect, it } from "vitest";

import vehicleValidator from "../../../src/modules/vehicle/vehicle.validator.js";

const validVehiclePayload = {
  plateNumber: "  51A-123.45  ",
  vehicleTypeId: "507f1f77bcf86cd799439011",
  warehouseId: "507f1f77bcf86cd799439012",
  brand: "  Toyota ",
  model: "  Hilux ",
  yearManufactured: 2022,
  capacityWeight: 1000,
  capacityVolume: 10,
  registrationExpiryDate: "2035-01-01",
  insuranceExpiryDate: "2035-01-01",
};

const validUsageLogPayload = {
  vehicleId: "507f1f77bcf86cd799439011",
  driverId: "507f1f77bcf86cd799439012",
  tripId: "507f1f77bcf86cd799439013",
  startOdo: 1200,
};

describe("vehicleValidator.createSchema", () => {
  it("accepts valid data and trims text fields", () => {
    const { error, value } =
      vehicleValidator.createSchema.validate(validVehiclePayload);

    expect(error).toBeUndefined();
    expect(value).toMatchObject({
      plateNumber: "51A-123.45",
      brand: "Toyota",
      model: "Hilux",
    });
  });

  it.each([
    ["invalid vehicle type ID", { vehicleTypeId: "type-1" }],
    ["invalid warehouse ID", { warehouseId: "warehouse-1" }],
    ["year before 1900", { yearManufactured: 1899 }],
    ["fractional manufacture year", { yearManufactured: 2020.5 }],
    ["non-positive weight capacity", { capacityWeight: 0 }],
    ["non-positive volume capacity", { capacityVolume: -1 }],
    ["missing registration expiry", { registrationExpiryDate: undefined }],
    ["invalid insurance expiry", { insuranceExpiryDate: "not-a-date" }],
  ])("rejects %s", (_case, override) => {
    expect(
      vehicleValidator.createSchema.validate({
        ...validVehiclePayload,
        ...override,
      }).error,
    ).toBeDefined();
  });

  it("allows an unassigned warehouse", () => {
    expect(
      vehicleValidator.createSchema.validate({
        ...validVehiclePayload,
        warehouseId: null,
      }).error,
    ).toBeUndefined();
  });
});

describe("vehicleValidator.updateSchema", () => {
  it("requires at least one field", () => {
    expect(
      vehicleValidator.updateSchema.validate({}).error?.details[0].type,
    ).toBe("object.min");
  });

  it("accepts clearing a warehouse assignment", () => {
    expect(
      vehicleValidator.updateSchema.validate({ warehouseId: null }).error,
    ).toBeUndefined();
  });

  it.each([
    ["invalid vehicle type ID", { vehicleTypeId: "type-1" }],
    ["invalid warehouse ID", { warehouseId: "warehouse-1" }],
    ["invalid manufacture year", { yearManufactured: 1890 }],
    ["non-positive weight capacity", { capacityWeight: 0 }],
  ])("rejects %s", (_case, update) => {
    expect(vehicleValidator.updateSchema.validate(update).error).toBeDefined();
  });
});

describe("vehicleValidator vehicle parameters and queries", () => {
  it("validates vehicle and vehicle type IDs", () => {
    expect(
      vehicleValidator.vehicleIdParamSchema.validate({
        vehicleId: "507f1f77bcf86cd799439011",
      }).error,
    ).toBeUndefined();
    expect(
      vehicleValidator.vehicleTypeIdParamSchema.validate({
        vehicleTypeId: "invalid",
      }).error,
    ).toBeDefined();
  });

  it("applies pagination defaults and validates filters", () => {
    const { error, value } = vehicleValidator.paginationQuerySchema.validate(
      {},
    );

    expect(error).toBeUndefined();
    expect(value).toMatchObject({ page: 1, limit: 10 });
    expect(
      vehicleValidator.paginationQuerySchema.validate({ limit: 101 }).error,
    ).toBeDefined();
    expect(
      vehicleValidator.paginationQuerySchema.validate({ status: "broken" })
        .error,
    ).toBeDefined();
  });

  it("validates vehicle type creation and updates", () => {
    expect(
      vehicleValidator.createTypeSchema.validate({
        name: "Truck",
        description: "Cargo truck",
        maxWeight: 1000,
        maxVolume: 15,
      }).error,
    ).toBeUndefined();
    expect(
      vehicleValidator.createTypeSchema.validate({ name: "Truck" }).error,
    ).toBeDefined();
    expect(
      vehicleValidator.updateTypeSchema.validate({}).error?.details[0].type,
    ).toBe("object.min");
  });

  it("validates status, odometer and renewal payloads", () => {
    expect(
      vehicleValidator.changeStatusSchema.validate({ status: "maintenance" })
        .error,
    ).toBeUndefined();
    expect(
      vehicleValidator.changeStatusSchema.validate({ status: "broken" }).error,
    ).toBeDefined();
    expect(
      vehicleValidator.updateOdometerSchema.validate({ newOdo: -1 }).error,
    ).toBeDefined();
    expect(
      vehicleValidator.renewRegistrationSchema.validate({
        newExpiryDate: "2035-01-01",
      }).error,
    ).toBeUndefined();
    expect(
      vehicleValidator.renewInsuranceSchema.validate({}).error,
    ).toBeDefined();
  });
});

describe("vehicleValidator usage log schemas", () => {
  it("accepts valid check-in data and defaults its start time", () => {
    const { error, value } =
      vehicleValidator.createUsageLogSchema.validate(validUsageLogPayload);

    expect(error).toBeUndefined();
    expect(value.startTime).toEqual(expect.any(Number));
  });

  it.each([
    ["invalid vehicle ID", { vehicleId: "vehicle-1" }],
    ["invalid driver ID", { driverId: "driver-1" }],
    ["invalid trip ID", { tripId: "trip-1" }],
    ["negative start odometer", { startOdo: -1 }],
  ])("rejects %s", (_case, override) => {
    expect(
      vehicleValidator.createUsageLogSchema.validate({
        ...validUsageLogPayload,
        ...override,
      }).error,
    ).toBeDefined();
  });

  it("validates check-out, usage-log update and usage-log query data", () => {
    const checkOut = vehicleValidator.checkOutUsageLogSchema.validate({
      endOdo: 1300,
    });
    expect(checkOut.error).toBeUndefined();
    expect(checkOut.value.fuelConsumed).toBe(0);
    expect(
      vehicleValidator.checkOutUsageLogSchema.validate({ endOdo: -1 }).error,
    ).toBeDefined();

    expect(
      vehicleValidator.updateUsageLogSchema.validate({}).error?.details[0].type,
    ).toBe("object.min");
    const { error, value } = vehicleValidator.queryUsageLogsSchema.validate({});
    expect(error).toBeUndefined();
    expect(value).toMatchObject({ page: 1, limit: 10 });
    expect(
      vehicleValidator.usageStatsQuerySchema.validate({
        startDate: "not-a-date",
      }).error,
    ).toBeDefined();
  });
});
