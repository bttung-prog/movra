import orderService from "../order/order.service.js";
import tripService from "../trip/trip.service.js";
import vehicleService from "../vehicle/vehicle.service.js";

const getOverviewStats = async () => {
  const orderStats = await orderService.getStatsByStatus();

  let totalOrders = 0;
  let deliveredOrders = 0;
  let processingOrders = 0;
  let failedOrders = 0;
  let totalRevenue = 0;
  let totalCod = 0;

  orderStats.forEach((stat) => {
    totalOrders += stat.count;
    if (stat._id === "delivered") {
      deliveredOrders += stat.count;
      totalRevenue += stat.shippingFee || 0;
      totalCod += stat.codAmount || 0;
    } else if (["failed", "returned", "cancelled"].includes(stat._id)) {
      failedOrders += stat.count;
    } else {
      processingOrders += stat.count;
    }
  });

  const successRate =
    totalOrders > 0
      ? Number(((deliveredOrders / totalOrders) * 100).toFixed(1))
      : 0;

  const recentOrders = await orderService.getRecentTrends({ days: 7 });

  return {
    summary: {
      totalOrders,
      deliveredOrders,
      processingOrders,
      failedOrders,
      successRate,
      totalRevenue,
      totalCod,
    },
    statusBreakdown: orderStats,
    recentTrends: recentOrders,
  };
};

const getDriverPerformance = async ({ limit = 5 } = {}) => {
  return tripService.getTopDriverPerformance({ limit });
};

const getFleetStatus = async () => {
  const [vehicleStats, tripStats] = await Promise.all([
    vehicleService.getStatsByStatus(),
    tripService.getStatsByStatus(),
  ]);

  return {
    vehicles: vehicleStats,
    trips: tripStats,
  };
};

export default {
  getOverviewStats,
  getDriverPerformance,
  getFleetStatus,
};
