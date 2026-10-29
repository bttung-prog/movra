import { FEEDBACK_MESSAGES } from "../../constants/messages.js";

import ApiResponse from "../../utils/ApiResponse.js";

import feedbackService from "./feedback.service.js";

const create = async (req, res, next) => {
  try {
    const actor = {
      userId: req.user.userId,
      role: req.user.role,
      customerId: req.user.customerId,
    };

    const feedback = await feedbackService.createFeedback(req.body, actor);
    return ApiResponse.created(res, feedback, FEEDBACK_MESSAGES.CREATE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const reply = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { driverResponse } = req.body;
    const actor = {
      userId: req.user.userId,
      role: req.user.role,
      driverId: req.user.driverId,
    };

    const feedback = await feedbackService.replyFeedback(
      id,
      driverResponse,
      actor,
    );
    return ApiResponse.success(res, feedback, FEEDBACK_MESSAGES.REPLY_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getAll = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const { driverId, customerId, rating, status } = req.query;

    const filter = {};
    if (driverId) filter.driverId = driverId;
    if (customerId) filter.customerId = customerId;
    if (rating) filter.rating = Number(rating);
    if (status) filter.status = status;

    const result = await feedbackService.getAll({
      filter,
      page,
      limit,
      user: req.user,
    });
    return ApiResponse.success(res, result, FEEDBACK_MESSAGES.GET_ALL_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const feedback = await feedbackService.getById(id, req.user);
    return ApiResponse.success(
      res,
      feedback,
      FEEDBACK_MESSAGES.GET_ONE_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const getByOrderId = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const feedback = await feedbackService.getByOrderId(orderId, req.user);
    return ApiResponse.success(
      res,
      feedback,
      FEEDBACK_MESSAGES.GET_ORDER_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

export default {
  create,
  reply,
  getAll,
  getById,
  getByOrderId,
};
