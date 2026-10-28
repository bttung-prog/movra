import express from "express";

import authorize from "../../middlewares/authorize.middleware.js";
import validate from "../../middlewares/validate.middleware.js";

import ROLES from "../../constants/roles.js";

import driverValidator from "./driver.validator.js";
import driverController from "./driver.controller.js";

const driverRouter = express.Router();

driverRouter.get("/me", authorize(ROLES.DRIVER), driverController.getMyProfile);

driverRouter.post(
  "/",
  authorize(ROLES.ADMIN),
  validate(driverValidator.createSchema),
  driverController.create,
);

driverRouter.get(
  "/",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  validate(driverValidator.getAllSchema, "query"),
  driverController.getAll,
);

driverRouter.get(
  "/code/:driverCode",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  validate(driverValidator.driverCodeParamSchema, "params"),
  driverController.getByCode,
);

driverRouter.get(
  "/:driverId",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  validate(driverValidator.driverIdParamSchema, "params"),
  driverController.getById,
);

driverRouter.patch(
  "/:driverId/renew-license",
  authorize(ROLES.ADMIN),
  validate(driverValidator.driverIdParamSchema, "params"),
  validate(driverValidator.renewLicenseSchema),
  driverController.renewLicense,
);

driverRouter.patch(
  "/:driverId",
  authorize(ROLES.ADMIN),
  validate(driverValidator.driverIdParamSchema, "params"),
  validate(driverValidator.updateSchema),
  driverController.update,
);

driverRouter.delete(
  "/:driverId",
  authorize(ROLES.ADMIN),
  validate(driverValidator.driverIdParamSchema, "params"),
  driverController.remove,
);

export default driverRouter;
