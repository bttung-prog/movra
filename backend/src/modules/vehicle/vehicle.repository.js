import Vehicle from "./vehicle.js";

const create = (data) => {
  return Vehicle.create(data);
};

const findAll = ({ filter = {}, skip, limit }) => {
  return Vehicle.find(filter)
    .populate("vehicleTypeId", "name")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

const countAll = (filter = {}) => {
  return Vehicle.countDocuments(filter);
};

const findIds = (filter = {}) => {
  return Vehicle.distinct("_id", filter);
};

const findById = (vehicleId) => {
  return Vehicle.findById(vehicleId).lean();
};

const findByPlateNumber = (plateNumber) => {
  return Vehicle.findOne({ plateNumber }).lean();
};

const findExpiredRegistration = ({ date, skip, limit }) => {
  return Vehicle.find({ registrationExpiryDate: { $lt: date } })
    .sort({ registrationExpiryDate: 1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

const countExpiredRegistration = ({ date }) => {
  return Vehicle.countDocuments({ registrationExpiryDate: { $lt: date } });
};

const findExpiredInsurance = ({ date, skip, limit }) => {
  return Vehicle.find({ insuranceExpiryDate: { $lt: date } })
    .sort({ insuranceExpiryDate: 1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

const countExpiredInsurance = ({ date }) => {
  return Vehicle.countDocuments({ insuranceExpiryDate: { $lt: date } });
};

const findExpiryCandidates = (targetDate) => {
  return Vehicle.find({
    status: { $ne: "retired" },
    $or: [
      { registrationExpiryDate: { $ne: null, $lte: targetDate } },
      { insuranceExpiryDate: { $ne: null, $lte: targetDate } },
    ],
  })
    .populate("vehicleTypeId", "name")
    .sort({ registrationExpiryDate: 1, insuranceExpiryDate: 1 })
    .lean();
};

const updateById = (vehicleId, updateData, session = null) => {
  return Vehicle.findByIdAndUpdate(vehicleId, updateData, {
    new: true,
    runValidators: true,
    session,
  });
};

const setWarehouseIdIfUnassigned = (vehicleId, warehouseId, session = null) => {
  return Vehicle.findOneAndUpdate(
    { _id: vehicleId, warehouseId: null },
    { $set: { warehouseId } },
    { new: true, runValidators: true, session },
  ).lean();
};

const countByStatus = (filter = {}, warehouseId = null) => {
  return Vehicle.aggregate([
    { $match: filter },
    ...(warehouseId
      ? [
          {
            $lookup: {
              from: "drivers",
              localField: "_id",
              foreignField: "currentVehicleId",
              as: "dashboardDriver",
            },
          },
          { $unwind: "$dashboardDriver" },
          { $match: { "dashboardDriver.warehouseId": warehouseId } },
        ]
      : []),
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);
};

export default {
  create,
  findAll,
  countAll,
  findIds,
  findById,
  findByPlateNumber,
  findExpiredRegistration,
  countExpiredRegistration,
  findExpiredInsurance,
  countExpiredInsurance,
  findExpiryCandidates,
  updateById,
  setWarehouseIdIfUnassigned,
  countByStatus,
};
