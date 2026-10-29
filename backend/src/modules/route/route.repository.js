import Route from "./route.js";

const ROUTE_POPULATE = [
  {
    path: "originWarehouseId",
    select: "warehouseName warehouseAddress status",
  },
  {
    path: "destinationWarehouseId",
    select: "warehouseName warehouseAddress status",
  },
];

const create = (routeData, session = null) => {
  return Route.create([routeData], { session }).then((docs) =>
    docs[0].populate(ROUTE_POPULATE),
  );
};

const findAll = ({
  filter = {},
  skip = 0,
  limit = 10,
  sort = { createdAt: -1 },
} = {}) => {
  return Route.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate(ROUTE_POPULATE)
    .lean();
};

const countAll = ({ filter = {} } = {}) => {
  return Route.countDocuments(filter);
};

const findById = (routeId) => {
  return Route.findById(routeId).populate(ROUTE_POPULATE).lean();
};

const findByWarehousePair = (originWarehouseId, destinationWarehouseId) => {
  return Route.findOne({
    originWarehouseId,
    destinationWarehouseId,
  }).lean();
};

const updateById = (routeId, updateData, session = null) => {
  return Route.findByIdAndUpdate(routeId, updateData, {
    new: true,
    runValidators: true,
    session,
  })
    .populate(ROUTE_POPULATE)
    .lean();
};

const deleteById = (routeId, session = null) => {
  return Route.findByIdAndUpdate(
    routeId,
    { deletedAt: new Date() },
    { new: true, session },
  )
    .populate(ROUTE_POPULATE)
    .lean();
};

const restoreById = (routeId, session = null) => {
  return Route.findByIdAndUpdate(
    routeId,
    { deletedAt: null },
    { new: true, session },
  )
    .populate(ROUTE_POPULATE)
    .lean();
};

export default {
  create,
  findAll,
  countAll,
  findById,
  findByWarehousePair,
  updateById,
  deleteById,
  restoreById,
};
