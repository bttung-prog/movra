import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findAll: vi.fn(),
  countAll: vi.fn(),
  findById: vi.fn(),
  findByIssueCode: vi.fn(),
  findByOrderId: vi.fn(),
  findByTripId: vi.fn(),
  countByTripId: vi.fn(),
  updateById: vi.fn(),
  cancelAtomic: vi.fn(),
  getTripById: vi.fn(),
  getOrderById: vi.fn(),
  getWarehouseById: vi.fn(),
  getCategoryById: vi.fn(),
  getUserById: vi.fn(),
  getInventoryByWarehouseAndOrder: vi.fn(),
  markAsIssuedByOrderId: vi.fn(),
  markAsInStockAtomic: vi.fn(),
  generateCode: vi.fn(),
  startSession: vi.fn(),
  startTransaction: vi.fn(),
  commitTransaction: vi.fn(),
  abortTransaction: vi.fn(),
  endSession: vi.fn(),
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

vi.mock("../../../src/modules/issue/issue.repository.js", () => ({
  default: {
    create: mocks.create,
    findAll: mocks.findAll,
    countAll: mocks.countAll,
    findById: mocks.findById,
    findByIssueCode: mocks.findByIssueCode,
    findByOrderId: mocks.findByOrderId,
    findByTripId: mocks.findByTripId,
    countByTripId: mocks.countByTripId,
    updateById: mocks.updateById,
    cancelAtomic: mocks.cancelAtomic,
  },
}));

vi.mock("../../../src/modules/trip/trip.service.js", () => ({
  default: { getById: mocks.getTripById },
}));

vi.mock("../../../src/modules/order/order.service.js", () => ({
  default: { getById: mocks.getOrderById },
}));

vi.mock("../../../src/modules/warehouse/warehouse.service.js", () => ({
  default: { getById: mocks.getWarehouseById },
}));

vi.mock("../../../src/modules/goodsCategory/goodsCategory.service.js", () => ({
  default: { getById: mocks.getCategoryById },
}));

vi.mock("../../../src/modules/user/user.service.js", () => ({
  default: { getById: mocks.getUserById },
}));

vi.mock("../../../src/modules/inventory/inventory.service.js", () => ({
  default: {
    getByWarehouseAndOrder: mocks.getInventoryByWarehouseAndOrder,
    markAsIssuedByOrderId: mocks.markAsIssuedByOrderId,
    markAsInStockAtomic: mocks.markAsInStockAtomic,
  },
}));

vi.mock("../../../src/utils/generateCode.js", () => ({
  default: mocks.generateCode,
}));

import {
  ISSUE_MESSAGES,
  WAREHOUSE_MESSAGES,
} from "../../../src/constants/messages.js";
import INVENTORY_STATUSES from "../../../src/constants/inventoryStatuses.js";
import ISSUE_STATUSES from "../../../src/constants/issueStatuses.js";
import ROLES from "../../../src/constants/roles.js";
import TRIP_TYPES from "../../../src/constants/tripTypes.js";
import issueService from "../../../src/modules/issue/issue.service.js";

const issueId = "issue-1";
const orderId = "order-1";
const tripId = "trip-1";
const warehouseId = "warehouse-1";
const categoryId = "category-1";
const issuedBy = "user-1";
const issue = {
  _id: issueId,
  issueCode: "IS-0001",
  orderId,
  warehouseId,
  tripId,
  goodsCategoryId: categoryId,
  issuedBy,
  quantity: 2,
  status: ISSUE_STATUSES.COMPLETED,
  note: "",
};
const session = {
  startTransaction: mocks.startTransaction,
  commitTransaction: mocks.commitTransaction,
  abortTransaction: mocks.abortTransaction,
  endSession: mocks.endSession,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.startSession.mockResolvedValue(session);
  mocks.findById.mockResolvedValue(issue);
  mocks.findByIssueCode.mockResolvedValue(issue);
  mocks.findByOrderId.mockResolvedValue(issue);
  mocks.findAll.mockResolvedValue([issue]);
  mocks.countAll.mockResolvedValue(21);
  mocks.findByTripId.mockResolvedValue([issue]);
  mocks.countByTripId.mockResolvedValue(11);
  mocks.updateById.mockResolvedValue(issue);
  mocks.cancelAtomic.mockResolvedValue({
    ...issue,
    status: ISSUE_STATUSES.CANCELLED,
  });
  mocks.getTripById.mockResolvedValue({
    _id: tripId,
    status: "planned",
    type: TRIP_TYPES.DELIVERY,
    driverId: "driver-1",
  });
  mocks.getOrderById.mockResolvedValue({
    _id: orderId,
    status: "stored",
    tripId,
  });
  mocks.getWarehouseById.mockResolvedValue({
    _id: warehouseId,
    managerId: "manager-1",
  });
  mocks.getInventoryByWarehouseAndOrder.mockResolvedValue({
    _id: "inventory-1",
    warehouseId,
    orderId,
    goodsCategoryId: categoryId,
    quantity: 2,
    status: INVENTORY_STATUSES.IN_STOCK,
    condition: "good",
    deletedAt: null,
  });
  mocks.markAsIssuedByOrderId.mockResolvedValue(true);
  mocks.markAsInStockAtomic.mockResolvedValue(true);
  mocks.generateCode.mockReturnValue("IS-0001");
});

describe("issueService.create", () => {
  it("rejects non-positive quantity and unauthorized warehouse staff", async () => {
    await expect(
      issueService.create({
        orderId,
        warehouseId,
        tripId,
        issuedBy,
        quantity: 0,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: ISSUE_MESSAGES.QTY_GREATER_THAN_ZERO,
    });

    await expect(
      issueService.create(
        { orderId, warehouseId, tripId, issuedBy, quantity: 2 },
        { role: ROLES.WAREHOUSE_STAFF },
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: ISSUE_MESSAGES.STAFF_NOT_ASSIGNED,
    });
    expect(mocks.getTripById).not.toHaveBeenCalled();
  });

  it("rejects invalid trip/order states and trip assignment mismatches", async () => {
    mocks.getTripById.mockResolvedValueOnce({
      status: "completed",
      type: TRIP_TYPES.DELIVERY,
    });
    await expect(
      issueService.create({
        orderId,
        warehouseId,
        tripId,
        issuedBy,
        quantity: 2,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: ISSUE_MESSAGES.TRIP_STATUS_INVALID("completed"),
    });

    mocks.getOrderById.mockResolvedValueOnce({
      status: "created",
      tripId,
    });
    await expect(
      issueService.create({
        orderId,
        warehouseId,
        tripId,
        issuedBy,
        quantity: 2,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: ISSUE_MESSAGES.ORDER_STATUS_NOT_STORED("created"),
    });

    mocks.getOrderById.mockResolvedValueOnce({
      status: "stored",
      tripId: "another-trip",
    });
    await expect(
      issueService.create({
        orderId,
        warehouseId,
        tripId,
        issuedBy,
        quantity: 2,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: ISSUE_MESSAGES.ORDER_ASSIGNED_DIFFERENT_TRIP,
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects orders that have not been assigned to a trip", async () => {
    mocks.getOrderById.mockResolvedValue({
      status: "stored",
      tripId: null,
    });

    await expect(
      issueService.create({
        orderId,
        warehouseId,
        tripId,
        issuedBy,
        quantity: 2,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: ISSUE_MESSAGES.ORDER_NOT_ASSIGNED_TRIP,
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

describe("issueService.getAll and getByTripId", () => {
  it("filters issue lists and applies warehouse scope with pagination", async () => {
    const result = await issueService.getAll(
      {
        page: 2,
        limit: 5,
        issueCode: " IS+1 ",
        orderId,
        status: ISSUE_STATUSES.COMPLETED,
        fromDate: "2026-01-01",
        toDate: "2026-01-31",
        sortBy: "quantity",
        sortOrder: "asc",
      },
      { role: ROLES.WAREHOUSE_STAFF, warehouseId },
    );

    const filter = mocks.findAll.mock.calls[0][0].filter;
    expect(filter).toMatchObject({
      warehouseId,
      orderId,
      status: ISSUE_STATUSES.COMPLETED,
      issueCode: { $regex: "IS\\+1", $options: "i" },
      issuedAt: {
        $gte: new Date("2026-01-01T00:00:00.000Z"),
        $lte: new Date("2026-01-31T23:59:59.999Z"),
      },
    });
    expect(mocks.findAll).toHaveBeenCalledWith({
      filter,
      skip: 5,
      limit: 5,
      sort: { quantity: 1 },
    });
    expect(mocks.countAll).toHaveBeenCalledWith({ filter });
    expect(result.pagination).toEqual({
      page: 2,
      limit: 5,
      total: 21,
      totalPages: 5,
    });
  });

  it("authorizes drivers and scopes trip issue pagination", async () => {
    mocks.getTripById.mockResolvedValue({
      _id: tripId,
      driverId: { _id: "driver-1", userId: "driver-user" },
    });

    const result = await issueService.getByTripId(
      tripId,
      { page: 2, limit: 5 },
      { role: ROLES.DRIVER, driverId: "driver-1" },
    );

    expect(mocks.findByTripId).toHaveBeenCalledWith(tripId, {
      skip: 5,
      limit: 5,
      sort: { createdAt: -1 },
      filter: {},
    });
    expect(result.pagination).toMatchObject({ page: 2, limit: 5, total: 11 });
  });

  it("denies unrelated drivers and requires warehouse assignment", async () => {
    mocks.getTripById.mockResolvedValueOnce({
      driverId: { _id: "assigned-driver", userId: "assigned-user" },
    });
    await expect(
      issueService.getByTripId(
        tripId,
        {},
        { role: ROLES.DRIVER, driverId: "other-driver" },
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: WAREHOUSE_MESSAGES.ACCESS_DENIED,
    });

    await expect(
      issueService.getByTripId(tripId, {}, { role: ROLES.WAREHOUSE_STAFF }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: WAREHOUSE_MESSAGES.STAFF_NOT_ASSIGNED,
    });
  });
});

describe("issueService lookup and note updates", () => {
  it("returns issues by ID, code, and order", async () => {
    await expect(issueService.getById(issueId)).resolves.toBe(issue);
    await expect(issueService.getByCode("IS-0001")).resolves.toBe(issue);
    await expect(issueService.getByOrderId(orderId)).resolves.toBe(issue);
  });

  it("denies access outside the assigned warehouse and reports missing issues", async () => {
    await expect(
      issueService.getById(issueId, {
        role: ROLES.WAREHOUSE_STAFF,
        warehouseId: "another-warehouse",
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: WAREHOUSE_MESSAGES.ACCESS_DENIED,
    });

    mocks.findById.mockResolvedValueOnce(null);
    await expect(issueService.getById(issueId)).rejects.toMatchObject({
      statusCode: 404,
      message: ISSUE_MESSAGES.NOT_FOUND,
    });
  });

  it("updates notes conditionally and rejects cancelled issues", async () => {
    await issueService.updateNote(issueId, { note: "Revised note" });

    expect(mocks.updateById).toHaveBeenCalledWith(
      issueId,
      { note: "Revised note" },
      null,
      { status: { $ne: ISSUE_STATUSES.CANCELLED } },
    );

    mocks.findById.mockResolvedValueOnce({
      ...issue,
      status: ISSUE_STATUSES.CANCELLED,
    });
    await expect(
      issueService.updateNote(issueId, { note: "Revised" }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: ISSUE_MESSAGES.CANNOT_UPDATE_CANCELLED,
    });
  });
});

describe("issueService.cancel", () => {
  it("requires authorization for warehouse staff cancellation", async () => {
    await expect(
      issueService.cancel(
        issueId,
        {},
        {
          role: ROLES.WAREHOUSE_STAFF,
          userId: "other-user",
          warehouseId,
        },
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: ISSUE_MESSAGES.CANCEL_NOT_AUTHORIZED,
    });
    expect(mocks.startSession).not.toHaveBeenCalled();
  });

  it("rejects cancellation of an issue that is already cancelled", async () => {
    mocks.findById.mockResolvedValue({
      ...issue,
      status: ISSUE_STATUSES.CANCELLED,
    });
    await expect(
      issueService.cancel(issueId, { note: "Cancel" }, { role: ROLES.ADMIN }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: ISSUE_MESSAGES.ALREADY_CANCELLED,
    });
    expect(mocks.startSession).not.toHaveBeenCalled();
  });
});
