import nodemailer, { Transporter } from "nodemailer";
import { ServerConfig } from "../setup/constants.js";
import { DateUtils } from "@habitus/shared/utils";

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
  fromEmail?: string; // Optional: email address to use as sender (from). If not provided, uses user.
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
      fromEmail:
        config?.fromEmail !== undefined
          ? config.fromEmail
          : process.env.SMTP_FROM_EMAIL || undefined,
      frontendUrl:
        config?.frontendUrl ||
        (() => {
          const serverUrl = ServerConfig.getServerUrl();
          // In production with custom domain, don't include port (Railway handles routing)
          // If URL already includes protocol (http/https), use it as-is
          // Otherwise, only add port in development (localhost)
          if (
            serverUrl.startsWith("https://") ||
            serverUrl.startsWith("http://")
          ) {
            // Production: use URL as-is (no port needed)
            // Development: add port if it's localhost
            if (
              serverUrl.includes("localhost") ||
              serverUrl.includes("127.0.0.1")
            ) {
              return `${serverUrl}:${ServerConfig.getPort()}`;
            }
            return serverUrl;
          }
          // Fallback: add port if URL doesn't have protocol
          return `${serverUrl}:${ServerConfig.getPort()}`;
        })(),
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
      const isSecure = this.config.port === 465;
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: isSecure, // true for 465, false for other ports
        // For port 587, use STARTTLS
        requireTLS: !isSecure && this.config.port === 587,
        // Increase timeouts to handle slow SMTP servers
        connectionTimeout: 30000, // 30 seconds to establish connection
        greetingTimeout: 30000, // 30 seconds to receive greeting
        socketTimeout: 60000, // 60 seconds for socket operations
        // Additional options for better connection handling
        tls: {
          // Do not fail on invalid certificates (some SMTP servers have self-signed certs)
          rejectUnauthorized: false,
          // Allow legacy TLS versions if needed
          minVersion: "TLSv1",
        },
        // Enable debug logging in development
        debug: process.env.NODE_ENV !== "production",
        logger: process.env.NODE_ENV !== "production",
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

    // Retry mechanism for SMTP connection issues
    const maxRetries = 3;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Create a fresh transporter for each attempt to avoid stale connections
        if (this.transporter) {
          this.transporter.close();
          this.transporter = null;
        }

        const mailTransporter = this.getTransporter();
        // Encode token for URL to handle any special characters properly
        const encodedToken = encodeURIComponent(token);
        const magicLink = `${this.config.frontendUrl}/auth/verify-magic-link?token=${encodedToken}`;
        const subject = isRegistration
          ? "Welcome to 🌱 Habitus! Verify your email to complete registration"
          : "Your login link to 🌱 Habitus";
        const text = isRegistration
          ? `Welcome to 🌱 Habitus! Click the link below to verify your email and complete your registration to 🌱 Habitus:\n\n${magicLink}\n\nThis link will expire in 15 minutes.\nIf you didn't request this, please ignore this email.`
          : `Click the link below to log into 🌱 Habitus:\n\n${magicLink}\n\nThis link will expire in 15 minutes.\nIf you didn't request this, please ignore this email.`;

        if (attempt > 1) {
          console.log(
            `[${new Date().toISOString()}] EMAIL | Retry attempt ${attempt}/${maxRetries} for ${emailType} magic link to ${email}`
          );
        } else {
          console.log(
            `[${new Date().toISOString()}] EMAIL | Sending ${emailType} magic link email via SMTP (${
              this.config.host
            }:${this.config.port})`
          );
        }

        const info = await mailTransporter.sendMail({
          from: this.config.fromEmail || this.config.user,
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
                      isRegistration
                        ? "Welcome to 🌱 Habitus!"
                        : "Login Request"
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
        return; // Success, exit retry loop
      } catch (error: any) {
        lastError = error;

        // Log retry attempt
        if (attempt < maxRetries) {
          console.warn(
            `[${new Date().toISOString()}] EMAIL | Attempt ${attempt}/${maxRetries} failed for ${emailType} magic link to ${email}, retrying in ${
              2 * attempt
            }s...`,
            error.message || error.code
          );
          // Wait before retry (exponential backoff: 2s, 4s)
          await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
          continue;
        }

        // All retries exhausted, log final error
        console.error(
          `[${new Date().toISOString()}] EMAIL | All ${maxRetries} attempts failed for ${emailType} magic link email to ${email}:`,
          error
        );

        // Check for Gmail app-specific password requirement
        if (
          lastError.code === "EAUTH" &&
          (lastError.responseCode === 534 ||
            (lastError.response &&
              lastError.response.includes(
                "Application-specific password required"
              )))
        ) {
          throw new Error(
            "SMTP authentication failed: Application-specific password required. " +
              "For Gmail accounts with 2FA enabled, you must use an app-specific password. " +
              "Generate one at: https://myaccount.google.com/apppasswords " +
              "Then set SMTP_PASS in your .env file to the generated app password."
          );
        }

        // Check for other authentication errors
        if (lastError.code === "EAUTH") {
          throw new Error(
            `SMTP authentication failed: ${
              lastError.response || lastError.message
            }. ` +
              "Please verify your SMTP_USER and SMTP_PASS environment variables are correct."
          );
        }

        const linkType = isRegistration ? "registration link" : "login link";
        throw new Error(
          `Failed to send ${linkType} email after ${maxRetries} attempts: ${
            lastError.message || lastError.code || "Unknown error"
          }`
        );
      }
    }
  }

  /**
   * Send a reminder email with action buttons.
   * @param email - Recipient email address
   * @param reminderId - Reminder ID
   * @param trackingQuestion - Tracking question text
   * @param scheduledTime - Scheduled time for the reminder
   * @param trackingIcon - Tracking icon (emoji)
   * @param trackingNotes - Optional tracking notes
   * @param notes - Optional reminder notes
   * @returns Promise that resolves when email is sent
   * @throws Error if email sending fails
   * @public
   */
  async sendReminderEmail(
    email: string,
    reminderId: number,
    trackingQuestion: string,
    scheduledTime: string,
    trackingIcon?: string,
    trackingNotes?: string,
    notes?: string,
    locale?: string,
    timezone?: string
  ): Promise<void> {
    console.log(
      `[${new Date().toISOString()}] EMAIL | Preparing to send reminder email to: ${email}, reminderId: ${reminderId}`
    );

    const dashboardUrl = `${this.config.frontendUrl}/`;
    const baseUrl = `${dashboardUrl}?reminderId=${reminderId}`;
    const addNotesUrl = `${baseUrl}&action=editNotes`;
    const completeUrl = `${baseUrl}&action=complete`;
    const dismissUrl = `${baseUrl}&action=dismiss`;
    const snoozeUrl = `${baseUrl}&action=snooze`;

    const formattedTime = DateUtils.formatDateTime(
      scheduledTime,
      locale || "es-AR",
      timezone,
      {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    );

    const icon = trackingIcon || "📝";
    const subject = `🌱 Habitus reminder for ${icon} ${trackingQuestion}`;
    const text = `You have a pending reminder:\n\n${icon} ${trackingQuestion}\n\nScheduled for: ${formattedTime}${
      trackingNotes ? `\n\nTracking notes: ${trackingNotes}` : ""
    }\n\nAvailable actions:\n- Add Notes: ${addNotesUrl}\n- Complete: ${completeUrl}\n- Dismiss: ${dismissUrl}\n- Snooze: ${snoozeUrl}`;

    const html = `
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
              <h2 style="color: #333; text-align: left; margin: 0 0 16px 0; font-size: 24px; font-weight: bold;">🌱 Pending reminder</h2>
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 4px; margin-bottom: 24px;">
                <p style="color: #333; font-size: 18px; font-weight: bold; margin: 0 0 12px 0; line-height: 1.5; display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 1.2em;">${icon}</span>
                  <span>${this.escapeHtml(trackingQuestion)}</span>
                </p>
                <p style="color: #666; font-size: 14px; margin: 8px 0 0 0; line-height: 1.5;">
                  <strong>Scheduled for:</strong> ${this.escapeHtml(
                    formattedTime
                  )}
                </p>
                ${
                  trackingNotes
                    ? `<p style="color: #666; font-size: 14px; margin: 8px 0 0 0; line-height: 1.5; white-space: pre-wrap;">${this.escapeHtml(
                        trackingNotes
                      )}</p>`
                    : ""
                }
                <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #dee2e6;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0; border-collapse: collapse;">
                    <tr>
                      <td style="padding-right: 4px;">
                        <a href="${addNotesUrl}" style="background-color: #fff3cd; border: 1px solid #ffc107; color: #856404; padding: 8px 16px; text-decoration: none; border-radius: 4px; display: inline-block; text-align: center; font-weight: 500; font-size: 14px; white-space: nowrap;">
                          📝 Add Notes
                        </a>
                      </td>
                      <td style="padding-right: 4px;">
                        <a href="${completeUrl}" style="background-color: #c8e6c9; border: 1px solid #66bb6a; color: #2e7d32; padding: 8px 16px; text-decoration: none; border-radius: 4px; display: inline-block; text-align: center; font-weight: 500; font-size: 14px; white-space: nowrap;">
                          ✓ Complete
                        </a>
                      </td>
                      <td style="padding-right: 4px;">
                        <a href="${dismissUrl}" style="background-color: #ffcdd2; border: 1px solid #ef5350; color: #c62828; padding: 8px 16px; text-decoration: none; border-radius: 4px; display: inline-block; text-align: center; font-weight: 500; font-size: 14px; white-space: nowrap;">
                          ✕ Dismiss
                        </a>
                      </td>
                      <td>
                        <a href="${snoozeUrl}" style="background-color: #e1bee7; border: 1px solid #ba68c8; color: #6a1b9a; padding: 8px 16px; text-decoration: none; border-radius: 4px; display: inline-block; text-align: center; font-weight: 500; font-size: 14px; white-space: nowrap;">
                          💤 Snooze
                        </a>
                      </td>
                    </tr>
                  </table>
                </div>
              </div>
              <p style="color: #666; font-size: 14px; text-align: left; margin: 24px 0 0 0; line-height: 1.5;">
                Visit your <a href="${dashboardUrl}" style="color: #007bff; text-decoration: none;">dashboard</a> to manage all your reminders.
              </p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    await this.sendEmail(email, subject, text, html);

    console.log(
      `[${new Date().toISOString()}] EMAIL | Reminder email sent successfully to: ${email}, reminderId: ${reminderId}`
    );
  }

  /**
   * Escape HTML special characters to prevent XSS.
   * @param text - Text to escape
   * @returns Escaped text
   * @private
   */
  private escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
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
        from: this.config.fromEmail || this.config.user,
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
