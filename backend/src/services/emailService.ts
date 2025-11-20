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
    try {
      const mailTransporter = getTransporter();
      const magicLink = `${FRONTEND_URL}/auth/verify-magic-link?token=${token}`;
      const subject = isRegistration
        ? "Welcome! Verify your email to complete registration"
        : "Your login link";
      const text = isRegistration
        ? `Welcome! Click the link below to verify your email and complete your registration:\n\n${magicLink}\n\nThis link will expire in 15 minutes.\n\nIf you didn't request this, please ignore this email.`
        : `Click the link below to log in:\n\n${magicLink}\n\nThis link will expire in 15 minutes.\n\nIf you didn't request this, please ignore this email.`;

      await mailTransporter.sendMail({
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
                ? "Click the link below to verify your email and complete your registration:"
                : "Click the link below to log in:"
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
    } catch (error) {
      console.error("Error sending magic link email:", error);
      throw new Error("Failed to send magic link email");
    }
  }
}
