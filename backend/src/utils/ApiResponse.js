import { COMMON_MESSAGES } from "../constants/messages.js";

class ApiResponse {
  static success(
    res,
    data = null,
    message = COMMON_MESSAGES.SUCCESS,
    statusCode = 200,
    meta = {},
  ) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      meta,
    });
  }

  static created(res, data = null, message = COMMON_MESSAGES.CREATED) {
    return res.status(201).json({
      success: true,
      message,
      data,
    });
  }

  static noContent(res) {
    return res.status(204).send();
  }

  static error(
    res,
    message = COMMON_MESSAGES.ERROR,
    errors = [],
    statusCode = 500,
  ) {
    return res.status(statusCode).json({
      success: false,
      message,
      errors,
    });
  }
}

export default ApiResponse;
