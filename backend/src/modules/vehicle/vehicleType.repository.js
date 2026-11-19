import VehicleType from "./vehicle_type.js";

const create = (data) => {
  return VehicleType.create(data);
};

const find = ({ filter = {}, skip = 0, limit = 10 } = {}) => {
  return VehicleType.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

const count = (filter = {}) => {
  return VehicleType.countDocuments(filter);
};

const findActive = ({ skip, limit }) => {
  return find({ filter: { deletedAt: null }, skip, limit });
};

const countActive = () => {
  return count({ deletedAt: null });
};

const findDeleted = ({ skip, limit }) => {
  return find({ filter: { deletedAt: { $ne: null } }, skip, limit });
};

const countDeleted = () => {
  return count({ deletedAt: { $ne: null } });
};

const findById = (vehicleTypeId) => {
  return VehicleType.findById(vehicleTypeId).lean();
};

const findByName = (vehicleTypeName) => {
  return VehicleType.findOne({ name: vehicleTypeName }).lean();
};

const updateById = (vehicleTypeId, updateData) => {
  return VehicleType.findByIdAndUpdate(vehicleTypeId, updateData, {
    new: true,
    runValidators: true,
  });
};

const deleteById = (vehicleTypeId) => {
  return VehicleType.findByIdAndUpdate(
    vehicleTypeId,
    { deletedAt: new Date() },
    { new: true },
  );
};

const restoreById = (vehicleTypeId) => {
  return VehicleType.findByIdAndUpdate(
    vehicleTypeId,
    { deletedAt: null },
    { new: true },
  );
};

export default {
  create,
  find,
  count,
  findActive,
  countActive,
  findDeleted,
  countDeleted,
  findById,
  findByName,
  updateById,
  deleteById,
  restoreById,
};
