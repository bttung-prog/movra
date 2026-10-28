import RefreshToken from "./refresh_token.js";

const createRefreshToken = (userId, refreshToken) => {
  return RefreshToken.findOneAndUpdate(
    { userId: userId },
    {
      token: refreshToken,
      expiresAt: new Date(
        Date.now() + Number(process.env.REFRESH_TOKEN_EXPIRES_MS),
      ),
    },
    { new: true, upsert: true },
  );
};

const findRefreshToken = (refreshToken) => {
  return RefreshToken.findOne({
    token: refreshToken,
  }).lean();
};

const deleteRefreshToken = (refreshToken) => {
  return RefreshToken.deleteOne({
    token: refreshToken,
  });
};

const deleteRefreshTokenByUserId = (userId) => {
  return RefreshToken.deleteOne({ userId });
};

export default {
  createRefreshToken,
  findRefreshToken,
  deleteRefreshToken,
  deleteRefreshTokenByUserId,
};
