import express from "express";

import authorize from "../../middlewares/authorize.middleware.js";
import validate from "../../middlewares/validate.middleware.js";

import { ROLES } from "../../constants/roles.js";

import accountantValidator from "./accountant.validator.js";
import accountantController from "./accountant.controller.js";

const accountantRouter = express.Router();

accountantRouter.get(
  "/me",
  authorize(ROLES.ACCOUNTANT),
  accountantController.getMyProfile,
);

accountantRouter.post(
  "/",
  authorize(ROLES.ADMIN),
  validate(accountantValidator.createAccountantSchema),
  accountantController.create,
);

accountantRouter.get(
  "/",
  authorize(ROLES.ADMIN),
  validate(accountantValidator.queryAccountantSchema, "query"),
  accountantController.getAll,
);

accountantRouter.get(
  "/code/:accountantCode",
  authorize(ROLES.ADMIN),
  validate(accountantValidator.paramCodeSchema, "params"),
  accountantController.getByCode,
);

accountantRouter.get(
  "/user/:userId",
  authorize(ROLES.ADMIN),
  validate(accountantValidator.paramUserIdSchema, "params"),
  accountantController.getByUserId,
);

accountantRouter.get(
  "/:accountantId",
  authorize(ROLES.ADMIN),
  validate(accountantValidator.paramAccountantIdSchema, "params"),
  accountantController.getById,
);

accountantRouter.patch(
  "/:accountantId/status",
  authorize(ROLES.ADMIN),
  validate(accountantValidator.paramAccountantIdSchema, "params"),
  validate(accountantValidator.updateStatusSchema),
  accountantController.updateStatus,
);

accountantRouter.delete(
  "/:accountantId",
  authorize(ROLES.ADMIN),
  validate(accountantValidator.paramAccountantIdSchema, "params"),
  accountantController.deleteById,
);

export default accountantRouter;
