import { beforeEach, describe, expect, it, vi } from "vitest";

import { ROLES } from "../../../src/constants/roles.js";
import {
  TRIP_MESSAGES,
  WAREHOUSE_MESSAGES,
} from "../../../src/constants/messages.js";

const mocks = vi.hoisted(() => ({
  getDriverByUserId: vi.fn(),
  getVehicleById: vi.fn(),
}));

vi.mock("../../../src/modules/driver/driver.service.js", () => ({
  default: {
    getByUserId: mocks.getDriverByUserId,
  },
}));

vi.mock("../../../src/modules/vehicle/vehicle.service.js", () => ({
  default: {
    getById: mocks.getVehicleById,
  },
}));

import tripAccess from "../../../src/modules/trip/trip.access.js";

const driverUser = {
  role: ROLES.DRIVER,
  userId: "user-1",
  driverId: "driver-1",
};

describe("tripAccess driver identity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDriverByUserId.mockResolvedValue({ _id: "driver-1" });
  });

  it("looks up the driver profile by the token userId", async () => {
    await expect(
      tripAccess.assertTripWarehouseAccess(
        { _id: "trip-1", driverId: "driver-1" },
        driverUser,
      ),
    ).resolves.toBeUndefined();

    expect(mocks.getDriverByUserId).toHaveBeenCalledWith("user-1");
  });

  it("rejects a driver that is not assigned to the trip", async () => {
    mocks.getDriverByUserId.mockResolvedValue({ _id: "driver-2" });

    await expect(
      tripAccess.assertTripWarehouseAccess(
        { _id: "trip-1", driverId: "driver-1" },
        driverUser,
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: TRIP_MESSAGES.NOT_ASSIGNED_DRIVER,
    });
  });

  it("scopes trip filters using the token userId", async () => {
    const filter = await tripAccess.scopeTripFilter(
      { status: "planned" },
      driverUser,
    );

    expect(mocks.getDriverByUserId).toHaveBeenCalledWith("user-1");
    expect(filter).toEqual({
      $and: [{ status: "planned" }, { driverId: "driver-1" }],
    });
  });

  it("uses a populated driver userId without querying the driver service", async () => {
    await expect(
      tripAccess.assertTripWarehouseAccess(
        {
          _id: "trip-1",
          driverId: { _id: "driver-1", userId: { _id: "user-1" } },
        },
        driverUser,
      ),
    ).resolves.toBeUndefined();

    expect(mocks.getDriverByUserId).not.toHaveBeenCalled();
  });

  it("rejects a populated driver userId that does not match the token", async () => {
    await expect(
      tripAccess.assertTripWarehouseAccess(
        {
          _id: "trip-1",
          driverId: { _id: "driver-1", userId: { _id: "user-2" } },
        },
        driverUser,
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: TRIP_MESSAGES.NOT_ASSIGNED_DRIVER,
    });
    expect(mocks.getDriverByUserId).not.toHaveBeenCalled();
  });
});

describe("tripAccess dispatcher vehicle scope", () => {
  const dispatcherUser = {
    role: ROLES.DISPATCHER,
    warehouseId: "warehouse-1",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getVehicleById.mockResolvedValue({
      _id: "vehicle-1",
      warehouseId: "warehouse-1",
    });
  });

  it("uses the populated vehicle warehouse without querying the vehicle service", async () => {
    await expect(
      tripAccess.assertTripWarehouseAccess(
        {
          _id: "trip-1",
          warehouseId: "warehouse-1",
          vehicleId: { _id: "vehicle-1", warehouseId: "warehouse-1" },
        },
        dispatcherUser,
      ),
    ).resolves.toBeUndefined();

    expect(mocks.getVehicleById).not.toHaveBeenCalled();
  });

  it("rejects a populated vehicle belonging to another warehouse", async () => {
    await expect(
      tripAccess.assertTripWarehouseAccess(
        {
          _id: "trip-1",
          warehouseId: "warehouse-1",
          vehicleId: { _id: "vehicle-1", warehouseId: "warehouse-2" },
        },
        dispatcherUser,
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: WAREHOUSE_MESSAGES.ACCESS_DENIED,
    });
    expect(mocks.getVehicleById).not.toHaveBeenCalled();
  });

  it("falls back to the vehicle service when the vehicle is not populated", async () => {
    await expect(
      tripAccess.assertTripWarehouseAccess(
        {
          _id: "trip-1",
          warehouseId: "warehouse-1",
          vehicleId: "vehicle-1",
        },
        dispatcherUser,
      ),
    ).resolves.toBeUndefined();

    expect(mocks.getVehicleById).toHaveBeenCalledWith(
      "vehicle-1",
      dispatcherUser,
    );
  });
});
