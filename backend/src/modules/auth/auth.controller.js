import { AUTH_MESSAGES } from "../../constants/messages.js";

import ApiResponse from "../../utils/ApiResponse.js";
import {
  REFRESH_TOKEN_COOKIE,
  clearRefreshTokenCookie,
  getRefreshTokenCookieOptions,
} from "../../utils/cookies.js";

import authService from "./auth.service.js";

const refreshTokenCookieOptions = getRefreshTokenCookieOptions();

const register = async (req, res, next) => {
  try {
    const result = await authService.register(req.body);

    return ApiResponse.success(res, result, AUTH_MESSAGES.REGISTER_OTP_SENT);
  } catch (error) {
    next(error);
  }
};

const verifyRegisterOtp = async (req, res, next) => {
  try {
    const result = await authService.verifyRegisterOtp(req.body);

    return ApiResponse.created(res, result, AUTH_MESSAGES.REGISTER_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const requestPasswordResetOtp = async (req, res, next) => {
  try {
    await authService.requestPasswordResetOtp(req.body);

    return ApiResponse.success(
      res,
      null,
      AUTH_MESSAGES.PASSWORD_RESET_OTP_SENT,
    );
  } catch (error) {
    next(error);
  }
};

const resetPasswordWithOtp = async (req, res, next) => {
  try {
    await authService.resetPasswordWithOtp(req.body);

    return ApiResponse.success(res, null, AUTH_MESSAGES.PASSWORD_RESET_SUCCESS);
  } catch (error) {
    next(error);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const user = await authService.changePassword(
      req.user.userId,
      req.body.oldPassword,
      req.body.newPassword,
    );

    return ApiResponse.success(
      res,
      user,
      AUTH_MESSAGES.CHANGE_PASSWORD_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    const refreshToken = result.tokens.refreshToken;

    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, refreshTokenCookieOptions);

    return ApiResponse.success(
      res,
      {
        user: result.user,
        tokens: {
          accessToken: result.tokens.accessToken,
        },
      },
      AUTH_MESSAGES.LOGIN_SUCCESS,
    );
  } catch (error) {
    next(error);
  }
};

const refreshAccessToken = async (req, res, next) => {
  try {
    const result = await authService.refreshAccessToken(
      req.cookies?.[REFRESH_TOKEN_COOKIE],
    );

    return ApiResponse.success(
      res,
      result,
      AUTH_MESSAGES.REFRESH_TOKEN_SUCCESS,
    );
  } catch (error) {
    if (error?.statusCode === 401 || error?.statusCode === 403) {
      clearRefreshTokenCookie(res);
    }
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (refreshToken) {
      await authService.logout(refreshToken);
    }

    clearRefreshTokenCookie(res);

    return ApiResponse.success(res, null, AUTH_MESSAGES.LOGOUT_SUCCESS);
  } catch (error) {
    next(error);
  }
};

export default {
  register,
  verifyRegisterOtp,
  requestPasswordResetOtp,
  resetPasswordWithOtp,
  changePassword,
  login,
  refreshAccessToken,
  logout,
};
