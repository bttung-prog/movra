import Address from "./address.js";

const create = (addressData, session = null) => {
  return Address.create([addressData], { session }).then((docs) => docs[0]);
};

const findByCustomerId = (customerId) => {
  return Address.find({ customerId }).lean();
};

const findById = (addressId) => {
  return Address.findById(addressId).lean();
};

const updateById = (addressId, addressData, session = null) => {
  return Address.findByIdAndUpdate(addressId, addressData, {
    new: true,
    runValidators: true,
    session,
  });
};

const deleteById = (addressId, session = null) => {
  return Address.findByIdAndDelete(addressId, { session });
};

const resetDefault = (customerId, session = null) => {
  return Address.updateMany(
    { customerId, isDefault: true },
    { isDefault: false },
    { session },
  );
};

const setDefault = (addressId, session = null) => {
  return Address.findByIdAndUpdate(
    addressId,
    { isDefault: true },
    { new: true, runValidators: true, session },
  );
};

const countByCustomerId = (customerId, session = null) => {
  return Address.countDocuments({ customerId }).session(session);
};

export default {
  create,
  countByCustomerId,
  findByCustomerId,
  findById,
  updateById,
  deleteById,
  resetDefault,
  setDefault,
};
