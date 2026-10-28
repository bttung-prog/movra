import { COMMON_MESSAGES, AUTH_MESSAGES } from "../constants/messages.js";

import ApiError from "../utils/ApiError.js";
import { verifyAccessToken } from "../utils/jwt.js";

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new ApiError(401, COMMON_MESSAGES.UNAUTHORIZED);
    }

    const accessToken = authHeader.split(" ")[1];
    if (!accessToken) {
      throw new ApiError(401, COMMON_MESSAGES.UNAUTHORIZED);
    }

    const payload = verifyAccessToken(accessToken);
    req.user = payload;

    next();
  } catch (error) {
    if (error instanceof ApiError) {
      return next(error);
    } else if (error.name === "TokenExpiredError") {
      return next(new ApiError(401, AUTH_MESSAGES.TOKEN_EXPIRED));
    } else if (error.name === "JsonWebTokenError") {
      return next(new ApiError(401, AUTH_MESSAGES.INVALID_ACCESS_TOKEN));
    } else {
      return next(new ApiError(401, COMMON_MESSAGES.UNAUTHORIZED));
    }
  }
};

export default authMiddleware;
