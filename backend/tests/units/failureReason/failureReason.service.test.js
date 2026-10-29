import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findAll: vi.fn(),
  countAll: vi.fn(),
  findById: vi.fn(),
  findByOrderId: vi.fn(),
  findByTripId: vi.fn(),
  countByFailureType: vi.fn(),
  updateById: vi.fn(),
  deleteById: vi.fn(),
  getOrderById: vi.fn(),
  recordFailureAttempt: vi.fn(),
  addTrackingLog: vi.fn(),
  getOrderIdsByWarehouseId: vi.fn(),
  getTripById: vi.fn(),
  getTripIdsByWarehouseId: vi.fn(),
  getUserById: vi.fn(),
}));

vi.mock(
  "../../../src/modules/failureReason/failureReason.repository.js",
  () => ({
    default: {
      create: mocks.create,
      findAll: mocks.findAll,
      countAll: mocks.countAll,
      findById: mocks.findById,
      findByOrderId: mocks.findByOrderId,
      findByTripId: mocks.findByTripId,
      countByFailureType: mocks.countByFailureType,
      updateById: mocks.updateById,
      deleteById: mocks.deleteById,
    },
  }),
);

vi.mock("../../../src/modules/order/order.service.js", () => ({
  default: {
    getById: mocks.getOrderById,
    recordFailureAttempt: mocks.recordFailureAttempt,
    addTrackingLog: mocks.addTrackingLog,
    getIdsByWarehouseId: mocks.getOrderIdsByWarehouseId,
  },
}));

vi.mock("../../../src/modules/trip/trip.service.js", () => ({
  default: {
    getById: mocks.getTripById,
    getIdsByWarehouseId: mocks.getTripIdsByWarehouseId,
  },
}));

vi.mock("../../../src/modules/user/user.service.js", () => ({
  default: { getById: mocks.getUserById },
}));

import { FAILURE_REASON_MESSAGES } from "../../../src/constants/messages.js";
import ROLES from "../../../src/constants/roles.js";
import failureReasonService from "../../../src/modules/failureReason/failureReason.service.js";

const orderId = "order-1";
const tripId = "trip-1";
const driverId = "driver-1";
const userId = "user-1";

const report = {
  orderId,
  tripId,
  failureReasonType: "customer_rejected",
  failureReasonDescription: "Customer unavailable",
  reportedBy: userId,
  latitude: 10.75,
  longitude: 106.67,
  address: "Ho Chi Minh City",
};

const activeOrder = {
  _id: orderId,
  status: "in_transit",
  tripId,
};

const assignedTrip = {
  _id: tripId,
  status: "in_progress",
  driverId,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getOrderById.mockResolvedValue(activeOrder);
  mocks.getTripById.mockResolvedValue(assignedTrip);
  mocks.getUserById.mockResolvedValue({ _id: userId });
  mocks.findAll.mockResolvedValue([]);
  mocks.countAll.mockResolvedValue(0);
  mocks.findByOrderId.mockResolvedValue([]);
  mocks.findByTripId.mockResolvedValue([]);
  mocks.countByFailureType.mockResolvedValue([]);
});

describe("failureReasonService.create", () => {
  it.each(["delivered", "returned", "cancelled"])(
    "rejects reporting an order with status %s",
    async (status) => {
      mocks.getOrderById.mockResolvedValue({ ...activeOrder, status });

      await expect(
        failureReasonService.create({ ...report, user: { role: ROLES.ADMIN } }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: FAILURE_REASON_MESSAGES.CANNOT_REPORT_STATUS(status),
      });

      expect(mocks.create).not.toHaveBeenCalled();
    },
  );

  it("rejects orders that do not belong to the reported trip", async () => {
    mocks.getOrderById.mockResolvedValue({
      ...activeOrder,
      tripId: "another-trip",
    });

    await expect(
      failureReasonService.create({ ...report, user: { role: ROLES.ADMIN } }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: FAILURE_REASON_MESSAGES.ORDER_NOT_IN_TRIP,
    });

    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects reports for cancelled trips", async () => {
    mocks.getTripById.mockResolvedValue({
      ...assignedTrip,
      status: "cancelled",
    });

    await expect(
      failureReasonService.create({ ...report, user: { role: ROLES.ADMIN } }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: FAILURE_REASON_MESSAGES.CANNOT_REPORT_CANCELLED_TRIP,
    });

    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("only allows a driver assigned to the trip to report a failure", async () => {
    await expect(
      failureReasonService.create({
        ...report,
        user: { role: ROLES.DRIVER, driverId: "another-driver" },
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: FAILURE_REASON_MESSAGES.NOT_ASSIGNED_DRIVER,
    });
  });
});

describe("failureReasonService access and pagination", () => {
  it("restricts customer order history to the order owner", async () => {
    mocks.getOrderById.mockResolvedValue({
      ...activeOrder,
      customerId: "customer-1",
    });

    await expect(
      failureReasonService.getByOrderId({
        orderId,
        user: { role: ROLES.CUSTOMER, customerId: "another-customer" },
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: FAILURE_REASON_MESSAGES.ACCESS_DENIED,
    });

    expect(mocks.findByOrderId).not.toHaveBeenCalled();
  });

  it("restricts drivers to orders assigned to their trip", async () => {
    mocks.getOrderById.mockResolvedValue({
      ...activeOrder,
      tripId: "another-trip",
    });
    mocks.getTripById.mockResolvedValue({
      ...assignedTrip,
      driverId: "another-driver",
    });

    await expect(
      failureReasonService.getByOrderId({
        orderId,
        user: { role: ROLES.DRIVER, driverId },
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: FAILURE_REASON_MESSAGES.NOT_ASSIGNED_DRIVER,
    });

    expect(mocks.findByOrderId).not.toHaveBeenCalled();
  });

  it("applies pagination and inclusive date filtering to failure reports", async () => {
    await failureReasonService.getAll({
      page: 2,
      limit: 5,
      filter: {
        failureReasonType: "damaged",
        startDate: "2026-01-01",
        endDate: "2026-01-31",
      },
    });

    expect(mocks.findAll).toHaveBeenCalledWith({
      filter: {
        failureReasonType: "damaged",
        createdAt: {
          $gte: new Date("2026-01-01"),
          $lt: new Date("2026-02-01T00:00:00.000Z"),
        },
      },
      skip: 5,
      limit: 5,
      sort: { createdAt: -1 },
    });
    expect(mocks.countAll).toHaveBeenCalledWith({
      filter: expect.objectContaining({
        failureReasonType: "damaged",
      }),
    });
  });
});
