import express from "express";

import authorize from "../../middlewares/authorize.middleware.js";
import validate from "../../middlewares/validate.middleware.js";

import ROLES from "../../constants/roles.js";

import staffValidator from "./staff.validator.js";
import staffController from "./staff.controller.js";

const staffRouter = express.Router();

staffRouter.get(
  "/me",
  authorize(ROLES.WAREHOUSE_STAFF),
  staffController.getMyProfile,
);

staffRouter.post(
  "/",
  authorize(ROLES.ADMIN),
  validate(staffValidator.createSchema),
  staffController.create,
);

staffRouter.get(
  "/",
  authorize(ROLES.ADMIN),
  validate(staffValidator.querySchema, "query"),
  staffController.getAll,
);

staffRouter.get(
  "/user/:userId",
  authorize(ROLES.ADMIN),
  validate(staffValidator.paramUserIdSchema, "params"),
  staffController.getByUserId,
);

staffRouter.get(
  "/code/:staffCode",
  authorize(ROLES.ADMIN),
  validate(staffValidator.paramCodeSchema, "params"),
  staffController.getByCode,
);

staffRouter.get(
  "/:staffId",
  authorize(ROLES.ADMIN),
  validate(staffValidator.paramSchema, "params"),
  staffController.getById,
);

staffRouter.patch(
  "/:staffId/transfer",
  authorize(ROLES.ADMIN),
  validate(staffValidator.paramSchema, "params"),
  validate(staffValidator.transferWarehouseSchema),
  staffController.transferWarehouse,
);

staffRouter.patch(
  "/:staffId/restore",
  authorize(ROLES.ADMIN),
  validate(staffValidator.paramSchema, "params"),
  staffController.restoreById,
);

staffRouter.patch(
  "/:staffId",
  authorize(ROLES.ADMIN),
  validate(staffValidator.paramSchema, "params"),
  validate(staffValidator.updateSchema),
  staffController.updateById,
);

staffRouter.delete(
  "/:staffId",
  authorize(ROLES.ADMIN),
  validate(staffValidator.paramSchema, "params"),
  staffController.deleteById,
);

export default staffRouter;
