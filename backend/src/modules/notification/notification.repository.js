import Notification from "./notification.js";

const create = (data, session = null) => {
  return Notification.create([data], { session }).then((docs) => docs[0]);
};

const insertMany = (docs = [], session = null) => {
  if (!Array.isArray(docs) || docs.length === 0) {
    return Promise.resolve([]);
  }

  return Notification.insertMany(docs, { session });
};

const findById = (id) => {
  return Notification.findById(id).lean();
};

const findAll = ({
  filter = {},
  skip = 0,
  limit = 10,
  sort = { createdAt: -1 },
} = {}) => {
  return Notification.find(filter).sort(sort).skip(skip).limit(limit).lean();
};

const countAll = ({ filter = {} } = {}) => {
  return Notification.countDocuments(filter);
};

const markAsRead = (id) => {
  return Notification.findByIdAndUpdate(
    id,
    { isRead: true, readAt: new Date() },
    { new: true },
  ).lean();
};

const findExistingDedupeKeys = ({
  userIds = [],
  dedupeKeys = [],
  session = null,
} = {}) => {
  if (!userIds.length || !dedupeKeys.length) {
    return Promise.resolve([]);
  }

  return Notification.find(
    {
      userId: { $in: userIds },
      dedupeKey: { $in: dedupeKeys },
    },
    null,
    { session },
  )
    .select("userId dedupeKey")
    .lean();
};

const markAllAsRead = (userId) => {
  return Notification.updateMany(
    { userId, isRead: false },
    { isRead: true, readAt: new Date() },
  );
};

export default {
  create,
  insertMany,
  findById,
  findAll,
  countAll,
  findExistingDedupeKeys,
  markAsRead,
  markAllAsRead,
};
