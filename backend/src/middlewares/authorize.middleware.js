import { COMMON_MESSAGES } from "../constants/messages.js";
import WAREHOUSE_STATUSES from "../constants/warehouseStatuses.js";
import ROLES from "../constants/roles.js";

import ApiError from "../utils/ApiError.js";

import User from "../modules/user/user.js";
import Dispatcher from "../modules/dispatcher/dispatcher.js";
import Driver from "../modules/driver/driver.js";
import Warehouse from "../modules/warehouse/warehouse.js";
import WarehouseStaff from "../modules/staff/staff.js";

const authorizeMiddleware = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.userId || !req.user.role) {
        throw new ApiError(403, COMMON_MESSAGES.FORBIDDEN_DEFAULT);
      }

      const userId = req.user.userId;

      const user = await User.findById(userId).select("role status").lean();
      if (!user || user.status !== "active") {
        throw new ApiError(403, COMMON_MESSAGES.FORBIDDEN);
      }

      let userRole = user.role;
      if (!allowedRoles.includes(userRole)) {
        throw new ApiError(403, COMMON_MESSAGES.FORBIDDEN);
      }

      req.user = { ...req.user, userId, role: userRole };

      if (userRole === ROLES.DRIVER) {
        const driver = await Driver.findOne({ userId }).select("status").lean();
        if (!driver || driver.status !== "active") {
          throw new ApiError(403, COMMON_MESSAGES.FORBIDDEN);
        }
      }

      if (userRole === ROLES.WAREHOUSE_STAFF) {
        const staff = await WarehouseStaff.findOne({ userId })
          .select("_id warehouseId status")
          .lean();

        if (!staff || staff.status !== "active" || !staff.warehouseId) {
          throw new ApiError(403, COMMON_MESSAGES.FORBIDDEN);
        }

        const warehouse = await Warehouse.findById(staff.warehouseId)
          .select("status deletedAt")
          .lean();

        if (
          !warehouse ||
          (warehouse.deletedAt !== null && warehouse.deletedAt !== undefined) ||
          warehouse.status !== WAREHOUSE_STATUSES.ACTIVE
        ) {
          throw new ApiError(403, COMMON_MESSAGES.FORBIDDEN);
        }

        req.user.staffId = staff._id;
        req.user.warehouseId = staff.warehouseId;
      }

      if (userRole === ROLES.DISPATCHER) {
        const dispatcher = await Dispatcher.findOne({ userId })
          .select("_id warehouseId status")
          .lean();

        if (
          !dispatcher ||
          dispatcher.status !== "active" ||
          !dispatcher.warehouseId
        ) {
          throw new ApiError(403, COMMON_MESSAGES.FORBIDDEN);
        }

        const warehouse = await Warehouse.findById(dispatcher.warehouseId)
          .select("status deletedAt")
          .lean();

        if (
          !warehouse ||
          (warehouse.deletedAt !== null && warehouse.deletedAt !== undefined) ||
          warehouse.status !== WAREHOUSE_STATUSES.ACTIVE
        ) {
          throw new ApiError(403, COMMON_MESSAGES.FORBIDDEN);
        }

        req.user.dispatcherId = dispatcher._id;
        req.user.warehouseId = dispatcher.warehouseId;
      }

      return next();
    } catch (error) {
      if (error instanceof ApiError) {
        return next(error);
      }

      return next(error);
    }
  };
};

export default authorizeMiddleware;
