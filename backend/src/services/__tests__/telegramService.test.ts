import { vi, type Mock } from "vitest";
import { TelegramService, TelegramConfig } from "../telegramService.js";

// Mock global fetch
global.fetch = vi.fn() as Mock;

describe("TelegramService", () => {
  let telegramService: TelegramService;
  let mockFetch: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch = global.fetch as Mock;
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should use environment variables when no config provided", () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        TELEGRAM_BOT_TOKEN: "test-bot-token",
      };

      telegramService = new TelegramService();
      expect(telegramService).toBeInstanceOf(TelegramService);

      process.env = originalEnv;
    });

    it("should use provided config over environment variables", () => {
      const config: Partial<TelegramConfig> = {
        botToken: "custom-bot-token",
        frontendUrl: "http://custom.com",
      };

      telegramService = new TelegramService(config);
      expect(telegramService).toBeInstanceOf(TelegramService);
    });
  });

  describe("sendWelcomeMessage", () => {
    beforeEach(() => {
      telegramService = new TelegramService({
        botToken: "test-bot-token",
        frontendUrl: "http://test.com",
      });
    });

    it("should send welcome message successfully", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          ok: true,
          result: {
            message_id: 123,
          },
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await telegramService.sendWelcomeMessage(
        "123456789",
        1,
        "http://test.com"
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[0]).toBe(
        "https://api.telegram.org/bot/test-bot-token/sendMessage"
      );
      expect(callArgs[1]).toMatchObject({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const body = JSON.parse(callArgs[1].body);
      expect(body.chat_id).toBe("123456789");
      expect(body.parse_mode).toBe("Markdown");
      expect(body.text).toContain("Welcome to Habitus!");
    });

    it("should include app link in welcome message", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          ok: true,
          result: {
            message_id: 123,
          },
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const frontendUrl = "http://test.com/dashboard";
      await telegramService.sendWelcomeMessage("123456789", 1, frontendUrl);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.text).toContain(frontendUrl);
      expect(body.text).toContain("Go to Dashboard");
    });

    it("should format welcome message correctly", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          ok: true,
          result: {
            message_id: 123,
          },
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await telegramService.sendWelcomeMessage(
        "123456789",
        1,
        "http://test.com"
      );

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      const messageText = body.text;

      // Check message formatting
      expect(messageText).toContain("🎉");
      expect(messageText).toContain("*Welcome to Habitus!*");
      expect(messageText).toContain(
        "Your Telegram account has been successfully connected"
      );
      expect(messageText).toContain(
        "You will now receive reminders via Telegram"
      );
      expect(messageText).toContain("[Go to Dashboard](http://test.com)");
      expect(body.parse_mode).toBe("Markdown");
    });

    it("should throw error when bot token is not configured", async () => {
      telegramService = new TelegramService({
        botToken: "",
        frontendUrl: "http://test.com",
      });

      await expect(
        telegramService.sendWelcomeMessage("123456789", 1, "http://test.com")
      ).rejects.toThrow("Telegram bot token not configured");
    });

    it("should throw error when chat ID is missing", async () => {
      await expect(
        telegramService.sendWelcomeMessage("", 1, "http://test.com")
      ).rejects.toThrow("Telegram chat ID is required");
    });

    it("should throw error when Telegram API returns error", async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: vi.fn().mockResolvedValue({
          ok: false,
          description: "Chat not found",
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await expect(
        telegramService.sendWelcomeMessage("123456789", 1, "http://test.com")
      ).rejects.toThrow("Telegram API error");
    });

    it("should throw error when Telegram API response is not ok", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          ok: false,
          description: "Unauthorized",
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await expect(
        telegramService.sendWelcomeMessage("123456789", 1, "http://test.com")
      ).rejects.toThrow("Telegram API error");
    });

    it("should handle chat not found error specifically", async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: vi.fn().mockResolvedValue({
          ok: false,
          description: "chat not found",
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await expect(
        telegramService.sendWelcomeMessage("123456789", 1, "http://test.com")
      ).rejects.toThrow("Telegram chat not found");
    });

    it("should handle invalid bot token error specifically", async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: vi.fn().mockResolvedValue({
          ok: false,
          description: "bot token is invalid",
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await expect(
        telegramService.sendWelcomeMessage("123456789", 1, "http://test.com")
      ).rejects.toThrow("Telegram bot token is invalid");
    });

    it("should handle network errors gracefully", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      await expect(
        telegramService.sendWelcomeMessage("123456789", 1, "http://test.com")
      ).rejects.toThrow("Failed to send Telegram welcome message");
    });
  });
});
