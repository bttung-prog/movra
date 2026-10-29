import express from "express";

import authorize from "../../middlewares/authorize.middleware.js";
import validate from "../../middlewares/validate.middleware.js";

import ROLES from "../../constants/roles.js";

import goodsCategoryValidator from "./goodsCategory.validator.js";
import goodsCategoryController from "./goodsCategory.controller.js";

const goodsCategoryRouter = express.Router();

goodsCategoryRouter.post(
  "/",
  authorize(ROLES.ADMIN),
  validate(goodsCategoryValidator.createGoodsCategorySchema),
  goodsCategoryController.create,
);

goodsCategoryRouter.get(
  "/",
  validate(goodsCategoryValidator.queryGoodsCategorySchema, "query"),
  goodsCategoryController.getAll,
);

goodsCategoryRouter.get(
  "/:goodsCategoryId",
  validate(goodsCategoryValidator.paramGoodsCategoryIdSchema, "params"),
  goodsCategoryController.getById,
);

goodsCategoryRouter.patch(
  "/:goodsCategoryId",
  authorize(ROLES.ADMIN),
  validate(goodsCategoryValidator.paramGoodsCategoryIdSchema, "params"),
  validate(goodsCategoryValidator.updateGoodsCategorySchema),
  goodsCategoryController.updateById,
);

goodsCategoryRouter.delete(
  "/:goodsCategoryId",
  authorize(ROLES.ADMIN),
  validate(goodsCategoryValidator.paramGoodsCategoryIdSchema, "params"),
  goodsCategoryController.deleteById,
);

goodsCategoryRouter.patch(
  "/:goodsCategoryId/restore",
  authorize(ROLES.ADMIN),
  validate(goodsCategoryValidator.paramGoodsCategoryIdSchema, "params"),
  goodsCategoryController.restoreById,
);

export default goodsCategoryRouter;
