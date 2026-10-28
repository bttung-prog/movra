import { COMMON_MESSAGES } from "../constants/messages.js";

import ApiError from "../utils/ApiError.js";

const validate = (schema, source = "body") => {
  return async (req, res, next) => {
    try {
      req[source] = await schema.validateAsync(req[source], {
        abortEarly: false,
        stripUnknown: true,
      });

      next();
    } catch (error) {
      if (error.isJoi) {
        const errorMessages = error.details.map((detail) => detail.message);
        return next(
          new ApiError(400, COMMON_MESSAGES.VALIDATION_ERROR, errorMessages),
        );
      }

      next(
        new ApiError(400, COMMON_MESSAGES.VALIDATION_ERROR, [error.message]),
      );
    }
  };
};

export default validate;
