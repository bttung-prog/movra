import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getStatsByStatus: vi.fn(),
  getRecentTrends: vi.fn(),
  getTopDriverPerformance: vi.fn(),
  getVehicleStatsByStatus: vi.fn(),
  getTripStatsByStatus: vi.fn(),
}));

vi.mock("../../../src/modules/order/order.service.js", () => ({
  default: {
    getStatsByStatus: mocks.getStatsByStatus,
    getRecentTrends: mocks.getRecentTrends,
  },
}));

vi.mock("../../../src/modules/trip/trip.service.js", () => ({
  default: {
    getTopDriverPerformance: mocks.getTopDriverPerformance,
    getStatsByStatus: mocks.getTripStatsByStatus,
  },
}));

vi.mock("../../../src/modules/vehicle/vehicle.service.js", () => ({
  default: { getStatsByStatus: mocks.getVehicleStatsByStatus },
}));

import dashboardService from "../../../src/modules/dashboard/dashboard.service.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getStatsByStatus.mockResolvedValue([]);
  mocks.getRecentTrends.mockResolvedValue([]);
  mocks.getTopDriverPerformance.mockResolvedValue([]);
  mocks.getVehicleStatsByStatus.mockResolvedValue([]);
  mocks.getTripStatsByStatus.mockResolvedValue([]);
});

describe("dashboardService.getOverviewStats", () => {
  it("aggregates delivered, processing, and failed orders with revenue and COD", async () => {
    const statusBreakdown = [
      { _id: "delivered", count: 6, shippingFee: 1200, codAmount: 4500 },
      { _id: "created", count: 2 },
      { _id: "in_transit", count: 1 },
      { _id: "failed", count: 1 },
      { _id: "returned", count: 1 },
      { _id: "cancelled", count: 1 },
    ];
    const recentTrends = [{ date: "2026-01-01", count: 2 }];
    mocks.getStatsByStatus.mockResolvedValue(statusBreakdown);
    mocks.getRecentTrends.mockResolvedValue(recentTrends);

    const result = await dashboardService.getOverviewStats();

    expect(mocks.getStatsByStatus).toHaveBeenCalledOnce();
    expect(mocks.getRecentTrends).toHaveBeenCalledWith({ days: 7 });
    expect(result).toEqual({
      summary: {
        totalOrders: 12,
        deliveredOrders: 6,
        processingOrders: 3,
        failedOrders: 3,
        successRate: 50,
        totalRevenue: 1200,
        totalCod: 4500,
      },
      statusBreakdown,
      recentTrends,
    });
  });

  it("returns zero summary values when there are no orders", async () => {
    const result = await dashboardService.getOverviewStats();

    expect(result.summary).toEqual({
      totalOrders: 0,
      deliveredOrders: 0,
      processingOrders: 0,
      failedOrders: 0,
      successRate: 0,
      totalRevenue: 0,
      totalCod: 0,
    });
    expect(result.statusBreakdown).toEqual([]);
    expect(result.recentTrends).toEqual([]);
  });

  it("counts only delivered statuses as successful and rounds the rate to one decimal", async () => {
    mocks.getStatsByStatus.mockResolvedValue([
      { _id: "delivered", count: 1, shippingFee: 100, codAmount: 200 },
      { _id: "processing", count: 2 },
    ]);

    const { summary } = await dashboardService.getOverviewStats();

    expect(summary).toMatchObject({
      totalOrders: 3,
      deliveredOrders: 1,
      processingOrders: 2,
      successRate: 33.3,
      totalRevenue: 100,
      totalCod: 200,
    });
  });
});

describe("dashboardService.getDriverPerformance", () => {
  it("uses the default limit and returns the trip service result", async () => {
    const performance = [{ driverId: "driver-1", completedTrips: 12 }];
    mocks.getTopDriverPerformance.mockResolvedValue(performance);

    await expect(dashboardService.getDriverPerformance()).resolves.toBe(
      performance,
    );
    expect(mocks.getTopDriverPerformance).toHaveBeenCalledWith({ limit: 5 });
  });

  it("forwards a supplied limit", async () => {
    await dashboardService.getDriverPerformance({ limit: 25 });

    expect(mocks.getTopDriverPerformance).toHaveBeenCalledWith({ limit: 25 });
  });
});

describe("dashboardService.getFleetStatus", () => {
  it("returns vehicle and trip status statistics", async () => {
    const vehicleStats = [{ _id: "available", count: 8 }];
    const tripStats = [{ _id: "in_progress", count: 3 }];
    mocks.getVehicleStatsByStatus.mockResolvedValue(vehicleStats);
    mocks.getTripStatsByStatus.mockResolvedValue(tripStats);

    await expect(dashboardService.getFleetStatus()).resolves.toEqual({
      vehicles: vehicleStats,
      trips: tripStats,
    });
    expect(mocks.getVehicleStatsByStatus).toHaveBeenCalledOnce();
    expect(mocks.getTripStatsByStatus).toHaveBeenCalledOnce();
  });
});
