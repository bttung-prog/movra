import MaintenanceSchedule from "./maintenance_schedule.js";

const create = (scheduleData) => {
  return MaintenanceSchedule.create(scheduleData);
};

const find = ({ filter = {}, skip, limit }) => {
  return MaintenanceSchedule.find(filter)
    .populate("vehicleId")
    .skip(skip)
    .limit(limit)
    .lean();
};

const count = (filter = {}) => {
  return MaintenanceSchedule.countDocuments(filter);
};

const findById = (scheduleId) => {
  return MaintenanceSchedule.findById(scheduleId).lean();
};

const findByVehicleId = ({ vehicleId, filter = {}, skip, limit }) => {
  return MaintenanceSchedule.find({ vehicleId, ...filter })
    .populate("vehicleId")
    .skip(skip)
    .limit(limit)
    .sort({ nextDueDate: 1 })
    .lean();
};

const countByVehicleId = (vehicleId, filter = {}) => {
  return MaintenanceSchedule.countDocuments({ vehicleId, ...filter });
};

const findUpcoming = (targetDate, vehicleIds = null) => {
  return MaintenanceSchedule.find({
    isActive: true,
    deletedAt: null,
    nextDueDate: { $lte: targetDate },
    ...(vehicleIds ? { vehicleId: { $in: vehicleIds } } : {}),
  })
    .populate("vehicleId", "plateNumber brand model")
    .sort({ nextDueDate: 1 })
    .lean();
};

const updateById = (scheduleId, updateData, session = null) => {
  return MaintenanceSchedule.findByIdAndUpdate(scheduleId, updateData, {
    new: true,
    runValidators: true,
    session,
  });
};

const deleteById = (scheduleId, session = null) => {
  return MaintenanceSchedule.findByIdAndUpdate(
    scheduleId,
    { deletedAt: new Date(), isActive: false },
    { new: true, session },
  );
};

const restoreById = (scheduleId, session = null) => {
  return MaintenanceSchedule.findByIdAndUpdate(
    scheduleId,
    { deletedAt: null, isActive: true },
    { new: true, session },
  );
};

export default {
  create,
  find,
  count,
  findById,
  findByVehicleId,
  countByVehicleId,
  findUpcoming,
  updateById,
  deleteById,
  restoreById,
};
