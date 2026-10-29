import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  startSession: vi.fn(),
  withTransaction: vi.fn(),
  endSession: vi.fn(),
  createFeedback: vi.fn(),
  findAllFeedback: vi.fn(),
  countAllFeedback: vi.fn(),
  findByIdFeedback: vi.fn(),
  findByOrderIdFeedback: vi.fn(),
  updateByIdFeedback: vi.fn(),
  getDriverStats: vi.fn(),
  orderGetById: vi.fn(),
  orderGetIdsByWarehouseId: vi.fn(),
  tripGetById: vi.fn(),
  tripGetIdsByWarehouseId: vi.fn(),
  driverUpdateById: vi.fn(),
}));

vi.mock("mongoose", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: {
      ...actual.default,
      startSession: mocks.startSession,
    },
  };
});

vi.mock("../../../src/modules/feedback/feedback.repository.js", () => ({
  default: {
    create: mocks.createFeedback,
    findAll: mocks.findAllFeedback,
    countAll: mocks.countAllFeedback,
    findById: mocks.findByIdFeedback,
    findByOrderId: mocks.findByOrderIdFeedback,
    updateById: mocks.updateByIdFeedback,
    getDriverStats: mocks.getDriverStats,
  },
}));

vi.mock("../../../src/modules/order/order.service.js", () => ({
  default: {
    getById: mocks.orderGetById,
    getIdsByWarehouseId: mocks.orderGetIdsByWarehouseId,
  },
}));

vi.mock("../../../src/modules/trip/trip.service.js", () => ({
  default: {
    getById: mocks.tripGetById,
    getIdsByWarehouseId: mocks.tripGetIdsByWarehouseId,
  },
}));

vi.mock("../../../src/modules/driver/driver.service.js", () => ({
  default: { updateById: mocks.driverUpdateById },
}));

import { FEEDBACK_MESSAGES } from "../../../src/constants/messages.js";
import ROLES from "../../../src/constants/roles.js";
import feedbackService from "../../../src/modules/feedback/feedback.service.js";

const customerId = "507f1f77bcf86cd799439011";
const driverId = "507f1f77bcf86cd799439012";
const orderId = "507f1f77bcf86cd799439013";
const tripId = "507f1f77bcf86cd799439014";
const feedbackId = "507f1f77bcf86cd799439015";

const session = {
  withTransaction: mocks.withTransaction,
  endSession: mocks.endSession,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.startSession.mockResolvedValue(session);
  mocks.withTransaction.mockImplementation(async (callback) => callback());
  mocks.endSession.mockResolvedValue();
  mocks.driverUpdateById.mockResolvedValue({
    _id: driverId,
    rating: 4.7,
    totalReviews: 8,
  });
  mocks.createFeedback.mockResolvedValue({
    _id: feedbackId,
    orderId,
    customerId,
    driverId,
    rating: 5,
    tags: ["friendly"],
    comment: "Great service",
  });
  mocks.findAllFeedback.mockResolvedValue([{ _id: feedbackId, rating: 5 }]);
  mocks.countAllFeedback.mockResolvedValue(1);
  mocks.findByIdFeedback.mockResolvedValue({
    _id: feedbackId,
    orderId,
    customerId,
    driverId,
    status: "visible",
  });
  mocks.findByOrderIdFeedback.mockResolvedValue(null);
  mocks.updateByIdFeedback.mockResolvedValue({
    _id: feedbackId,
    driverResponse: "Thanks for the feedback",
  });
  mocks.getDriverStats.mockResolvedValue({
    averageRating: 4.7,
    totalReviews: 8,
  });
  mocks.orderGetById.mockResolvedValue({
    _id: orderId,
    status: "delivered",
    customerId,
    tripId,
  });
  mocks.tripGetById.mockResolvedValue({
    _id: tripId,
    driverId,
  });
  mocks.orderGetIdsByWarehouseId.mockResolvedValue([orderId]);
  mocks.tripGetIdsByWarehouseId.mockResolvedValue([tripId]);
});

describe("feedbackService.createFeedback", () => {
  it("rejects users who are not customers", async () => {
    await expect(
      feedbackService.createFeedback(
        { orderId, rating: 5 },
        { role: ROLES.DRIVER },
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: FEEDBACK_MESSAGES.CREATE_ACCESS_DENIED,
    });
    expect(mocks.orderGetById).not.toHaveBeenCalled();
  });

  it("rejects a delivered order that does not belong to the customer", async () => {
    mocks.orderGetById.mockResolvedValue({
      _id: orderId,
      status: "delivered",
      customerId: "507f1f77bcf86cd799439099",
      tripId,
    });

    await expect(
      feedbackService.createFeedback(
        { orderId, rating: 5 },
        { role: ROLES.CUSTOMER, customerId },
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: FEEDBACK_MESSAGES.CREATE_ACCESS_DENIED,
    });
    expect(mocks.startSession).not.toHaveBeenCalled();
  });

  it("rejects feedback creation before an order is delivered", async () => {
    mocks.orderGetById.mockResolvedValue({
      _id: orderId,
      status: "in_transit",
      customerId,
      tripId,
    });

    await expect(
      feedbackService.createFeedback(
        { orderId, rating: 5 },
        { role: ROLES.CUSTOMER, customerId },
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: FEEDBACK_MESSAGES.ORDER_NOT_DELIVERED,
    });
    expect(mocks.startSession).not.toHaveBeenCalled();
  });
});

describe("feedbackService.replyFeedback", () => {
  it("allows a driver to reply only to their own feedback", async () => {
    const actor = { role: ROLES.DRIVER, driverId };
    const feedback = { _id: feedbackId, driverId, status: "visible" };
    mocks.findByIdFeedback.mockResolvedValue(feedback);

    await expect(
      feedbackService.replyFeedback(
        feedbackId,
        "Thanks for the feedback",
        actor,
      ),
    ).resolves.toMatchObject({
      _id: feedbackId,
      driverResponse: "Thanks for the feedback",
    });
    expect(mocks.updateByIdFeedback).toHaveBeenCalledWith(feedbackId, {
      driverResponse: "Thanks for the feedback",
    });
  });

  it("denies driver replies to a different driver's feedback", async () => {
    mocks.findByIdFeedback.mockResolvedValue({
      _id: feedbackId,
      status: "visible",
      driverId: "507f1f77bcf86cd799439099",
    });

    await expect(
      feedbackService.replyFeedback(feedbackId, "Response", {
        role: ROLES.DRIVER,
        driverId,
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: FEEDBACK_MESSAGES.REPLY_ACCESS_DENIED,
    });
  });
});

describe("feedbackService.getAll", () => {
  it("returns visible feedbacks filtered by a customer and pagination metadata", async () => {
    const result = await feedbackService.getAll({
      page: 2,
      limit: 5,
      user: { role: ROLES.CUSTOMER, customerId },
    });

    expect(result).toMatchObject({
      feedbacks: [{ _id: feedbackId, rating: 5 }],
      pagination: {
        page: 2,
        limit: 5,
        total: 1,
        totalPages: 1,
      },
    });
    expect(mocks.findAllFeedback).toHaveBeenCalledWith({
      filter: { status: "visible", customerId },
      skip: 5,
      limit: 5,
      sort: { createdAt: -1 },
    });
  });

  it("blocks dispatcher queries without warehouse information", async () => {
    await expect(
      feedbackService.getAll({ user: { role: ROLES.DISPATCHER } }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: FEEDBACK_MESSAGES.VIEW_ACCESS_DENIED,
    });
  });
});

describe("feedbackService.getById", () => {
  it("returns a visible feedback only when the customer owns it", async () => {
    const feedback = {
      _id: feedbackId,
      customerId,
      driverId,
      status: "visible",
    };
    mocks.findByIdFeedback.mockResolvedValue(feedback);

    await expect(
      feedbackService.getById(feedbackId, { role: ROLES.CUSTOMER, customerId }),
    ).resolves.toMatchObject({ _id: feedbackId, customerId });
  });

  it("denies a customer access to feedback belonging to another customer", async () => {
    mocks.findByIdFeedback.mockResolvedValue({
      _id: feedbackId,
      customerId: "507f1f77bcf86cd799439099",
      driverId,
      status: "visible",
    });

    await expect(
      feedbackService.getById(feedbackId, {
        role: ROLES.CUSTOMER,
        customerId,
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: FEEDBACK_MESSAGES.VIEW_ONE_ACCESS_DENIED,
    });
  });
});

describe("feedbackService.getByOrderId", () => {
  it("returns the feedback for a valid order and customer", async () => {
    const feedback = {
      _id: feedbackId,
      orderId,
      customerId,
      driverId,
      status: "visible",
    };
    mocks.findByOrderIdFeedback.mockResolvedValue(feedback);

    await expect(
      feedbackService.getByOrderId(orderId, {
        role: ROLES.CUSTOMER,
        customerId,
      }),
    ).resolves.toMatchObject({ _id: feedbackId, orderId });
  });

  it("rejects when no feedback exists for the order", async () => {
    mocks.findByOrderIdFeedback.mockResolvedValue(null);

    await expect(
      feedbackService.getByOrderId(orderId, {
        role: ROLES.CUSTOMER,
        customerId,
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: FEEDBACK_MESSAGES.ORDER_FEEDBACK_NOT_FOUND,
    });
  });
});
