import express from "express";

import authorize from "../../middlewares/authorize.middleware.js";
import validate from "../../middlewares/validate.middleware.js";

import ROLES from "../../constants/roles.js";

import routeValidator from "./route.validator.js";
import routeController from "./route.controller.js";

const routeRouter = express.Router();

routeRouter.post(
  "/",
  authorize(ROLES.ADMIN),
  validate(routeValidator.createSchema),
  routeController.create,
);

routeRouter.get(
  "/",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  validate(routeValidator.querySchema, "query"),
  routeController.getAll,
);

routeRouter.get(
  "/:routeId",
  authorize(ROLES.ADMIN, ROLES.DISPATCHER),
  validate(routeValidator.paramSchema, "params"),
  routeController.getById,
);

routeRouter.patch(
  "/:routeId",
  authorize(ROLES.ADMIN),
  validate(routeValidator.paramSchema, "params"),
  validate(routeValidator.updateSchema),
  routeController.updateById,
);

routeRouter.delete(
  "/:routeId",
  authorize(ROLES.ADMIN),
  validate(routeValidator.paramSchema, "params"),
  routeController.deleteById,
);

routeRouter.patch(
  "/:routeId/restore",
  authorize(ROLES.ADMIN),
  validate(routeValidator.paramSchema, "params"),
  routeController.restoreById,
);

export default routeRouter;
