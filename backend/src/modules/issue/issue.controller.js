import { ISSUE_MESSAGES } from "../../constants/messages.js";

import ApiResponse from "../../utils/ApiResponse.js";

import issueService from "./issue.service.js";

const create = async (req, res, next) => {
  try {
    const issuedBy =
      req.user.role === "admin" && req.body.issuedBy
        ? req.body.issuedBy
        : req.user.userId;

    const issue = await issueService.create(
      {
        ...req.body,
        issuedBy,
      },
      req.user,
    );

    return ApiResponse.created(res, issue, ISSUE_MESSAGES.CREATE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getAll = async (req, res, next) => {
  try {
    const result = await issueService.getAll(req.query, req.user);

    return ApiResponse.success(res, result, ISSUE_MESSAGES.GET_ALL_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const issue = await issueService.getById(req.params.issueId, req.user);

    return ApiResponse.success(res, issue, ISSUE_MESSAGES.GET_ONE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getByCode = async (req, res, next) => {
  try {
    const issue = await issueService.getByCode(req.params.issueCode, req.user);

    return ApiResponse.success(res, issue, ISSUE_MESSAGES.GET_ONE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getByOrderId = async (req, res, next) => {
  try {
    const issue = await issueService.getByOrderId(req.params.orderId, req.user);

    return ApiResponse.success(res, issue, ISSUE_MESSAGES.GET_ONE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getByTripId = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;

    const result = await issueService.getByTripId(
      req.params.tripId,
      { page, limit },
      req.user,
    );

    return ApiResponse.success(res, result, ISSUE_MESSAGES.GET_BY_TRIP_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const cancel = async (req, res, next) => {
  try {
    const issue = await issueService.cancel(
      req.params.issueId,
      req.body,
      req.user,
    );

    return ApiResponse.success(res, issue, ISSUE_MESSAGES.CANCEL_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const updateNote = async (req, res, next) => {
  try {
    const issue = await issueService.updateNote(
      req.params.issueId,
      req.body,
      req.user,
    );

    return ApiResponse.success(res, issue, ISSUE_MESSAGES.UPDATE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

export default {
  create,
  getAll,
  getById,
  getByCode,
  getByOrderId,
  getByTripId,
  cancel,
  updateNote,
};
