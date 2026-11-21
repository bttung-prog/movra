const getReferenceId = (value) => {
  return value?._id || value || null;
};

const sameReference = (left, right) => {
  return getReferenceId(left)?.toString() === getReferenceId(right)?.toString();
};

const normalizeAuditValue = (value) => {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (value?._id) return value._id.toString();
  if (
    typeof value === "object" &&
    typeof value.toString === "function" &&
    value.toString() !== "[object Object]"
  ) {
    return value.toString();
  }
  return value;
};

const getAuditChanges = (before, after, fields) => {
  return fields.flatMap((field) => {
    const oldValue = normalizeAuditValue(before?.[field]);
    const newValue = normalizeAuditValue(after?.[field]);
    return JSON.stringify(oldValue) === JSON.stringify(newValue)
      ? []
      : [{ field, oldValue, newValue }];
  });
};

const getTripSnapshot = (trip) => ({
  tripCode: trip.tripCode,
  vehicleId: trip.vehicleId,
  driverId: trip.driverId,
  warehouseId: trip.warehouseId,
  routeId: trip.routeId,
  type: trip.type,
  status: trip.status,
  plannedStart: trip.plannedStart,
  plannedEnd: trip.plannedEnd,
});

export default {
  getReferenceId,
  sameReference,
  normalizeAuditValue,
  getAuditChanges,
  getTripSnapshot,
};
