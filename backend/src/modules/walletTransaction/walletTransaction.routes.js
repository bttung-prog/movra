import express from "express";

import authorize from "../../middlewares/authorize.middleware.js";
import validate from "../../middlewares/validate.middleware.js";

import ROLES from "../../constants/roles.js";

import walletTransactionValidator from "./walletTransaction.validator.js";
import walletTransactionController from "./walletTransaction.controller.js";

const walletTransactionRouter = express.Router();

walletTransactionRouter.post(
  "/top-up",
  authorize(ROLES.CUSTOMER),
  validate(walletTransactionValidator.topUpSchema),
  walletTransactionController.topUp,
);

walletTransactionRouter.post(
  "/adjustment",
  authorize(ROLES.ADMIN),
  validate(walletTransactionValidator.adjustmentSchema),
  walletTransactionController.adjustWallet,
);

walletTransactionRouter.get(
  "/my-transactions",
  authorize(ROLES.CUSTOMER),
  validate(walletTransactionValidator.queryWalletTransactionSchema, "query"),
  walletTransactionController.getMyTransactions,
);

walletTransactionRouter.get(
  "/code/:code",
  authorize(ROLES.ADMIN, ROLES.CUSTOMER),
  validate(walletTransactionValidator.paramCodeSchema, "params"),
  walletTransactionController.getByCode,
);

walletTransactionRouter.get(
  "/:id",
  authorize(ROLES.ADMIN, ROLES.CUSTOMER),
  validate(walletTransactionValidator.paramIdSchema, "params"),
  walletTransactionController.getById,
);

walletTransactionRouter.get(
  "/",
  authorize(ROLES.ADMIN),
  validate(walletTransactionValidator.queryWalletTransactionSchema, "query"),
  walletTransactionController.getAll,
);

export default walletTransactionRouter;
