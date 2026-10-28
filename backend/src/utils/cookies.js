export const REFRESH_TOKEN_COOKIE = "refreshToken";

export const getRefreshTokenCookieOptions = () => {
  const REFRESH_TOKEN_COOKIE_SAME_SITE =
    process.env.REFRESH_TOKEN_COOKIE_SAME_SITE || "lax";

  return {
    httpOnly: true,
    secure:
      process.env.NODE_ENV === "production" ||
      REFRESH_TOKEN_COOKIE_SAME_SITE === "none",
    sameSite: REFRESH_TOKEN_COOKIE_SAME_SITE,
    path: "/api/v1/auth",
    ...(process.env.REFRESH_TOKEN_COOKIE_DOMAIN
      ? { domain: process.env.REFRESH_TOKEN_COOKIE_DOMAIN }
      : {}),
    ...(Number.isFinite(Number(process.env.REFRESH_TOKEN_EXPIRES_MS)) &&
    Number(process.env.REFRESH_TOKEN_EXPIRES_MS) > 0
      ? { maxAge: Number(process.env.REFRESH_TOKEN_EXPIRES_MS) }
      : {}),
  };
};

export const clearRefreshTokenCookie = (res) => {
  const options = getRefreshTokenCookieOptions();
  const { maxAge, ...clearOptions } = options;

  res.clearCookie(REFRESH_TOKEN_COOKIE, clearOptions);
};
