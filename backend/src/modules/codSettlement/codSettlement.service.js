import mongoose from "mongoose";

import ROLES from "../../constants/roles.js";
import {
  WALLET_TRANSACTION_TYPES,
  WALLET_TRANSACTION_DIRECTIONS,
} from "../../constants/walletTransactionTypes.js";
import { WALLET_TRANSACTION_STATUSES } from "../../constants/walletTransactionStatuses.js";
import { COD_SETTLEMENT_MESSAGES } from "../../constants/messages.js";

import ApiError from "../../utils/ApiError.js";
import generateCode from "../../utils/generateCode.js";

import orderService from "../order/order.service.js";
import customerService from "../customer/customer.service.js";
import walletTransactionService from "../walletTransaction/walletTransaction.service.js";

import { SETTLEMENT_STATUSES, PAYOUT_METHODS } from "./codSettlement.js";

import codSettlementRepository from "./codSettlement.repository.js";

const generateSettlement = async (payload, actor) => {
  const {
    orderId,
    payoutMethod = PAYOUT_METHODS.WALLET,
    bankDetails = null,
    notes = "",
  } = payload;

  const order = await orderService.getById(orderId, true, actor);

  if (order.status !== "delivered") {
    throw new ApiError(400, COD_SETTLEMENT_MESSAGES.ORDER_NOT_DELIVERED);
  }

  if (!order.codCollected) {
    throw new ApiError(400, COD_SETTLEMENT_MESSAGES.COD_NOT_COLLECTED);
  }

  if (!order.codAmount || order.codAmount <= 0) {
    throw new ApiError(400, COD_SETTLEMENT_MESSAGES.COD_AMOUNT_ZERO);
  }

  if (order.codSettled === true) {
    throw new ApiError(400, COD_SETTLEMENT_MESSAGES.ORDER_ALREADY_SETTLED);
  }

  const codCollectedAmount = Number(order.codCollectedAmount || 0);
  const codRemittedAmount = Number(order.codRemittedAmount || 0);
  if (
    codCollectedAmount < Number(order.codAmount) ||
    codRemittedAmount < Number(order.codAmount)
  ) {
    throw new ApiError(400, COD_SETTLEMENT_MESSAGES.COD_NOT_FULLY_REMITTED);
  }

  const existingSettlement = await codSettlementRepository.findByOrderId(
    order._id,
  );
  if (existingSettlement) {
    throw new ApiError(400, COD_SETTLEMENT_MESSAGES.ORDER_ALREADY_SETTLED);
  }

  const customerId = order.customerId?._id || order.customerId;

  const codAmount = Number(order.codAmount || 0);
  const shippingFee = Number(order.shippingFee || 0);
  const shippingFeePaidAmount = Number(
    order.shippingFeePaidAmount ?? (order.shippingFeePaid ? shippingFee : 0),
  );
  if (shippingFeePaidAmount < shippingFee) {
    throw new ApiError(400, COD_SETTLEMENT_MESSAGES.SHIPPING_FEE_NOT_PAID);
  }

  const claimConditions = {
    codSettled: { $ne: true },
    status: "delivered",
    codCollected: true,
    codCollectedAmount: { $gte: codAmount },
    codRemittedAmount: { $gte: codAmount },
    codAmount: { $gt: 0, $eq: codAmount },
    customerId,
    shippingFee,
    shippingFeePaid:
      order.shippingFeePaid === true ? true : { $in: [null, false] },
    shippingFeePaidAmount:
      order.shippingFeePaidAmount == null
        ? { $in: [null, shippingFeePaidAmount] }
        : shippingFeePaidAmount,
  };
  const netPayoutAmount = Math.min(
    codAmount,
    codCollectedAmount,
    codRemittedAmount,
  );

  const settlementCode = generateCode("SET");

  const settlementData = {
    settlementCode,
    orderId: order._id,
    customerId,
    codAmount,
    netPayoutAmount,
    payoutMethod,
    bankDetails:
      payoutMethod === PAYOUT_METHODS.BANK_TRANSFER ? bankDetails : null,
    status: SETTLEMENT_STATUSES.DRAFT,
    handledBy: actor.userId,
    notes,
  };

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const settlement = await codSettlementRepository.create(
      settlementData,
      session,
    );

    const claimResult = await orderService.claimForCodSettlement(
      [order._id],
      claimConditions,
      session,
    );

    if (claimResult.modifiedCount !== 1) {
      throw new ApiError(409, COD_SETTLEMENT_MESSAGES.ORDER_CLAIM_CONFLICT);
    }

    await session.commitTransaction();
    return settlement;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const confirmSettlement = async (id, actor) => {
  const settlement = await codSettlementRepository.findById(id);
  if (!settlement) {
    throw new ApiError(404, COD_SETTLEMENT_MESSAGES.NOT_FOUND);
  }
  await checkSettlementAccess(settlement, actor);

  if (settlement.status !== SETTLEMENT_STATUSES.DRAFT) {
    throw new ApiError(
      400,
      COD_SETTLEMENT_MESSAGES.CONFIRM_ONLY_DRAFT(settlement.status),
    );
  }

  const updatedSettlement = await codSettlementRepository.updateById(
    id,
    {
      status: SETTLEMENT_STATUSES.CONFIRMED,
      handledBy: actor.userId,
    },
    null,
    { status: { $in: [SETTLEMENT_STATUSES.DRAFT] } },
  );

  if (!updatedSettlement) {
    throw new ApiError(409, COD_SETTLEMENT_MESSAGES.STATUS_CHANGED);
  }

  return updatedSettlement;
};

const completeSettlement = async (id, payload, actor) => {
  const { notes = "", bankTransferReference } = payload;

  const settlement = await codSettlementRepository.findById(id);
  if (!settlement) {
    throw new ApiError(404, COD_SETTLEMENT_MESSAGES.NOT_FOUND);
  }
  await checkSettlementAccess(settlement, actor);

  if (settlement.status !== SETTLEMENT_STATUSES.CONFIRMED) {
    throw new ApiError(
      400,
      COD_SETTLEMENT_MESSAGES.COMPLETE_INVALID_STATUS(settlement.status),
    );
  }

  if (
    settlement.payoutMethod === PAYOUT_METHODS.BANK_TRANSFER &&
    !bankTransferReference?.trim()
  ) {
    throw new ApiError(
      400,
      COD_SETTLEMENT_MESSAGES.BANK_TRANSFER_REFERENCE_REQUIRED,
    );
  }

  if (
    settlement.payoutMethod === PAYOUT_METHODS.BANK_TRANSFER &&
    (!settlement.bankDetails?.bankName ||
      !settlement.bankDetails?.accountNumber ||
      !settlement.bankDetails?.accountHolder)
  ) {
    throw new ApiError(400, COD_SETTLEMENT_MESSAGES.BANK_DETAILS_INCOMPLETE);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const updatedSettlement = await codSettlementRepository.updateById(
      id,
      {
        status: SETTLEMENT_STATUSES.COMPLETED,
        settledAt: new Date(),
        handledBy: actor.userId,
        bankTransferReference:
          settlement.payoutMethod === PAYOUT_METHODS.BANK_TRANSFER
            ? bankTransferReference.trim()
            : null,
        notes: notes
          ? [settlement.notes, COD_SETTLEMENT_MESSAGES.COMPLETION_NOTE(notes)]
              .filter(Boolean)
              .join(" | ")
          : settlement.notes,
      },
      session,
      { status: { $in: [SETTLEMENT_STATUSES.CONFIRMED] } },
    );

    if (!updatedSettlement) {
      throw new ApiError(409, COD_SETTLEMENT_MESSAGES.STATUS_CHANGED);
    }

    if (
      settlement.payoutMethod === PAYOUT_METHODS.WALLET &&
      settlement.netPayoutAmount > 0
    ) {
      const customer = await customerService.getById(
        settlement.customerId._id || settlement.customerId,
        session,
      );

      const balanceBefore = customer.walletBalance || 0;
      const balanceAfter = balanceBefore + settlement.netPayoutAmount;

      await customerService.updateById(
        customer._id,
        {
          $inc: { walletBalance: settlement.netPayoutAmount },
        },
        session,
      );

      await walletTransactionService.recordTransaction(
        {
          customerId: customer._id,
          type: WALLET_TRANSACTION_TYPES.COD_PAYOUT,
          direction: WALLET_TRANSACTION_DIRECTIONS.CREDIT,
          amount: settlement.netPayoutAmount,
          balanceBefore,
          balanceAfter,
          settlementId: settlement._id,
          orderId: settlement.orderId?._id || settlement.orderId,
          reason: COD_SETTLEMENT_MESSAGES.WALLET_PAYOUT_REASON,
          handledBy: actor.userId,
          status: WALLET_TRANSACTION_STATUSES.SUCCESS,
          notes: COD_SETTLEMENT_MESSAGES.WALLET_PAYOUT_REASON,
        },
        session,
      );
    }

    await session.commitTransaction();
    return updatedSettlement;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const cancelSettlement = async (id, reason, actor) => {
  const settlement = await codSettlementRepository.findById(id);
  if (!settlement) {
    throw new ApiError(404, COD_SETTLEMENT_MESSAGES.NOT_FOUND);
  }
  await checkSettlementAccess(settlement, actor);

  if (settlement.status === SETTLEMENT_STATUSES.COMPLETED) {
    throw new ApiError(400, COD_SETTLEMENT_MESSAGES.CANNOT_CANCEL_COMPLETED);
  }

  if (settlement.status === SETTLEMENT_STATUSES.CANCELLED) {
    throw new ApiError(400, COD_SETTLEMENT_MESSAGES.ALREADY_CANCELLED);
  }

  const settlementOrderId = settlement.orderId?._id || settlement.orderId;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const updatedSettlement = await codSettlementRepository.updateById(
      id,
      {
        status: SETTLEMENT_STATUSES.CANCELLED,
        handledBy: actor.userId,
        notes: [settlement.notes, COD_SETTLEMENT_MESSAGES.CANCEL_REASON(reason)]
          .filter(Boolean)
          .join(" | "),
      },
      session,
      {
        status: {
          $in: [SETTLEMENT_STATUSES.DRAFT, SETTLEMENT_STATUSES.CONFIRMED],
        },
      },
    );

    if (!updatedSettlement) {
      throw new ApiError(409, COD_SETTLEMENT_MESSAGES.STATUS_CHANGED);
    }

    await orderService.releaseCodSettlement([settlementOrderId], session);
    await session.commitTransaction();
    return updatedSettlement;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const getAll = async ({
  filter = {},
  page = 1,
  limit = 10,
  sort = { createdAt: -1 },
  actor = null,
} = {}) => {
  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const limitNumber = Math.max(1, parseInt(limit, 10) || 10);
  const skip = (pageNumber - 1) * limitNumber;

  let queryFilter = filter;
  if (actor?.role === ROLES.DISPATCHER) {
    const orderIds = await orderService.getIdsByWarehouseId(actor.warehouseId);
    queryFilter = { $and: [filter, { orderId: { $in: orderIds } }] };
  }

  const [settlements, total] = await Promise.all([
    codSettlementRepository.findAll({
      filter: queryFilter,
      skip,
      limit: limitNumber,
      sort,
    }),
    codSettlementRepository.countAll({ filter: queryFilter }),
  ]);

  return {
    settlements,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages: Math.ceil(total / limitNumber),
    },
  };
};

const checkSettlementAccess = async (settlement, actor) => {
  if (actor?.role === ROLES.CUSTOMER) {
    const sCustomerId = (
      settlement.customerId._id || settlement.customerId
    ).toString();
    if (!actor.customerId || sCustomerId !== actor.customerId.toString()) {
      throw new ApiError(403, COD_SETTLEMENT_MESSAGES.ACCESS_DENIED);
    }
  }

  if (actor?.role === ROLES.DISPATCHER) {
    const orderId = settlement.orderId?._id || settlement.orderId;
    if (!orderId) {
      throw new ApiError(403, COD_SETTLEMENT_MESSAGES.ACCESS_DENIED);
    }
    await orderService.getById(orderId, true, actor);
  }
};

const getById = async (id, actor = null) => {
  const settlement = await codSettlementRepository.findById(id);
  if (!settlement) {
    throw new ApiError(404, COD_SETTLEMENT_MESSAGES.NOT_FOUND);
  }

  await checkSettlementAccess(settlement, actor);

  return settlement;
};

const getByCode = async (code, actor = null) => {
  const settlement = await codSettlementRepository.findByCode(code);
  if (!settlement) {
    throw new ApiError(404, COD_SETTLEMENT_MESSAGES.NOT_FOUND);
  }

  await checkSettlementAccess(settlement, actor);

  return settlement;
};

export default {
  generateSettlement,
  confirmSettlement,
  completeSettlement,
  cancelSettlement,
  getAll,
  getById,
  getByCode,
};
