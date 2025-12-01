import nodemailer, { Transporter } from "nodemailer";
import { ServerConfig } from "../setup/constants.js";

/**
 * SMTP configuration interface.
 * @public
 */
export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  frontendUrl: string;
}

/**
 * Service for sending emails.
 * @public
 */
export class EmailService {
  private transporter: Transporter | null = null;
  private config: SmtpConfig;

  /**
   * Create a new EmailService instance.
   * @param config - SMTP configuration (optional, uses environment variables if not provided)
   * @public
   */
  constructor(config?: Partial<SmtpConfig>) {
    this.config = {
      host: config?.host || process.env.SMTP_HOST || "smtp.gmail.com",
      port: config?.port || parseInt(process.env.SMTP_PORT || "587", 10),
      user:
        config?.user !== undefined ? config.user : process.env.SMTP_USER || "",
      pass:
        config?.pass !== undefined ? config.pass : process.env.SMTP_PASS || "",
      frontendUrl:
        config?.frontendUrl ||
        `${ServerConfig.getServerUrl()}:${ServerConfig.getPort()}`,
    };
  }

  /**
   * Get or create the email transporter instance.
   * @returns The configured transporter instance
   * @throws Error if SMTP credentials are not configured
   * @private
   */
  private getTransporter(): Transporter {
    if (!this.config.user || !this.config.pass) {
      throw new Error(
        "SMTP credentials not configured. Please set SMTP_USER and SMTP_PASS environment variables."
      );
    }

    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.port === 465,
        auth: {
          user: this.config.user,
          pass: this.config.pass,
        },
      });
    }

    return this.transporter;
  }

  /**
   * Send a magic link email for passwordless authentication.
   * @param email - Recipient email address
   * @param token - Magic link token
   * @param isRegistration - Whether this is for registration (true) or login (false)
   * @returns Promise that resolves when email is sent
   * @throws Error if email sending fails
   * @public
   */
  async sendMagicLink(
    email: string,
    token: string,
    isRegistration: boolean = false
  ): Promise<void> {
    const emailType = isRegistration ? "registration" : "login";
    console.log(
      `[${new Date().toISOString()}] EMAIL | Preparing to send ${emailType} magic link email to: ${email}`
    );

    try {
      const mailTransporter = this.getTransporter();
      const magicLink = `${this.config.frontendUrl}/auth/verify-magic-link?token=${token}`;
      const subject = isRegistration
        ? "Welcome to 🌱 Habitus! Verify your email to complete registration"
        : "Your login link to 🌱 Habitus";
      const text = isRegistration
        ? `Welcome to 🌱 Habitus! Click the link below to verify your email and complete your registration to 🌱 Habitus:\n\n${magicLink}\n\nThis link will expire in 15 minutes.\nIf you didn't request this, please ignore this email.`
        : `Click the link below to log into 🌱 Habitus:\n\n${magicLink}\n\nThis link will expire in 15 minutes.\nIf you didn't request this, please ignore this email.`;

      console.log(
        `[${new Date().toISOString()}] EMAIL | Sending ${emailType} magic link email via SMTP (${
          this.config.host
        }:${this.config.port})`
      );

      const info = await mailTransporter.sendMail({
        from: this.config.user,
        to: email,
        subject,
        text,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #ffffff;">
            <table role="presentation" style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 40px 30px; text-align: left;">
                  <h2 style="color: #333; text-align: left; margin: 0 0 16px 0; font-size: 24px; font-weight: bold;">${
                    isRegistration ? "Welcome to 🌱 Habitus!" : "Login Request"
                  }</h2>
                  <p style="text-align: left; margin: 0 0 16px 0; font-size: 16px; line-height: 1.5; color: #333;">${
                    isRegistration
                      ? "Click the link below to verify your email and complete your registration:"
                      : "Click the link below to log into 🌱 Habitus:"
                  }</p>
                  <p style="margin: 30px 0; text-align: left;">
                    <a href="${magicLink}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; text-align: center;">
                      ${isRegistration ? "Verify email" : "Log in"}
                    </a>
                  </p>
                  <p style="color: #666; font-size: 14px; text-align: left; margin: 0 0 8px 0; line-height: 1.5;">This link will expire in 15 minutes. If you didn't request this, please ignore this email.</p>
                </td>
              </tr>
            </table>
          </body>
          </html>
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

      const linkType = isRegistration ? "registration link" : "login link";
      throw new Error(
        `Failed to send ${linkType} email: ${error.message || "Unknown error"}`
      );
    }
  }

  /**
   * Send a generic email.
   * @param email - Recipient email address
   * @param subject - Email subject
   * @param text - Email body text
   * @param html - Optional HTML email body
   * @returns Promise that resolves when email is sent
   * @throws Error if email sending fails
   * @public
   */
  async sendEmail(
    email: string,
    subject: string,
    text: string,
    html?: string
  ): Promise<void> {
    console.log(
      `[${new Date().toISOString()}] EMAIL | Preparing to send email to: ${email}, subject: ${subject}`
    );

    try {
      const mailTransporter = this.getTransporter();

      console.log(
        `[${new Date().toISOString()}] EMAIL | Sending email via SMTP (${
          this.config.host
        }:${this.config.port})`
      );

      const info = await mailTransporter.sendMail({
        from: this.config.user,
        to: email,
        subject,
        text,
        html: html || text.replace(/\n/g, "<br>"),
      });

      console.log(
        `[${new Date().toISOString()}] EMAIL | Email sent successfully to: ${email}, messageId: ${
          info.messageId
        }`
      );
    } catch (error: any) {
      console.error(
        `[${new Date().toISOString()}] EMAIL | Error sending email to ${email}:`,
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
        `Failed to send email: ${error.message || "Unknown error"}`
      );
    }
  }
}
