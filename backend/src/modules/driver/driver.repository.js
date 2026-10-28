import Driver from "./driver.js";

const create = (data, session) => {
  return Driver.create([data], { session }).then((docs) => docs[0]);
};

const findAll = ({ filter = {}, skip, limit }) => {
  return Driver.find(filter)
    .populate("userId", "email fullName phone")
    .populate("warehouseId", "warehouseName warehouseAddress")
    .populate("currentVehicleId", "plateNumber brand model")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

const countAll = (filter = {}) => {
  return Driver.countDocuments(filter);
};

const countActiveByWarehouseId = (warehouseId) => {
  return Driver.countDocuments({ warehouseId, status: "active" });
};

const findVehicleIdsByWarehouseId = (warehouseId) => {
  return Driver.distinct("currentVehicleId", {
    warehouseId,
    currentVehicleId: { $ne: null },
  });
};

const findIdsByWarehouseId = (warehouseId) => {
  return Driver.distinct("_id", { warehouseId });
};

const findByCurrentVehicleId = (vehicleId) => {
  return Driver.findOne({ currentVehicleId: vehicleId })
    .select("_id warehouseId")
    .lean();
};

const findById = (driverId, session = null) => {
  return Driver.findById(driverId, null, { session })
    .populate("userId", "email fullName phone")
    .populate("warehouseId", "warehouseName warehouseAddress")
    .populate("currentVehicleId", "plateNumber brand model")
    .lean();
};

const updateById = (driverId, updateData, session = null) => {
  const { currentVehicleId, ...fieldsToUpdate } = updateData;
  const update =
    currentVehicleId === null
      ? {
          ...(Object.keys(fieldsToUpdate).length > 0
            ? { $set: fieldsToUpdate }
            : {}),
          $unset: { currentVehicleId: 1 },
        }
      : updateData;

  return Driver.findByIdAndUpdate(driverId, update, {
    new: true,
    runValidators: true,
    session,
  })
    .populate("userId", "email fullName phone")
    .populate("warehouseId", "warehouseName warehouseAddress")
    .populate("currentVehicleId", "plateNumber brand model")
    .lean();
};

const deleteById = (driverId, session = null) => {
  return Driver.findByIdAndUpdate(
    driverId,
    { $set: { status: "inactive" }, $unset: { currentVehicleId: 1 } },
    { new: true, session },
  )
    .populate("userId", "email fullName phone")
    .populate("warehouseId", "warehouseName warehouseAddress")
    .populate("currentVehicleId", "plateNumber brand model")
    .lean();
};

const findByCode = (driverCode) => {
  return Driver.findOne({ driverCode })
    .populate("userId", "email fullName phone")
    .populate("warehouseId", "warehouseName warehouseAddress")
    .populate("currentVehicleId", "plateNumber brand model")
    .lean();
};

const renewLicense = (driverId, newExpiryDate) => {
  return Driver.findByIdAndUpdate(
    driverId,
    { licenseExpiryDate: newExpiryDate },
    { new: true, runValidators: true },
  )
    .populate("userId", "email fullName phone")
    .populate("warehouseId", "warehouseName warehouseAddress")
    .populate("currentVehicleId", "plateNumber brand model")
    .lean();
};

const findByUserId = (userId, session = null) => {
  return Driver.findOne({ userId }, null, { session })
    .populate("userId", "email fullName phone")
    .populate("warehouseId", "warehouseName warehouseAddress")
    .populate("currentVehicleId", "plateNumber brand model")
    .lean();
};

const checkIdentityConflict = (
  { userId, idCardNumber, licenseNumber },
  session = null,
) => {
  return Driver.findOne(
    {
      $or: [{ userId }, { idCardNumber }, { licenseNumber }],
    },
    null,
    { session },
  ).lean();
};

export default {
  create,
  findAll,
  countAll,
  countActiveByWarehouseId,
  findVehicleIdsByWarehouseId,
  findIdsByWarehouseId,
  findByCurrentVehicleId,
  findById,
  findByUserId,
  updateById,
  deleteById,
  findByCode,
  renewLicense,
  checkIdentityConflict,
};
