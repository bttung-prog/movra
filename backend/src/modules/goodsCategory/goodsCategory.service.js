import { GOODS_CATEGORY_MESSAGES } from "../../constants/messages.js";
import { INVENTORY_STATUSES } from "../../constants/inventoryStatuses.js";

import ApiError from "../../utils/ApiError.js";
import { escapeRegex } from "../../utils/regexUtils.js";

import inventoryService from "../inventory/inventory.service.js";
import orderService from "../order/order.service.js";

import goodsCategoryRepository from "./goodsCategory.repository.js";

const validateGoodsCategory = (goodsCategory, requireNotDeleted = true) => {
  if (!goodsCategory) {
    throw new ApiError(404, GOODS_CATEGORY_MESSAGES.NOT_FOUND);
  }

  if (requireNotDeleted && goodsCategory.deletedAt !== null) {
    throw new ApiError(400, GOODS_CATEGORY_MESSAGES.ALREADY_DELETED);
  }
};

const create = async ({ goodsCategoryName, description }, session = null) => {
  const trimmedName = goodsCategoryName.trim();
  const existingActive = await goodsCategoryRepository.findByName(
    trimmedName,
    { deletedAt: null },
    session,
  );

  if (existingActive) {
    throw new ApiError(409, GOODS_CATEGORY_MESSAGES.NAME_EXISTS);
  }

  const existingDeleted = await goodsCategoryRepository.findByName(
    trimmedName,
    { deletedAt: { $ne: null } },
    session,
  );

  if (existingDeleted) {
    throw new ApiError(409, GOODS_CATEGORY_MESSAGES.PREVIOUSLY_DELETED);
  }

  return goodsCategoryRepository.create(
    {
      goodsCategoryName: trimmedName,
      description: description ? description.trim() : "",
    },
    session,
  );
};

const getAll = async ({
  page = 1,
  limit = 10,
  search = "",
  status = "active",
  sortBy = "createdAt",
  sortOrder = "desc",
  session = null,
} = {}) => {
  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const limitNumber = Math.max(1, parseInt(limit, 10) || 10);
  const skip = (pageNumber - 1) * limitNumber;

  const filter = {};
  if (status === "active") {
    filter.deletedAt = null;
  } else if (status === "deleted") {
    filter.deletedAt = { $ne: null };
  }
  // status === "all" includes both active and deleted

  if (search && search.trim()) {
    const escapedSearch = escapeRegex(search.trim());
    filter.goodsCategoryName = { $regex: escapedSearch, $options: "i" };
  }

  const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

  const [categories, total] = await Promise.all([
    goodsCategoryRepository.findAll({
      filter,
      skip,
      limit: limitNumber,
      sort,
      session,
    }),
    goodsCategoryRepository.countAll({ filter, session }),
  ]);

  return {
    data: categories,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages: Math.ceil(total / limitNumber),
    },
  };
};

const getById = async (
  goodsCategoryId,
  requireNotDeleted = true,
  session = null,
) => {
  const goodsCategory = await goodsCategoryRepository.findById(
    goodsCategoryId,
    session,
  );

  validateGoodsCategory(goodsCategory, requireNotDeleted);

  return goodsCategory;
};

const getByName = async (goodsCategoryName, session = null) => {
  const goodsCategory = await goodsCategoryRepository.findByName(
    goodsCategoryName.trim(),
    { deletedAt: null },
    session,
  );

  validateGoodsCategory(goodsCategory);

  return goodsCategory;
};

const updateById = async (goodsCategoryId, updateData, session = null) => {
  const existingCategory = await getById(goodsCategoryId, true, session);

  const formattedUpdate = { ...updateData };

  if (formattedUpdate.goodsCategoryName) {
    const trimmedName = formattedUpdate.goodsCategoryName.trim();
    formattedUpdate.goodsCategoryName = trimmedName;

    if (
      trimmedName.toLowerCase() !==
      existingCategory.goodsCategoryName.toLowerCase()
    ) {
      const duplicate = await goodsCategoryRepository.findByName(
        trimmedName,
        { deletedAt: null },
        session,
      );

      if (
        duplicate &&
        duplicate._id.toString() !== goodsCategoryId.toString()
      ) {
        throw new ApiError(409, GOODS_CATEGORY_MESSAGES.NAME_EXISTS);
      }
    }
  }

  if (formattedUpdate.description !== undefined) {
    formattedUpdate.description = formattedUpdate.description
      ? formattedUpdate.description.trim()
      : "";
  }

  return goodsCategoryRepository.updateById(
    goodsCategoryId,
    formattedUpdate,
    session,
  );
};

const deleteById = async (goodsCategoryId, session = null) => {
  await getById(goodsCategoryId, true, session);

  const [inStockCount, activeOrdersCount] = await Promise.all([
    inventoryService.countAll({
      filter: {
        goodsCategoryId,
        status: INVENTORY_STATUSES.IN_STOCK,
      },
      session,
    }),
    orderService.countAll({
      filter: {
        goodCategory: goodsCategoryId,
        status: { $nin: ["delivered", "returned", "cancelled"] },
      },
    }),
  ]);

  if (inStockCount > 0) {
    throw new ApiError(
      400,
      GOODS_CATEGORY_MESSAGES.CANNOT_DELETE_HAS_STOCK(inStockCount),
    );
  }

  if (activeOrdersCount > 0) {
    throw new ApiError(
      400,
      GOODS_CATEGORY_MESSAGES.CANNOT_DELETE_ACTIVE_ORDERS(activeOrdersCount),
    );
  }

  return goodsCategoryRepository.deleteById(goodsCategoryId, session);
};

const restoreById = async (goodsCategoryId, session = null) => {
  const category = await getById(goodsCategoryId, false, session);

  if (category.deletedAt === null) {
    throw new ApiError(400, GOODS_CATEGORY_MESSAGES.NOT_DELETED);
  }

  const existingActive = await goodsCategoryRepository.findByName(
    category.goodsCategoryName,
    { deletedAt: null },
    session,
  );

  if (
    existingActive &&
    existingActive._id.toString() !== goodsCategoryId.toString()
  ) {
    throw new ApiError(409, GOODS_CATEGORY_MESSAGES.CANNOT_RESTORE_NAME_EXISTS);
  }

  return goodsCategoryRepository.restoreById(goodsCategoryId, session);
};

const countAll = async ({ filter = {}, session = null } = {}) => {
  return goodsCategoryRepository.countAll({ filter, session });
};

export default {
  create,
  getAll,
  getById,
  getByName,
  updateById,
  deleteById,
  restoreById,
  countAll,
};
