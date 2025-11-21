import nodemailer, { Transporter } from "nodemailer";

/**
 * SMTP configuration from environment variables.
 * @private
 */
const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

/**
 * Email transporter instance.
 * @private
 */
let transporter: Transporter | null = null;

/**
 * Initialize email transporter.
 * @returns The configured transporter instance
 * @throws Error if SMTP credentials are not configured
 * @private
 */
function getTransporter(): Transporter {
  if (!SMTP_USER || !SMTP_PASS) {
    throw new Error(
      "SMTP credentials not configured. Please set SMTP_USER and SMTP_PASS environment variables."
    );
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }

  return transporter;
}

/**
 * Service for sending emails.
 * @public
 */
export class EmailService {
  /**
   * Send a magic link email for passwordless authentication.
   * @param email - Recipient email address
   * @param token - Magic link token
   * @param isRegistration - Whether this is for registration (true) or login (false)
   * @returns Promise that resolves when email is sent
   * @throws Error if email sending fails
   * @public
   */
  static async sendMagicLink(
    email: string,
    token: string,
    isRegistration: boolean = false
  ): Promise<void> {
    const emailType = isRegistration ? "registration" : "login";
    console.log(
      `[${new Date().toISOString()}] EMAIL | Preparing to send ${emailType} magic link email to: ${email}`
    );

    try {
      const mailTransporter = getTransporter();
      const magicLink = `${FRONTEND_URL}/auth/verify-magic-link?token=${token}`;
      const subject = isRegistration
        ? "🌱 Welcome to Habitus! Verify your email to complete registration"
        : "🌱 Your login link to Habitus";
      const text = isRegistration
        ? `🌱 Welcome to Habitus! Click the link below to verify your email and complete your registration to Habitus:\n\n${magicLink}\n\nThis link will expire in 15 minutes.\n\nIf you didn't request this, please ignore this email.`
        : `🌱 Click the link below to log into Habitus:\n\n${magicLink}\n\nThis link will expire in 15 minutes.\n\nIf you didn't request this, please ignore this email.`;

      console.log(
        `[${new Date().toISOString()}] EMAIL | Sending ${emailType} magic link email via SMTP (${SMTP_HOST}:${SMTP_PORT})`
      );

      const info = await mailTransporter.sendMail({
        from: SMTP_USER,
        to: email,
        subject,
        text,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">${
              isRegistration ? "Welcome!" : "Login Request"
            }</h2>
            <p>${
              isRegistration
                ? "🌱 Click the link below to verify your email and complete your registration to Habitus:"
                : "🌱 Click the link below to log into Habitus:"
            }</p>
            <p style="margin: 30px 0;">
              <a href="${magicLink}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                ${isRegistration ? "Verify Email" : "Log In"}
              </a>
            </p>
            <p style="color: #666; font-size: 14px;">This link will expire in 15 minutes.</p>
            <p style="color: #666; font-size: 14px;">If you didn't request this, please ignore this email.</p>
          </div>
        `,
      });

      console.log(
        `[${new Date().toISOString()}] EMAIL | ${emailType} magic link email sent successfully to: ${email}, messageId: ${
          info.messageId
        }`
      );
    } catch (error: any) {
      console.error(
        `[${new Date().toISOString()}] EMAIL | Error sending ${emailType} magic link email to ${email}:`,
        error
      );

      // Check for Gmail app-specific password requirement
      if (
        error.code === "EAUTH" &&
        (error.responseCode === 534 ||
          (error.response &&
            error.response.includes("Application-specific password required")))
      ) {
        throw new Error(
          "SMTP authentication failed: Application-specific password required. " +
            "For Gmail accounts with 2FA enabled, you must use an app-specific password. " +
            "Generate one at: https://myaccount.google.com/apppasswords " +
            "Then set SMTP_PASS in your .env file to the generated app password."
        );
      }

      // Check for other authentication errors
      if (error.code === "EAUTH") {
        throw new Error(
          `SMTP authentication failed: ${error.response || error.message}. ` +
            "Please verify your SMTP_USER and SMTP_PASS environment variables are correct."
        );
      }

      throw new Error(
        `Failed to send magic link email: ${error.message || "Unknown error"}`
      );
    }
  }
}
