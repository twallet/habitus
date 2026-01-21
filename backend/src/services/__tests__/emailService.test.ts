import { vi, type Mock } from "vitest";
import { EmailService, SmtpConfig } from "../emailService.js";
import nodemailer from "nodemailer";

// Mock nodemailer
vi.mock("nodemailer");

describe("EmailService", () => {
  let emailService: EmailService;
  let mockTransporter: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTransporter = {
      sendMail: vi.fn().mockResolvedValue({ messageId: "test-message-id" }),
      close: vi.fn().mockResolvedValue(undefined),
    };
    (nodemailer.createTransport as Mock).mockReturnValue(mockTransporter);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should use environment variables when no config provided", () => {
      const originalEnv = process.env;
      // Use environment variables from .env files
      const testServerUrl = process.env.VITE_SERVER_URL || "http://test.com";
      const testPort = process.env.VITE_PORT || "3005";
      process.env = {
        ...originalEnv,
        SMTP_HOST: "smtp.test.com",
        SMTP_PORT: "465",
        SMTP_USER: "test@test.com",
        SMTP_PASS: "testpass",
        VITE_SERVER_URL: testServerUrl,
        VITE_PORT: testPort,
      };

      emailService = new EmailService();
      expect(nodemailer.createTransport).not.toHaveBeenCalled();

      process.env = originalEnv;
    });

    it("should use provided config over environment variables", () => {
      const config: Partial<SmtpConfig> = {
        host: "custom.host.com",
        port: 587,
        user: "custom@test.com",
        pass: "custompass",
        frontendUrl: "http://custom.com",
      };

      emailService = new EmailService(config);
      expect(emailService).toBeInstanceOf(EmailService);
    });

    it("should use defaults when no config or environment variables", () => {
      const originalEnv = { ...process.env };
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_PORT;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;
      // Keep VITE_SERVER_URL and VITE_PORT as they are required by ServerConfig.getServerUrl() and ServerConfig.getPort()
      // These are set by setupTests.ts, so we don't need to delete them

      emailService = new EmailService();
      expect(emailService).toBeInstanceOf(EmailService);

      process.env = originalEnv;
    });
  });

  describe("sendMagicLink", () => {
    beforeEach(() => {
      emailService = new EmailService({
        brevoApiKey: "", // Explicitly disable Brevo API to use SMTP (empty string becomes null internally)
        host: "smtp.test.com",
        port: 587,
        user: "test@test.com",
        pass: "testpass",
        fromEmail: "test@test.com", // Explicitly set to override environment variables
        fromName: "", // Explicitly disable fromName (empty string prevents using env var)
        frontendUrl: "http://test.com",
      });
    });

    it("should send registration magic link email successfully", async () => {
      await emailService.sendMagicLink("user@example.com", "test-token", true);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "test@test.com",
          to: "user@example.com",
          subject:
            "Welcome to 🌱 Habitus! Verify your email to complete registration",
        })
      );
    });

    it("should send login magic link email successfully", async () => {
      await emailService.sendMagicLink("user@example.com", "test-token", false);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "test@test.com",
          to: "user@example.com",
          subject: "Your login link to 🌱 Habitus",
        })
      );
    });

    it("should include magic link in email", async () => {
      await emailService.sendMagicLink("user@example.com", "test-token", true);

      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.text).toContain(
        "http://test.com/auth/verify-magic-link?token=test-token"
      );
      expect(callArgs.html).toContain(
        "http://test.com/auth/verify-magic-link?token=test-token"
      );
    });

    it("should throw error when SMTP credentials are missing", async () => {
      // Create a new EmailService with empty credentials
      // This should cause getTransporter() to throw before creating the transporter
      const serviceWithEmptyCreds = new EmailService({
        brevoApiKey: "", // Explicitly disable Brevo API to use SMTP (empty string becomes null internally)
        host: "smtp.test.com",
        port: 587,
        user: "",
        pass: "",
        frontendUrl: "http://test.com",
      });

      await expect(
        serviceWithEmptyCreds.sendMagicLink(
          "user@example.com",
          "test-token",
          true
        )
      ).rejects.toThrow(/SMTP credentials not configured/);
    });

    it("should throw error for Gmail app-specific password requirement", async () => {
      const error: any = new Error("Authentication failed");
      error.code = "EAUTH";
      error.responseCode = 534;
      // Mock will be called 3 times (retry attempts)
      mockTransporter.sendMail.mockRejectedValue(error);

      await expect(
        emailService.sendMagicLink("user@example.com", "test-token", true)
      ).rejects.toThrow(/Application-specific password required/);

      // Should have attempted 3 times
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(3);
    });

    it("should throw error for other EAUTH errors", async () => {
      const error: any = new Error("Invalid credentials");
      error.code = "EAUTH";
      error.response = "Invalid login";
      // Mock will be called 3 times (retry attempts)
      mockTransporter.sendMail.mockRejectedValue(error);

      await expect(
        emailService.sendMagicLink("user@example.com", "test-token", true)
      ).rejects.toThrow(/SMTP authentication failed/);

      // Should have attempted 3 times
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(3);
    });

    it("should throw error for generic email sending failures", async () => {
      const error = new Error("Network error");
      // Mock will be called 3 times (retry attempts)
      mockTransporter.sendMail.mockRejectedValue(error);

      await expect(
        emailService.sendMagicLink("user@example.com", "test-token", true)
      ).rejects.toThrow(
        /Failed to send registration link email after 3 attempts/
      );

      // Should have attempted 3 times
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(3);
    });

    it("should use secure connection for port 465", async () => {
      emailService = new EmailService({
        brevoApiKey: "", // Explicitly disable Brevo API to use SMTP (empty string becomes null internally)
        host: "smtp.test.com",
        port: 465,
        user: "test@test.com",
        pass: "testpass",
        fromEmail: "test@test.com", // Explicitly set to override environment variables
        fromName: "", // Explicitly disable fromName (empty string prevents using env var)
        frontendUrl: "http://test.com",
      });

      // Trigger transporter creation
      await emailService.sendMagicLink("user@example.com", "test-token", true);

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          secure: true,
        })
      );
    });

    it("should create new transporter for each send (due to retry mechanism)", async () => {
      await emailService.sendMagicLink(
        "user@example.com",
        "test-token-1",
        true
      );
      await emailService.sendMagicLink(
        "user@example.com",
        "test-token-2",
        false
      );

      // Each send creates a new transporter (closes old one and creates new)
      // But since both succeed on first try, transporter is created once per send
      expect(nodemailer.createTransport).toHaveBeenCalledTimes(2);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(2);
    });
  });

  describe("sendEmail", () => {
    beforeEach(() => {
      emailService = new EmailService({
        brevoApiKey: "", // Explicitly disable Brevo API to use SMTP (empty string becomes null internally)
        host: "smtp.test.com",
        port: 587,
        user: "test@test.com",
        pass: "testpass",
        fromEmail: "test@test.com", // Explicitly set to override environment variables
        fromName: "", // Explicitly disable fromName (empty string prevents using env var)
        frontendUrl: "http://test.com",
      });
    });

    it("should send email successfully", async () => {
      await emailService.sendEmail(
        "user@example.com",
        "Test Subject",
        "Test body"
      );

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "test@test.com",
          to: "user@example.com",
          subject: "Test Subject",
          text: "Test body",
        })
      );
    });

    it("should send email with HTML content", async () => {
      const html = "<h1>Test HTML</h1>";
      await emailService.sendEmail(
        "user@example.com",
        "Test Subject",
        "Test body",
        html
      );

      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.html).toBe(html);
    });

    it("should convert newlines to <br> when no HTML provided", async () => {
      await emailService.sendEmail(
        "user@example.com",
        "Test Subject",
        "Line 1\nLine 2"
      );

      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.html).toBe("Line 1<br>Line 2");
    });

    it("should send email change verification email with button", async () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <body>
          <h2>Verify your new email address</h2>
          <a href="http://test.com/api/auth/verify-email-change?token=test-token">Verify email address</a>
        </body>
        </html>
      `;
      await emailService.sendEmail(
        "newemail@example.com",
        "Verify your new email address for 🌱 Habitus",
        "Please click the following link to verify your new email address: http://test.com/api/auth/verify-email-change?token=test-token",
        html
      );

      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.to).toBe("newemail@example.com");
      expect(callArgs.subject).toBe(
        "Verify your new email address for 🌱 Habitus"
      );
      expect(callArgs.html).toContain("Verify your new email address");
      expect(callArgs.html).toContain("Verify email address");
      expect(callArgs.html).toContain(
        "http://test.com/api/auth/verify-email-change?token=test-token"
      );
    });

    it("should throw error when SMTP credentials are missing", async () => {
      // Create a new EmailService with empty credentials
      // This should cause getTransporter() to throw before creating the transporter
      const serviceWithEmptyCreds = new EmailService({
        brevoApiKey: "", // Explicitly disable Brevo API to use SMTP (empty string becomes null internally)
        host: "smtp.test.com",
        port: 587,
        user: "",
        pass: "",
        frontendUrl: "http://test.com",
      });

      await expect(
        serviceWithEmptyCreds.sendEmail("user@example.com", "Test", "Body")
      ).rejects.toThrow(/SMTP credentials not configured/);
    });

    it("should throw error for Gmail app-specific password requirement", async () => {
      const error: any = new Error("Authentication failed");
      error.code = "EAUTH";
      error.responseCode = 534;
      mockTransporter.sendMail.mockRejectedValueOnce(error);

      await expect(
        emailService.sendEmail("user@example.com", "Test", "Body")
      ).rejects.toThrow(/Application-specific password required/);
    });

    it("should throw error for other EAUTH errors", async () => {
      const error: any = new Error("Invalid credentials");
      error.code = "EAUTH";
      error.response = "Invalid login";
      // sendEmail doesn't have retry, so only one attempt
      mockTransporter.sendMail.mockRejectedValueOnce(error);

      await expect(
        emailService.sendEmail("user@example.com", "Test", "Body")
      ).rejects.toThrow(/SMTP authentication failed/);
    });

    it("should throw error for generic email sending failures", async () => {
      const error = new Error("Network error");
      mockTransporter.sendMail.mockRejectedValueOnce(error);

      await expect(
        emailService.sendEmail("user@example.com", "Test", "Body")
      ).rejects.toThrow(/Failed to send email/);
    });
  });

  describe("sendReminderEmail", () => {
    beforeEach(() => {
      emailService = new EmailService({
        brevoApiKey: "", // Explicitly disable Brevo API to use SMTP (empty string becomes null internally)
        host: "smtp.test.com",
        port: 587,
        user: "test@test.com",
        pass: "testpass",
        fromEmail: "test@test.com", // Explicitly set to override environment variables
        fromName: "", // Explicitly disable fromName (empty string prevents using env var)
        frontendUrl: "http://test.com",
      });
    });

    it("should send reminder email successfully", async () => {
      await emailService.sendReminderEmail(
        "user@example.com",
        123,
        "Did you exercise today?",
        "2024-01-01T10:00:00Z",
        "🏃",
        "Tracking details",
        "Reminder notes"
      );

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "test@test.com",
          to: "user@example.com",
          subject: expect.stringContaining("Habitus reminder for"),
        })
      );

      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.subject).toContain("🏃");
      expect(callArgs.subject).toContain("Did you exercise today?");
      expect(callArgs.text).toContain("Did you exercise today?");
      expect(callArgs.html).toContain("Pending reminder");
      expect(callArgs.html).toContain("Did you exercise today?");
      expect(callArgs.html).toContain("Tracking details");
      expect(callArgs.html).toContain("Add Notes");
      expect(callArgs.html).toContain("Complete");
      expect(callArgs.html).toContain("Dismiss");
      expect(callArgs.html).toContain("Snooze");
      expect(callArgs.html).toContain("reminderId=123");
      expect(callArgs.html).toContain("action=editNotes");
      expect(callArgs.html).toContain("action=complete");
      expect(callArgs.html).toContain("action=dismiss");
      expect(callArgs.html).toContain("action=snooze");
    });

    it("should send reminder email without tracking details", async () => {
      await emailService.sendReminderEmail(
        "user@example.com",
        456,
        "Did you meditate?",
        "2024-01-01T10:00:00Z",
        "🧘"
      );

      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.html).toContain("Add Notes");
      expect(callArgs.html).not.toContain("Tracking details");
    });

    it("should use default icon when tracking icon is not provided", async () => {
      await emailService.sendReminderEmail(
        "user@example.com",
        789,
        "Test question",
        "2024-01-01T10:00:00Z",
        undefined,
        undefined,
        undefined
      );

      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.subject).toContain("📝");
      expect(callArgs.html).toContain("📝");
    });

    it("should include Add Notes button in email", async () => {
      await emailService.sendReminderEmail(
        "user@example.com",
        123,
        "Test question",
        "2024-01-01T10:00:00Z",
        undefined,
        undefined,
        undefined
      );

      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.html).toContain("Add Notes");
      expect(callArgs.html).toContain("action=editNotes");
      expect(callArgs.html).toContain("reminderId=123");
    });

    it("should format scheduled time correctly", async () => {
      await emailService.sendReminderEmail(
        "user@example.com",
        123,
        "Test question",
        "2024-01-01T10:30:00Z",
        undefined,
        undefined,
        undefined
      );

      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.html).toContain("Scheduled for:");
      expect(callArgs.text).toContain("Scheduled for:");
    });

    it("should display tracking details after scheduled time when provided", async () => {
      await emailService.sendReminderEmail(
        "user@example.com",
        123,
        "Test question",
        "2024-01-01T10:30:00Z",
        "💭",
        "These are tracking details",
        undefined
      );

      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.html).toContain("Scheduled for:");
      expect(callArgs.html).toContain("These are tracking details");
      expect(callArgs.text).toContain(
        "Tracking details: These are tracking details"
      );
    });

    it("should not display tracking details when empty", async () => {
      await emailService.sendReminderEmail(
        "user@example.com",
        123,
        "Test question",
        "2024-01-01T10:30:00Z",
        "💭",
        undefined,
        undefined
      );

      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.html).toContain("Scheduled for:");
      const scheduledForIndex = callArgs.html.indexOf("Scheduled for:");
      const addNotesIndex = callArgs.html.indexOf("Add Notes");
      expect(scheduledForIndex).toBeLessThan(addNotesIndex);
    });

    it("should throw error when SMTP credentials are missing", async () => {
      const serviceWithEmptyCreds = new EmailService({
        brevoApiKey: "", // Explicitly disable Brevo API to use SMTP (empty string becomes null internally)
        host: "smtp.test.com",
        port: 587,
        user: "",
        pass: "",
        frontendUrl: "http://test.com",
      });

      await expect(
        serviceWithEmptyCreds.sendReminderEmail(
          "user@example.com",
          123,
          "Test question",
          "2024-01-01T10:00:00Z",
          undefined,
          undefined,
          undefined
        )
      ).rejects.toThrow(/SMTP credentials not configured/);
    });

    it("should handle email sending errors", async () => {
      const error = new Error("Network error");
      mockTransporter.sendMail.mockRejectedValueOnce(error);

      await expect(
        emailService.sendReminderEmail(
          "user@example.com",
          123,
          "Test question",
          "2024-01-01T10:00:00Z",
          undefined,
          undefined,
          undefined
        )
      ).rejects.toThrow(/Failed to send email/);
    });
  });

  describe("Brevo API", () => {
    const originalFetch = global.fetch;
    let mockFetch: Mock;

    beforeEach(() => {
      mockFetch = vi.fn();
      global.fetch = mockFetch as any;
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it("should use Brevo API when BREVO_API_KEY is set", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ messageId: "brevo-message-id" }),
      } as Response);

      emailService = new EmailService({
        brevoApiKey: "test-api-key",
        fromEmail: "test@test.com",
        frontendUrl: "http://test.com",
      });

      await emailService.sendMagicLink("user@example.com", "test-token", true);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.brevo.com/v3/smtp/email",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "api-key": "test-api-key",
          }),
        })
      );

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.sender.email).toBe("test@test.com");
      expect(body.to[0].email).toBe("user@example.com");
      expect(body.subject).toContain("Welcome to 🌱 Habitus");
    });

    it("should include fromName in Brevo API request", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ messageId: "brevo-message-id" }),
      } as Response);

      emailService = new EmailService({
        brevoApiKey: "test-api-key",
        fromEmail: "test@test.com",
        fromName: "🌱 Habitus",
        frontendUrl: "http://test.com",
      });

      await emailService.sendEmail(
        "user@example.com",
        "Test Subject",
        "Test body"
      );

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.sender.name).toBe("🌱 Habitus");
      expect(body.sender.email).toBe("test@test.com");
    });

    it("should throw error if BREVO_API_KEY is set but SMTP_FROM_EMAIL is missing", async () => {
      // Mock fetch to avoid actual network call (error should be thrown before fetch)
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ messageId: "brevo-message-id" }),
      } as Response);

      emailService = new EmailService({
        brevoApiKey: "test-api-key",
        fromEmail: "", // Explicitly set to empty string to test missing fromEmail
        user: "", // Explicitly set to empty to ensure fromAddress is not set
        frontendUrl: "http://test.com",
      });

      await expect(
        emailService.sendMagicLink("user@example.com", "test-token", true)
      ).rejects.toThrow(/Sender email not configured/);

      // Fetch should not be called because error is thrown before
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should throw error if Brevo API returns error", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({
          message: "Invalid API key",
        }),
      } as Response);

      emailService = new EmailService({
        brevoApiKey: "invalid-api-key",
        fromEmail: "test@test.com",
        frontendUrl: "http://test.com",
      });

      await expect(
        emailService.sendMagicLink("user@example.com", "test-token", true)
      ).rejects.toThrow(/Brevo API error/);
    });

    it("should use SMTP when BREVO_API_KEY is not set", async () => {
      emailService = new EmailService({
        brevoApiKey: "", // Explicitly disable Brevo API to use SMTP (empty string becomes null internally)
        host: "smtp.test.com",
        port: 587,
        user: "test@test.com",
        pass: "testpass",
        frontendUrl: "http://test.com",
      });

      await emailService.sendMagicLink("user@example.com", "test-token", true);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockTransporter.sendMail).toHaveBeenCalled();
    });

    it("should use SMTP when BREVO_API_KEY is empty string", async () => {
      emailService = new EmailService({
        brevoApiKey: "",
        host: "smtp.test.com",
        port: 587,
        user: "test@test.com",
        pass: "testpass",
        frontendUrl: "http://test.com",
      });

      await emailService.sendMagicLink("user@example.com", "test-token", true);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockTransporter.sendMail).toHaveBeenCalled();
    });
  });
});


