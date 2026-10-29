import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findAll: vi.fn(),
  countAll: vi.fn(),
  findById: vi.fn(),
  findByCode: vi.fn(),
  findByOrderId: vi.fn(),
  updateById: vi.fn(),
  getOrderById: vi.fn(),
  getOrderIdsByWarehouseId: vi.fn(),
  claimForCodSettlement: vi.fn(),
  releaseCodSettlement: vi.fn(),
  getCustomerById: vi.fn(),
  updateCustomerById: vi.fn(),
  recordTransaction: vi.fn(),
  generateCode: vi.fn(),
}));

vi.mock(
  "../../../src/modules/codSettlement/codSettlement.repository.js",
  () => ({
    default: {
      create: mocks.create,
      findAll: mocks.findAll,
      countAll: mocks.countAll,
      findById: mocks.findById,
      findByCode: mocks.findByCode,
      findByOrderId: mocks.findByOrderId,
      updateById: mocks.updateById,
    },
  }),
);

vi.mock("../../../src/modules/order/order.service.js", () => ({
  default: {
    getById: mocks.getOrderById,
    getIdsByWarehouseId: mocks.getOrderIdsByWarehouseId,
    claimForCodSettlement: mocks.claimForCodSettlement,
    releaseCodSettlement: mocks.releaseCodSettlement,
  },
}));

vi.mock("../../../src/modules/customer/customer.service.js", () => ({
  default: {
    getById: mocks.getCustomerById,
    updateById: mocks.updateCustomerById,
  },
}));

vi.mock(
  "../../../src/modules/walletTransaction/walletTransaction.service.js",
  () => ({
    default: { recordTransaction: mocks.recordTransaction },
  }),
);

vi.mock("../../../src/utils/generateCode.js", () => ({
  default: mocks.generateCode,
}));

import { COD_SETTLEMENT_MESSAGES } from "../../../src/constants/messages.js";
import ROLES from "../../../src/constants/roles.js";
import codSettlementService from "../../../src/modules/codSettlement/codSettlement.service.js";
import {
  PAYOUT_METHODS,
  SETTLEMENT_STATUSES,
} from "../../../src/modules/codSettlement/codSettlement.js";

const settlementId = "settlement-1";
const orderId = "order-1";
const customerId = "customer-1";
const actor = { userId: "admin-1", role: ROLES.ADMIN };

const draftSettlement = {
  _id: settlementId,
  settlementCode: "SET-0001",
  orderId,
  customerId,
  status: SETTLEMENT_STATUSES.DRAFT,
  payoutMethod: PAYOUT_METHODS.WALLET,
  codAmount: 5000,
  netPayoutAmount: 5000,
  notes: "",
};

const eligibleOrder = {
  _id: orderId,
  customerId,
  status: "delivered",
  codCollected: true,
  codAmount: 5000,
  codCollectedAmount: 5000,
  codRemittedAmount: 5000,
  codSettled: false,
  shippingFee: 1000,
  shippingFeePaidAmount: 1000,
  shippingFeePaid: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.generateCode.mockReturnValue("SET-0001");
  mocks.getOrderById.mockResolvedValue(eligibleOrder);
  mocks.findByOrderId.mockResolvedValue(null);
  mocks.create.mockResolvedValue(draftSettlement);
  mocks.findAll.mockResolvedValue([draftSettlement]);
  mocks.countAll.mockResolvedValue(1);
  mocks.findById.mockResolvedValue(draftSettlement);
  mocks.findByCode.mockResolvedValue(draftSettlement);
  mocks.updateById.mockResolvedValue({
    ...draftSettlement,
    status: SETTLEMENT_STATUSES.CONFIRMED,
  });
});

describe("codSettlementService.generateSettlement", () => {
  it.each([
    [
      "order not delivered",
      { ...eligibleOrder, status: "in_transit" },
      COD_SETTLEMENT_MESSAGES.ORDER_NOT_DELIVERED,
    ],
    [
      "COD not collected",
      { ...eligibleOrder, codCollected: false },
      COD_SETTLEMENT_MESSAGES.COD_NOT_COLLECTED,
    ],
    [
      "order without a positive COD amount",
      { ...eligibleOrder, codAmount: 0 },
      COD_SETTLEMENT_MESSAGES.COD_AMOUNT_ZERO,
    ],
    [
      "COD not fully remitted",
      { ...eligibleOrder, codRemittedAmount: 4000 },
      COD_SETTLEMENT_MESSAGES.COD_NOT_FULLY_REMITTED,
    ],
    [
      "shipping fee not paid",
      { ...eligibleOrder, shippingFeePaidAmount: 0, shippingFeePaid: false },
      COD_SETTLEMENT_MESSAGES.SHIPPING_FEE_NOT_PAID,
    ],
  ])("rejects an order when %s", async (_case, order, message) => {
    mocks.getOrderById.mockResolvedValue(order);

    await expect(
      codSettlementService.generateSettlement({ orderId }, actor),
    ).rejects.toMatchObject({ statusCode: 400, message });

    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects an order that already has an active settlement", async () => {
    mocks.findByOrderId.mockResolvedValue(draftSettlement);

    await expect(
      codSettlementService.generateSettlement({ orderId }, actor),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: COD_SETTLEMENT_MESSAGES.ORDER_ALREADY_SETTLED,
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

describe("codSettlementService.confirmSettlement", () => {
  it("confirms a draft settlement with an atomic draft-only condition", async () => {
    const result = await codSettlementService.confirmSettlement(
      settlementId,
      actor,
    );

    expect(result.status).toBe(SETTLEMENT_STATUSES.CONFIRMED);
    expect(mocks.updateById).toHaveBeenCalledWith(
      settlementId,
      {
        status: SETTLEMENT_STATUSES.CONFIRMED,
        handledBy: actor.userId,
      },
      null,
      { status: { $in: [SETTLEMENT_STATUSES.DRAFT] } },
    );
  });

  it("rejects non-draft settlements and reports concurrent status changes", async () => {
    mocks.findById.mockResolvedValueOnce({
      ...draftSettlement,
      status: SETTLEMENT_STATUSES.CONFIRMED,
    });
    await expect(
      codSettlementService.confirmSettlement(settlementId, actor),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: COD_SETTLEMENT_MESSAGES.CONFIRM_ONLY_DRAFT(
        SETTLEMENT_STATUSES.CONFIRMED,
      ),
    });

    mocks.findById.mockResolvedValueOnce(draftSettlement);
    mocks.updateById.mockResolvedValueOnce(null);
    await expect(
      codSettlementService.confirmSettlement(settlementId, actor),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: COD_SETTLEMENT_MESSAGES.STATUS_CHANGED,
    });
  });
});

describe("codSettlementService.completeSettlement", () => {
  it("requires a confirmed settlement before completion", async () => {
    await expect(
      codSettlementService.completeSettlement(settlementId, {}, actor),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: COD_SETTLEMENT_MESSAGES.COMPLETE_INVALID_STATUS(
        SETTLEMENT_STATUSES.DRAFT,
      ),
    });
  });

  it("requires a bank transfer reference for bank payouts", async () => {
    mocks.findById.mockResolvedValue({
      ...draftSettlement,
      status: SETTLEMENT_STATUSES.CONFIRMED,
      payoutMethod: PAYOUT_METHODS.BANK_TRANSFER,
      bankDetails: {
        bankName: "Example Bank",
        accountNumber: "123456",
        accountHolder: "Customer",
      },
    });

    await expect(
      codSettlementService.completeSettlement(settlementId, {}, actor),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: COD_SETTLEMENT_MESSAGES.BANK_TRANSFER_REFERENCE_REQUIRED,
    });
  });
});

describe("codSettlementService.cancelSettlement", () => {
  it("does not allow cancellation of completed or already cancelled settlements", async () => {
    mocks.findById.mockResolvedValueOnce({
      ...draftSettlement,
      status: SETTLEMENT_STATUSES.COMPLETED,
    });
    await expect(
      codSettlementService.cancelSettlement(settlementId, "Duplicate", actor),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: COD_SETTLEMENT_MESSAGES.CANNOT_CANCEL_COMPLETED,
    });

    mocks.findById.mockResolvedValueOnce({
      ...draftSettlement,
      status: SETTLEMENT_STATUSES.CANCELLED,
    });
    await expect(
      codSettlementService.cancelSettlement(settlementId, "Duplicate", actor),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: COD_SETTLEMENT_MESSAGES.ALREADY_CANCELLED,
    });
  });
});

describe("codSettlementService.getAll", () => {
  it("paginates settlements and applies dispatcher warehouse scope", async () => {
    const dispatcher = {
      role: ROLES.DISPATCHER,
      warehouseId: "warehouse-1",
    };
    mocks.getOrderIdsByWarehouseId.mockResolvedValue([orderId]);

    const result = await codSettlementService.getAll({
      filter: { status: SETTLEMENT_STATUSES.DRAFT },
      page: 2,
      limit: 5,
      actor: dispatcher,
    });

    const filter = {
      $and: [
        { status: SETTLEMENT_STATUSES.DRAFT },
        { orderId: { $in: [orderId] } },
      ],
    };
    expect(mocks.getOrderIdsByWarehouseId).toHaveBeenCalledWith(
      dispatcher.warehouseId,
    );
    expect(mocks.findAll).toHaveBeenCalledWith({
      filter,
      skip: 5,
      limit: 5,
      sort: { createdAt: -1 },
    });
    expect(mocks.countAll).toHaveBeenCalledWith({ filter });
    expect(result.pagination).toEqual({
      page: 2,
      limit: 5,
      total: 1,
      totalPages: 1,
    });
  });
});

describe("codSettlementService settlement access", () => {
  it("allows a customer to access their own settlement", async () => {
    await expect(
      codSettlementService.getById(settlementId, {
        role: ROLES.CUSTOMER,
        customerId,
      }),
    ).resolves.toBe(draftSettlement);
  });

  it("denies access to another customer's settlement", async () => {
    await expect(
      codSettlementService.getByCode("SET-0001", {
        role: ROLES.CUSTOMER,
        customerId: "another-customer",
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: COD_SETTLEMENT_MESSAGES.ACCESS_DENIED,
    });
  });

  it("returns not found for unknown settlements", async () => {
    mocks.findById.mockResolvedValue(null);
    mocks.findByCode.mockResolvedValue(null);

    await expect(
      codSettlementService.getById(settlementId),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: COD_SETTLEMENT_MESSAGES.NOT_FOUND,
    });
    await expect(
      codSettlementService.getByCode("MISSING"),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: COD_SETTLEMENT_MESSAGES.NOT_FOUND,
    });
  });
});
