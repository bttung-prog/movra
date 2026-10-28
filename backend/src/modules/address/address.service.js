import mongoose from "mongoose";

import { ADDRESS_MESSAGES } from "../../constants/messages.js";

import ApiError from "../../utils/ApiError.js";

import addressRepository from "./address.repository.js";

const runInTransaction = async (callback) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const result = await callback(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

const checkAddressOwnership = (address, customerId, action = "truy cập") => {
  if (!customerId || address.customerId.toString() !== customerId.toString()) {
    throw new ApiError(403, ADDRESS_MESSAGES.NO_PERMISSION(action));
  }
};

const create = async (customerId, addressData) => {
  const addressCount = await addressRepository.countByCustomerId(customerId);
  const isFirstAddress = addressCount === 0;

  const isDefault = isFirstAddress ? true : addressData.isDefault;
  const payload = { ...addressData, customerId, isDefault };

  if (payload.isDefault && !isFirstAddress) {
    return runInTransaction(async (session) => {
      await addressRepository.resetDefault(customerId, session);
      return addressRepository.create(payload, session);
    });
  }

  return addressRepository.create(payload);
};

const getByCustomerId = async (customerId) => {
  return addressRepository.findByCustomerId(customerId);
};

const getById = async (addressId, customerId, action = "truy cập") => {
  const address = await addressRepository.findById(addressId);

  if (!address) {
    throw new ApiError(404, ADDRESS_MESSAGES.NOT_FOUND);
  }

  checkAddressOwnership(address, customerId, action);

  return address;
};

const updateById = async (addressId, addressData, customerId) => {
  const existingAddress = await getById(addressId, customerId, "cập nhật");

  if (addressData.isDefault === false && existingAddress.isDefault) {
    throw new ApiError(400, ADDRESS_MESSAGES.CANNOT_UNSET_DEFAULT);
  }

  if (addressData.isDefault === true && !existingAddress.isDefault) {
    return runInTransaction(async (session) => {
      await addressRepository.resetDefault(customerId, session);
      return addressRepository.updateById(addressId, addressData, session);
    });
  }

  return addressRepository.updateById(addressId, addressData);
};

const deleteById = async (addressId, customerId) => {
  const existingAddress = await getById(addressId, customerId, "xóa");

  if (existingAddress.isDefault) {
    throw new ApiError(400, ADDRESS_MESSAGES.CANNOT_DELETE_DEFAULT);
  }

  return addressRepository.deleteById(addressId);
};

const setDefault = async (addressId, customerId) => {
  const existingAddress = await getById(
    addressId,
    customerId,
    "đặt làm mặc định",
  );

  if (existingAddress.isDefault) {
    return existingAddress;
  }

  return runInTransaction(async (session) => {
    await addressRepository.resetDefault(customerId, session);
    return addressRepository.setDefault(addressId, session);
  });
};

export default {
  create,
  getByCustomerId,
  getById,
  updateById,
  deleteById,
  setDefault,
};
