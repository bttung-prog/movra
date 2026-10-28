import ApiError from "./ApiError.js";
import { WAREHOUSE_MESSAGES } from "../constants/messages.js";

const WAREHOUSE_SCOPED_ROLES = ["warehouse_staff", "dispatcher"];

/**
 * Validates that warehouse-scoped users (warehouse_staff, dispatcher) only access resources
 * belonging to their assigned warehouse. Admins and other authorized roles bypass this check.
 *
 * @param {string|mongoose.Types.ObjectId|object} resourceWarehouseId - Warehouse ID or populated Warehouse object
 * @param {object|null} currentUser - Authenticated user payload from req.user
 * @param {string} errorMessage - Custom error message for ApiError(403)
 */
export const checkWarehouseAccess = (
  resourceWarehouseId,
  currentUser,
  errorMessage = WAREHOUSE_MESSAGES.ACCESS_DENIED,
) => {
  if (currentUser && WAREHOUSE_SCOPED_ROLES.includes(currentUser.role)) {
    if (!currentUser.warehouseId) {
      const message =
        currentUser.role === "dispatcher"
          ? WAREHOUSE_MESSAGES.DISPATCHER_NOT_ASSIGNED
          : WAREHOUSE_MESSAGES.STAFF_NOT_ASSIGNED;
      throw new ApiError(403, message);
    }

    const rawWarehouseId = resourceWarehouseId?._id
      ? resourceWarehouseId._id.toString()
      : resourceWarehouseId?.toString();

    if (!rawWarehouseId) {
      throw new ApiError(403, WAREHOUSE_MESSAGES.INVALID_WAREHOUSE_REF);
    }

    if (rawWarehouseId !== currentUser.warehouseId.toString()) {
      throw new ApiError(403, errorMessage);
    }
  }
};

export default checkWarehouseAccess;
