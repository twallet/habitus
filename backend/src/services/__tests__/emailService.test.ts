import { EmailService, SmtpConfig } from "../emailService.js";
import nodemailer from "nodemailer";

// Mock nodemailer
jest.mock("nodemailer");

describe("EmailService", () => {
  let emailService: EmailService;
  let mockTransporter: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({ messageId: "test-message-id" }),
    };
    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should use environment variables when no config provided", () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        SMTP_HOST: "smtp.test.com",
        SMTP_PORT: "465",
        SMTP_USER: "test@test.com",
        SMTP_PASS: "testpass",
        FRONTEND_URL: "http://test.com",
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
      const originalEnv = process.env;
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_PORT;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;
      delete process.env.FRONTEND_URL;

      emailService = new EmailService();
      expect(emailService).toBeInstanceOf(EmailService);

      process.env = originalEnv;
    });
  });

  describe("sendMagicLink", () => {
    beforeEach(() => {
      emailService = new EmailService({
        host: "smtp.test.com",
        port: 587,
        user: "test@test.com",
        pass: "testpass",
        frontendUrl: "http://test.com",
      });
    });

    it("should send registration magic link email successfully", async () => {
      await emailService.sendMagicLink("user@example.com", "test-token", true);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "test@test.com",
          to: "user@example.com",
          subject: "🌱 Welcome to Habitus! Verify your email to complete registration",
        })
      );
    });

    it("should send login magic link email successfully", async () => {
      await emailService.sendMagicLink("user@example.com", "test-token", false);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "test@test.com",
          to: "user@example.com",
          subject: "🌱 Your login link to Habitus",
        })
      );
    });

    it("should include magic link in email", async () => {
      await emailService.sendMagicLink("user@example.com", "test-token", true);

      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.text).toContain("http://test.com/auth/verify-magic-link?token=test-token");
      expect(callArgs.html).toContain("http://test.com/auth/verify-magic-link?token=test-token");
    });

    it("should throw error when SMTP credentials are missing", async () => {
      emailService = new EmailService({
        host: "smtp.test.com",
        port: 587,
        user: "",
        pass: "",
        frontendUrl: "http://test.com",
      });

      await expect(
        emailService.sendMagicLink("user@example.com", "test-token", true)
      ).rejects.toThrow("SMTP credentials not configured");
    });

    it("should throw error for Gmail app-specific password requirement", async () => {
      const error: any = new Error("Authentication failed");
      error.code = "EAUTH";
      error.responseCode = 534;
      mockTransporter.sendMail.mockRejectedValueOnce(error);

      await expect(
        emailService.sendMagicLink("user@example.com", "test-token", true)
      ).rejects.toThrow("Application-specific password required");
    });

    it("should throw error for other EAUTH errors", async () => {
      const error: any = new Error("Invalid credentials");
      error.code = "EAUTH";
      error.response = "Invalid login";
      mockTransporter.sendMail.mockRejectedValueOnce(error);

      await expect(
        emailService.sendMagicLink("user@example.com", "test-token", true)
      ).rejects.toThrow("SMTP authentication failed");
    });

    it("should throw error for generic email sending failures", async () => {
      const error = new Error("Network error");
      mockTransporter.sendMail.mockRejectedValueOnce(error);

      await expect(
        emailService.sendMagicLink("user@example.com", "test-token", true)
      ).rejects.toThrow("Failed to send magic link email");
    });

    it("should use secure connection for port 465", () => {
      emailService = new EmailService({
        host: "smtp.test.com",
        port: 465,
        user: "test@test.com",
        pass: "testpass",
        frontendUrl: "http://test.com",
      });

      // Trigger transporter creation
      emailService.sendMagicLink("user@example.com", "test-token", true);

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          secure: true,
        })
      );
    });

    it("should reuse transporter instance", async () => {
      await emailService.sendMagicLink("user@example.com", "test-token-1", true);
      await emailService.sendMagicLink("user@example.com", "test-token-2", false);

      expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(2);
    });
  });
});

