import nodemailer from "nodemailer";
import ApiError from "./ApiError.js";

/**
 * Initialize nodemailer transporter from environment configuration
 */
const getTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT, 10);
  const user = process.env.EMAIL_USER;
  const rawCode = process.env.EMAIL_CODE;
  const pass = rawCode.replace(/\s+/g, "");
  const fromName = (process.env.SMTP_FROM_NAME || "Movra").replace(
    /^["']|["']$/g,
    "",
  );

  if (!user) {
    throw new Error("SMTP sender account is not configured (EMAIL_USER).");
  }

  if (!pass) {
    throw new Error("SMTP sender password is not configured (EMAIL_CODE).");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });

  return {
    transporter,
    fromName,
    fromEmail: user,
  };
};

/**
 * Send an email containing an OTP code (for registration or password reset)
 * @param {string} toEmail - Recipient email address
 * @param {string} otp - OTP code
 * @param {string} [purpose="reset_password"] - Email purpose: "register" or "reset_password"
 */
const sendOtpEmail = async (toEmail, otp, purpose = "reset_password") => {
  if (!toEmail || !otp) {
    throw new ApiError(400, "Thiếu thông tin email hoặc mã OTP để gửi.");
  }

  const { transporter, fromName, fromEmail } = getTransporter();

  let subject;
  let sectionTitle;
  let greetingText;
  let introHtml;
  let instructionHtml;
  let footerNoteHtml;

  if (purpose === "register") {
    subject = `[${fromName}] Mã xác thực đăng ký tài khoản`;
    sectionTitle = "Xác thực đăng ký tài khoản";
    greetingText =
      `Xin chào,\n\n` +
      `Cảm ơn bạn đã đăng ký tài khoản tại ${fromName}.\n` +
      `Mã OTP kích hoạt tài khoản của bạn là: ${otp}\n\n` +
      `Mã này có hiệu lực trong vòng 5 phút. Vui lòng không chia sẻ mã này cho bất kỳ ai.\n` +
      `Nếu bạn không thực hiện đăng ký này, vui lòng bỏ qua email.\n\n` +
      `Trân trọng,\n${fromName}`;
    introHtml = `Xin chào, cảm ơn bạn đã đăng ký tài khoản tại <strong>${fromName}</strong> với email <strong>${toEmail}</strong>.`;
    instructionHtml =
      "Dưới đây là mã xác thực OTP để kích hoạt tài khoản của bạn. Mã này có hiệu lực trong vòng <strong>5 phút</strong>:";
    footerNoteHtml =
      "Nếu bạn không thực hiện đăng ký này, hãy yên tâm bỏ qua email này.";
  } else {
    subject = `[${fromName}] Mã xác thực đặt lại mật khẩu`;
    sectionTitle = "Yêu cầu đặt lại mật khẩu";
    greetingText =
      `Xin chào,\n\n` +
      `Bạn vừa yêu cầu đặt lại mật khẩu tại ${fromName}.\n` +
      `Mã OTP của bạn là: ${otp}\n\n` +
      `Mã này có hiệu lực trong vòng 5 phút. Vui lòng không chia sẻ mã này cho bất kỳ ai.\n` +
      `Nếu bạn không yêu cầu hành động này, vui lòng bỏ qua email.\n\n` +
      `Trân trọng,\n${fromName}`;
    introHtml = `Xin chào, chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản liên kết với email <strong>${toEmail}</strong>.`;
    instructionHtml =
      "Dưới đây là mã xác thực OTP của bạn. Mã này có hiệu lực trong vòng <strong>5 phút</strong>:";
    footerNoteHtml =
      "Nếu bạn không thực hiện yêu cầu này, hãy yên tâm bỏ qua email này hoặc liên hệ ngay với chúng tôi để bảo vệ tài khoản.";
  }

  // Modern fresh sea blue HTML template (Ocean Blue #0284c7)
  const htmlContent = `
  <!DOCTYPE html>
  <html lang="vi">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Mã xác thực OTP - ${fromName}</title>
  </head>
  <body style="margin: 0; padding: 24px; background-color: #f0f7fc; font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; background-color: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 8px 24px rgba(2, 132, 199, 0.08); border: 1px solid #e0f2fe;">
          <!-- Header -->
          <tr>
              <td style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); background-color: #0284c7; padding: 32px 24px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase;">
                      ${fromName}
                  </h1>
                  <p style="margin: 6px 0 0 0; color: #e0f2fe; font-size: 13px; font-weight: 400; letter-spacing: 0.5px;">
                      Hệ thống Quản lý Vận tải &amp; Giao hàng Thông minh
                  </p>
              </td>
          </tr>

          <!-- Body Content -->
          <tr>
              <td style="padding: 36px 32px;">
                  <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 20px; font-weight: 600;">
                      ${sectionTitle}
                  </h2>
                  <p style="margin: 0 0 14px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                      ${introHtml}
                  </p>
                  <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                      ${instructionHtml}
                  </p>

                  <!-- OTP Box -->
                  <div style="text-align: center; margin: 30px 0;">
                      <div style="display: inline-block; background-color: #f0f9ff; border: 2px dashed #0284c7; border-radius: 10px; padding: 16px 40px;">
                          <span style="font-size: 34px; font-weight: 700; letter-spacing: 8px; color: #0284c7; font-family: 'Courier New', Courier, monospace;">
                              ${otp}
                          </span>
                      </div>
                  </div>

                  <!-- Security Warning Box -->
                  <div style="background-color: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 14px 18px; margin: 24px 0; border-radius: 6px;">
                      <p style="margin: 0; font-size: 13px; color: #0369a1; line-height: 1.5;">
                          <strong>Lưu ý bảo mật:</strong> Tuyệt đối không cung cấp mã OTP này cho bất kỳ ai, kể cả nhân viên hỗ trợ của ${fromName}.
                      </p>
                  </div>

                  <p style="margin: 20px 0 0 0; font-size: 13px; line-height: 1.6; color: #64748b;">
                      ${footerNoteHtml}
                  </p>
              </td>
          </tr>

          <!-- Footer -->
          <tr>
              <td style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
                  <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                      &copy; ${fromName}. Mọi quyền được bảo lưu.
                  </p>
              </td>
          </tr>
      </table>
  </body>
  </html>
  `;

  return transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: toEmail,
    subject,
    text: greetingText,
    html: htmlContent,
  });
};

const sendRegisterOtpEmail = (toEmail, otp) => {
  return sendOtpEmail(toEmail, otp, "register");
};

const sendPasswordResetOtpEmail = (toEmail, otp) => {
  return sendOtpEmail(toEmail, otp, "reset_password");
};

export { sendOtpEmail, sendRegisterOtpEmail, sendPasswordResetOtpEmail };
