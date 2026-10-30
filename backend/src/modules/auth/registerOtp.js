import mongoose from "mongoose";

const registerOtpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    otp: {
      type: String,
      required: true,
      trim: true,
    },

    expiresAt: {
      type: Date,
      required: true,
      alias: "expires_at",
    },

    attempts: {
      type: Number,
      default: 0,
      required: true,
    },

    pendingRegistration: {
      passwordHash: {
        type: String,
        required: true,
      },

      phone: {
        type: String,
        required: true,
      },

      fullName: {
        type: String,
        required: true,
      },
    },
  },
  {
    timestamps: true,
  },
);

registerOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RegisterOtp = mongoose.model("RegisterOtp", registerOtpSchema);

export default RegisterOtp;
