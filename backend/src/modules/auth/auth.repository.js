import RefreshToken from "./refresh_token.js";
import RegisterOtp from "./registerOtp.js";
import PasswordResetOtp from "./passwordResetOtp.js";

// ==================== Refresh Token ====================
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

// ==================== Register OTP ====================
const createRegisterOtp = ({
  email,
  otp,
  expiresAt,
  attempts = 0,
  pendingRegistration,
}) => {
  return RegisterOtp.findOneAndUpdate(
    { email },
    { otp, expiresAt, attempts, pendingRegistration },
    { new: true, upsert: true },
  );
};

const findRegisterOtpByEmail = (email) => {
  return RegisterOtp.findOne({ email }).lean();
};

const deleteRegisterOtpByEmail = (email) => {
  return RegisterOtp.deleteOne({ email });
};

const incrementRegisterOtpAttempts = (email) => {
  return RegisterOtp.findOneAndUpdate(
    { email, expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } },
    { $inc: { attempts: 1 } },
    { new: true },
  ).lean();
};

const consumeRegisterOtp = (email, otp) => {
  return RegisterOtp.findOneAndDelete({
    email,
    otp,
    expiresAt: { $gt: new Date() },
    attempts: { $lt: 5 },
  }).lean();
};

// ==================== Password Reset OTP ====================
const createPasswordResetOtp = ({ email, otp, expiresAt, attempts = 0 }) => {
  return PasswordResetOtp.findOneAndUpdate(
    { email },
    { otp, expiresAt, attempts },
    { new: true, upsert: true },
  );
};

const findPasswordResetOtpByEmail = (email) => {
  return PasswordResetOtp.findOne({ email }).lean();
};

const deletePasswordResetOtpByEmail = (email) => {
  return PasswordResetOtp.deleteOne({ email });
};

const incrementPasswordResetOtpAttempts = (email) => {
  return PasswordResetOtp.findOneAndUpdate(
    { email, expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } },
    { $inc: { attempts: 1 } },
    { new: true },
  ).lean();
};

const consumePasswordResetOtp = (email, otp) => {
  return PasswordResetOtp.findOneAndDelete({
    email,
    otp,
    expiresAt: { $gt: new Date() },
    attempts: { $lt: 5 },
  }).lean();
};

export default {
  // Refresh Token
  createRefreshToken,
  findRefreshToken,
  deleteRefreshToken,
  deleteRefreshTokenByUserId,

  // Register OTP
  createRegisterOtp,
  findRegisterOtpByEmail,
  deleteRegisterOtpByEmail,
  incrementRegisterOtpAttempts,
  consumeRegisterOtp,

  // Password Reset OTP
  createPasswordResetOtp,
  findPasswordResetOtpByEmail,
  deletePasswordResetOtpByEmail,
  incrementPasswordResetOtpAttempts,
  consumePasswordResetOtp,
};
