import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  countByCustomerId: vi.fn(),
  resetDefault: vi.fn(),
  create: vi.fn(),
  findByCustomerId: vi.fn(),
  findById: vi.fn(),
  updateById: vi.fn(),
  deleteById: vi.fn(),
  setDefault: vi.fn(),
}));

vi.mock("../../../src/modules/address/address.repository.js", () => ({
  default: {
    countByCustomerId: mocks.countByCustomerId,
    resetDefault: mocks.resetDefault,
    create: mocks.create,
    findByCustomerId: mocks.findByCustomerId,
    findById: mocks.findById,
    updateById: mocks.updateById,
    deleteById: mocks.deleteById,
    setDefault: mocks.setDefault,
  },
}));

import { ADDRESS_MESSAGES } from "../../../src/constants/messages.js";
import addressService from "../../../src/modules/address/address.service.js";

const customerId = "customer-1";
const anotherCustomerId = "customer-2";
const addressId = "address-1";
const address = {
  _id: addressId,
  customerId,
  receiverName: "Test Receiver",
  province: "Province",
  district: "District",
  ward: "Ward",
  detail: "123 Main Street",
  isDefault: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.countByCustomerId.mockResolvedValue(1);
  mocks.resetDefault.mockResolvedValue({});
  mocks.create.mockResolvedValue(address);
  mocks.findByCustomerId.mockResolvedValue([address]);
  mocks.findById.mockResolvedValue(address);
  mocks.updateById.mockResolvedValue(address);
  mocks.deleteById.mockResolvedValue(address);
  mocks.setDefault.mockResolvedValue({ ...address, isDefault: true });
});

describe("addressService.create", () => {
  it("makes the first customer address default", async () => {
    mocks.countByCustomerId.mockResolvedValue(0);

    await addressService.create(customerId, {
      receiverName: "Test Receiver",
      isDefault: false,
    });

    expect(mocks.create).toHaveBeenCalledWith({
      receiverName: "Test Receiver",
      isDefault: true,
      customerId,
    });
  });
});

describe("addressService ownership and lookups", () => {
  it("returns customer addresses and an address owned by the requesting customer", async () => {
    await expect(addressService.getByCustomerId(customerId)).resolves.toEqual([
      address,
    ]);
    await expect(addressService.getById(addressId, customerId)).resolves.toBe(
      address,
    );

    expect(mocks.findByCustomerId).toHaveBeenCalledWith(customerId);
    expect(mocks.findById).toHaveBeenCalledWith(addressId);
  });

  it("rejects missing and foreign-owned addresses", async () => {
    mocks.findById.mockResolvedValueOnce(null);
    await expect(
      addressService.getById(addressId, customerId),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: ADDRESS_MESSAGES.NOT_FOUND,
    });

    mocks.findById.mockResolvedValueOnce(address);
    await expect(
      addressService.getById(addressId, anotherCustomerId),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: ADDRESS_MESSAGES.NO_PERMISSION("truy cập"),
    });
  });
});

describe("addressService.updateById", () => {
  it("prevents unsetting the current default address", async () => {
    mocks.findById.mockResolvedValueOnce({ ...address, isDefault: true });

    await expect(
      addressService.updateById(addressId, { isDefault: false }, customerId),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: ADDRESS_MESSAGES.CANNOT_UNSET_DEFAULT,
    });

    expect(mocks.updateById).not.toHaveBeenCalled();
  });
});

describe("addressService.deleteById", () => {
  it("prevents deleting the default address", async () => {
    mocks.findById.mockResolvedValueOnce({ ...address, isDefault: true });

    await expect(
      addressService.deleteById(addressId, customerId),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: ADDRESS_MESSAGES.CANNOT_DELETE_DEFAULT,
    });
    expect(mocks.deleteById).not.toHaveBeenCalled();
  });

  it("deletes an owned non-default address", async () => {
    await addressService.deleteById(addressId, customerId);

    expect(mocks.deleteById).toHaveBeenCalledWith(addressId);
  });

  it("checks ownership before attempting deletion", async () => {
    await expect(
      addressService.deleteById(addressId, anotherCustomerId),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: ADDRESS_MESSAGES.NO_PERMISSION("xóa"),
    });
    expect(mocks.deleteById).not.toHaveBeenCalled();
  });
});

describe("addressService.setDefault", () => {
  it("returns the address without a transaction when it is already default", async () => {
    const defaultAddress = { ...address, isDefault: true };
    mocks.findById.mockResolvedValueOnce(defaultAddress);

    await expect(
      addressService.setDefault(addressId, customerId),
    ).resolves.toBe(defaultAddress);

    expect(mocks.resetDefault).not.toHaveBeenCalled();
    expect(mocks.setDefault).not.toHaveBeenCalled();
  });
});
