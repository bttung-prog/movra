import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createExpense: vi.fn(),
  findById: vi.fn(),
  updateById: vi.fn(),
  deleteById: vi.fn(),
  findByTripId: vi.fn(),
  countByTripId: vi.fn(),
  calculateTotalByTripId: vi.fn(),
  findTripById: vi.fn(),
  getDriverById: vi.fn(),
  getUserById: vi.fn(),
  assertTripWarehouseAccess: vi.fn(),
}));

vi.mock("../../../src/modules/trip/tripExpense.repository.js", () => ({
  default: {
    create: mocks.createExpense,
    findById: mocks.findById,
    updateById: mocks.updateById,
    deleteById: mocks.deleteById,
    findByTripId: mocks.findByTripId,
    countByTripId: mocks.countByTripId,
    calculateTotalByTripId: mocks.calculateTotalByTripId,
  },
}));

vi.mock("../../../src/modules/trip/trip.repository.js", () => ({
  default: {
    findById: mocks.findTripById,
  },
}));

vi.mock("../../../src/modules/trip/trip.access.js", () => ({
  default: {
    assertTripWarehouseAccess: mocks.assertTripWarehouseAccess,
  },
}));

vi.mock("../../../src/modules/driver/driver.service.js", () => ({
  default: {
    getById: mocks.getDriverById,
  },
}));

vi.mock("../../../src/modules/user/user.service.js", () => ({
  default: {
    getById: mocks.getUserById,
  },
}));

import { ROLES } from "../../../src/constants/roles.js";
import {
  COMMON_MESSAGES,
  TRIP_MESSAGES,
} from "../../../src/constants/messages.js";
import tripExpenseService from "../../../src/modules/trip/tripExpense.service.js";

describe("tripExpenseService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findTripById.mockResolvedValue({
      _id: "trip-1",
      driverId: { _id: "driver-1" },
      status: "in_progress",
      deletedAt: null,
    });
    mocks.assertTripWarehouseAccess.mockResolvedValue();
    mocks.createExpense.mockResolvedValue({ _id: "expense-1" });
  });

  describe("addExpense", () => {
    it("creates a valid expense with a normalized date", async () => {
      await tripExpenseService.addExpense("trip-1", {
        expenseType: "fuel",
        expenseAmount: 50000,
        expenseDate: "2030-04-01T09:00:00.000Z",
        note: "Fuel",
      });

      expect(mocks.createExpense).toHaveBeenCalledWith({
        tripId: "trip-1",
        expenseType: "fuel",
        expenseAmount: 50000,
        expenseDate: new Date("2030-04-01T09:00:00.000Z"),
        note: "Fuel",
        receiptUrl: undefined,
        createdBy: undefined,
      });
    });

    it("verifies assigned driver when user is driver", async () => {
      mocks.getDriverById.mockResolvedValue({
        _id: "driver-1",
        userId: "user-2",
      });

      await expect(
        tripExpenseService.addExpense(
          "trip-1",
          { expenseType: "toll", expenseAmount: 10000 },
          { role: ROLES.DRIVER, userId: "user-1" },
        ),
      ).rejects.toMatchObject({
        statusCode: 403,
        message: TRIP_MESSAGES.NOT_ASSIGNED_DRIVER,
      });
    });
  });

  it("accepts a driver when the populated userId matches the actor", async () => {
    mocks.getDriverById.mockResolvedValue({
      _id: "driver-1",
      userId: { _id: "user-1" },
    });

    await expect(
      tripExpenseService.addExpense(
        "trip-1",
        { expenseType: "fuel", expenseAmount: 10000 },
        { role: ROLES.DRIVER, userId: "user-1" },
      ),
    ).resolves.toEqual({ _id: "expense-1" });
  });

  describe("getExpensesByTripId", () => {
    it("returns paginated expenses with total expense amount", async () => {
      mocks.findByTripId.mockResolvedValue([{ expenseAmount: 50000 }]);
      mocks.countByTripId.mockResolvedValue(1);
      mocks.calculateTotalByTripId.mockResolvedValue(50000);

      const result = await tripExpenseService.getExpensesByTripId("trip-1", {
        page: 1,
        limit: 10,
      });

      expect(result).toEqual({
        data: [{ expenseAmount: 50000 }],
        totalExpenseAmount: 50000,
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      });
    });
  });

  describe("getTotalExpensesByTripId", () => {
    it("returns total expenses amount for a trip", async () => {
      mocks.calculateTotalByTripId.mockResolvedValue(125000);

      const result =
        await tripExpenseService.getTotalExpensesByTripId("trip-1");

      expect(result).toEqual({
        tripId: "trip-1",
        totalAmount: 125000,
      });
    });
  });

  describe("updateExpenseById", () => {
    it("does not allow a driver to update an expense", async () => {
      await expect(
        tripExpenseService.updateExpenseById(
          "expense-1",
          { note: "Updated" },
          { role: ROLES.DRIVER, userId: "user-1" },
        ),
      ).rejects.toMatchObject({
        statusCode: 403,
        message: COMMON_MESSAGES.FORBIDDEN,
      });
    });

    it("throws 404 if expense is not found", async () => {
      mocks.findById.mockResolvedValue(null);

      await expect(
        tripExpenseService.updateExpenseById(
          "expense-none",
          { note: "Updated" },
          { role: ROLES.ADMIN },
        ),
      ).rejects.toMatchObject({
        statusCode: 404,
        message: TRIP_MESSAGES.EXPENSE_NOT_FOUND,
      });
    });

    it("allows an admin to update an expense", async () => {
      const expense = { tripId: "trip-1", createdBy: { _id: "user-1" } };
      mocks.findById.mockResolvedValue(expense);
      mocks.updateById.mockResolvedValue({ ...expense, note: "Updated" });

      await expect(
        tripExpenseService.updateExpenseById(
          "expense-1",
          { note: "Updated" },
          { role: ROLES.ADMIN },
        ),
      ).resolves.toEqual({ ...expense, note: "Updated" });
      expect(mocks.updateById).toHaveBeenCalledWith("expense-1", {
        note: "Updated",
      });
    });
  });

  describe("deleteExpenseById", () => {
    it("allows driver to delete only their own expense", async () => {
      const expense = { tripId: "trip-1", createdBy: { _id: "user-2" } };
      mocks.findById.mockResolvedValue(expense);

      await expect(
        tripExpenseService.deleteExpenseById("expense-1", {
          role: ROLES.DRIVER,
          userId: "user-1",
        }),
      ).rejects.toMatchObject({
        statusCode: 403,
        message: TRIP_MESSAGES.EXPENSE_DELETE_OWN_ONLY,
      });
    });

    it("allows admin to delete an expense", async () => {
      const expense = { tripId: "trip-1", createdBy: { _id: "user-1" } };
      mocks.findById.mockResolvedValue(expense);
      mocks.deleteById.mockResolvedValue(expense);

      await expect(
        tripExpenseService.deleteExpenseById("expense-1", {
          role: ROLES.ADMIN,
        }),
      ).resolves.toEqual(expense);
      expect(mocks.deleteById).toHaveBeenCalledWith("expense-1");
    });

    it("allows a driver to delete an expense with a raw createdBy id", async () => {
      const expense = { tripId: "trip-1", createdBy: "user-1" };
      mocks.findById.mockResolvedValue(expense);
      mocks.deleteById.mockResolvedValue(expense);

      await expect(
        tripExpenseService.deleteExpenseById("expense-1", {
          role: ROLES.DRIVER,
          userId: "user-1",
        }),
      ).resolves.toEqual(expense);
      expect(mocks.deleteById).toHaveBeenCalledWith("expense-1");
    });
  });
});
