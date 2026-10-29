import express from "express";

import authorize from "../../middlewares/authorize.middleware.js";
import validate from "../../middlewares/validate.middleware.js";

import ROLES from "../../constants/roles.js";

import pricingValidator from "./pricing.validator.js";
import pricingController from "./pricing.controller.js";

const pricingRouter = express.Router();

pricingRouter.post(
  "/calculate",
  validate(pricingValidator.calculateFeeSchema),
  pricingController.calculate,
);

pricingRouter.get(
  "/rates",
  validate(pricingValidator.queryRateSchema, "query"),
  pricingController.getAllRates,
);

pricingRouter.get(
  "/rates/:id",
  validate(pricingValidator.paramIdSchema, "params"),
  pricingController.getRateById,
);

pricingRouter.post(
  "/rates",
  authorize(ROLES.ADMIN),
  validate(pricingValidator.createShippingRateSchema),
  pricingController.createRate,
);

pricingRouter.put(
  "/rates/:id",
  authorize(ROLES.ADMIN),
  validate(pricingValidator.paramIdSchema, "params"),
  validate(pricingValidator.updateShippingRateSchema),
  pricingController.updateRate,
);

pricingRouter.delete(
  "/rates/:id",
  authorize(ROLES.ADMIN),
  validate(pricingValidator.paramIdSchema, "params"),
  pricingController.deleteRate,
);

export default pricingRouter;
