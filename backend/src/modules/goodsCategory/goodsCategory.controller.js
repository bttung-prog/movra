import { GOODS_CATEGORY_MESSAGES } from "../../constants/messages.js";

import ApiResponse from "../../utils/ApiResponse.js";

import goodsCategoryService from "./goodsCategory.service.js";

const create = async (req, res, next) => {
  try {
    const category = await goodsCategoryService.create(req.body);

    return ApiResponse.created(
      res,
      category,
      GOODS_CATEGORY_MESSAGES.CREATE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getAll = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const search = req.query.search ? req.query.search.trim() : "";
    const status = req.query.status || "active";
    const sortBy = req.query.sortBy || "createdAt";
    const sortOrder = req.query.sortOrder || "desc";

    const result = await goodsCategoryService.getAll({
      page,
      limit,
      search,
      status,
      sortBy,
      sortOrder,
    });

    return ApiResponse.success(
      res,
      result,
      GOODS_CATEGORY_MESSAGES.GET_ALL_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const category = await goodsCategoryService.getById(
      req.params.goodsCategoryId,
    );

    return ApiResponse.success(
      res,
      category,
      GOODS_CATEGORY_MESSAGES.GET_ONE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const updateById = async (req, res, next) => {
  try {
    const category = await goodsCategoryService.updateById(
      req.params.goodsCategoryId,
      req.body,
    );

    return ApiResponse.success(
      res,
      category,
      GOODS_CATEGORY_MESSAGES.UPDATE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const deleteById = async (req, res, next) => {
  try {
    const category = await goodsCategoryService.deleteById(
      req.params.goodsCategoryId,
    );

    return ApiResponse.success(
      res,
      category,
      GOODS_CATEGORY_MESSAGES.DELETE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const restoreById = async (req, res, next) => {
  try {
    const category = await goodsCategoryService.restoreById(
      req.params.goodsCategoryId,
    );

    return ApiResponse.success(
      res,
      category,
      GOODS_CATEGORY_MESSAGES.RESTORE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

export default {
  create,
  getAll,
  getById,
  updateById,
  deleteById,
  restoreById,
};
