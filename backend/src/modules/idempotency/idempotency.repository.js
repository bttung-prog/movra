import Idempotency from "./idempotency.js";

const create = (recordData, session = null) => {
  return Idempotency.create([recordData], { session }).then((docs) => docs[0]);
};

const updateById = (recordId, updateData, session = null) => {
  return Idempotency.findByIdAndUpdate(recordId, updateData, {
    new: true,
    runValidators: true,
    session,
  });
};

const findByUserAndKey = (userId, key, session = null) => {
  return Idempotency.findOne({ userId, key }, null, { session });
};

const deleteById = (recordId, session = null) => {
  return Idempotency.findByIdAndDelete(recordId, { session });
};

export default {
  create,
  updateById,
  findByUserAndKey,
  deleteById,
};
