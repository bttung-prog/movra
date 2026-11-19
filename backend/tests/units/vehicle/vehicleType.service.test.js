import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findActive: vi.fn(),
  countActive: vi.fn(),
  findDeleted: vi.fn(),
  countDeleted: vi.fn(),
  findById: vi.fn(),
  findByName: vi.fn(),
  updateById: vi.fn(),
  deleteById: vi.fn(),
  restoreById: vi.fn(),
  countAllVehicles: vi.fn(),
}));

vi.mock("../../../src/modules/vehicle/vehicleType.repository.js", () => ({
  default: {
    create: mocks.create,
    findActive: mocks.findActive,
    countActive: mocks.countActive,
    findDeleted: mocks.findDeleted,
    countDeleted: mocks.countDeleted,
    findById: mocks.findById,
    findByName: mocks.findByName,
    updateById: mocks.updateById,
    deleteById: mocks.deleteById,
    restoreById: mocks.restoreById,
  },
}));

vi.mock("../../../src/modules/vehicle/vehicle.repository.js", () => ({
  default: {
    countAll: mocks.countAllVehicles,
  },
}));

import { VEHICLE_MESSAGES } from "../../../src/constants/messages.js";
import vehicleTypeService from "../../../src/modules/vehicle/vehicleType.service.js";

const vehicleTypeId = "type-1";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findById.mockResolvedValue({ _id: vehicleTypeId, deletedAt: null });
  mocks.findByName.mockResolvedValue(null);
  mocks.create.mockResolvedValue({ _id: vehicleTypeId });
  mocks.findActive.mockResolvedValue([]);
  mocks.countActive.mockResolvedValue(0);
  mocks.updateById.mockResolvedValue({ _id: vehicleTypeId, deletedAt: null });
  mocks.countAllVehicles.mockResolvedValue(0);
});

describe("vehicleTypeService", () => {
  describe("create", () => {
    it("creates a vehicle type when its name is not in use", async () => {
      const payload = {
        name: "Truck",
        description: "Cargo truck",
        maxWeight: 1000,
        maxVolume: 15,
      };

      const result = await vehicleTypeService.create(payload);

      expect(result).toEqual({ _id: vehicleTypeId });
      expect(mocks.create).toHaveBeenCalledWith(payload);
    });

    it("rejects an active vehicle type with a duplicate name", async () => {
      mocks.findByName.mockResolvedValue({
        _id: vehicleTypeId,
        deletedAt: null,
      });

      await expect(
        vehicleTypeService.create({
          name: "Truck",
          description: "Cargo truck",
          maxWeight: 1000,
          maxVolume: 15,
        }),
      ).rejects.toMatchObject({
        statusCode: 409,
        message: VEHICLE_MESSAGES.TYPE_EXISTS,
      });
      expect(mocks.create).not.toHaveBeenCalled();
    });

    it("reactivates a deleted vehicle type with the requested values", async () => {
      mocks.findByName.mockResolvedValue({
        _id: vehicleTypeId,
        deletedAt: new Date("2024-01-01"),
      });
      mocks.updateById.mockResolvedValue({
        _id: vehicleTypeId,
        deletedAt: null,
      });

      const result = await vehicleTypeService.create({
        name: "Truck",
        description: "Updated description",
        maxWeight: 1200,
        maxVolume: 18,
      });

      expect(mocks.updateById).toHaveBeenCalledWith(vehicleTypeId, {
        description: "Updated description",
        maxWeight: 1200,
        maxVolume: 18,
        deletedAt: null,
      });
      expect(result.deletedAt).toBeNull();
      expect(mocks.create).not.toHaveBeenCalled();
    });
  });

  describe("getActive", () => {
    it("paginates active types and calculates total pages", async () => {
      mocks.findActive.mockResolvedValue([{ _id: vehicleTypeId }]);
      mocks.countActive.mockResolvedValue(21);

      const result = await vehicleTypeService.getActive({ page: 2, limit: 10 });

      expect(mocks.findActive).toHaveBeenCalledWith({ skip: 10, limit: 10 });
      expect(result).toEqual({
        data: [{ _id: vehicleTypeId }],
        pagination: { page: 2, limit: 10, total: 21, totalPages: 3 },
      });
    });
  });

  describe("deleteById", () => {
    it("rejects deletion when vehicles are assigned to this type", async () => {
      mocks.countAllVehicles.mockResolvedValue(3);

      await expect(
        vehicleTypeService.deleteById(vehicleTypeId),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: VEHICLE_MESSAGES.TYPE_CANNOT_DELETE_ASSIGNED(3),
      });
      expect(mocks.deleteById).not.toHaveBeenCalled();
    });

    it("deletes the type when no vehicles are assigned", async () => {
      mocks.countAllVehicles.mockResolvedValue(0);
      mocks.deleteById.mockResolvedValue({ _id: vehicleTypeId });

      const result = await vehicleTypeService.deleteById(vehicleTypeId);

      expect(result).toEqual({ _id: vehicleTypeId });
      expect(mocks.deleteById).toHaveBeenCalledWith(vehicleTypeId);
    });
  });
});
