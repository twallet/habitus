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
        "https://api.telegram.org/bottest-bot-token/sendMessage"
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

    it("should handle HTTP errors when response.json() fails", async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: vi.fn().mockRejectedValue(new Error("Failed to parse JSON")),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await expect(
        telegramService.sendWelcomeMessage("123456789", 1, "http://test.com")
      ).rejects.toThrow("Telegram API error: HTTP 500: Internal Server Error");
    });

    it("should handle HTTP errors without description", async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: vi.fn().mockResolvedValue({}),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await expect(
        telegramService.sendWelcomeMessage("123456789", 1, "http://test.com")
      ).rejects.toThrow("Telegram API error: HTTP 500: Internal Server Error");
    });
  });

  describe("sendReminderMessage", () => {
    beforeEach(() => {
      telegramService = new TelegramService({
        botToken: "test-bot-token",
        frontendUrl: "http://test.com",
      });
    });

    it("should send reminder message successfully", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          ok: true,
          result: {
            message_id: 456,
          },
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await telegramService.sendReminderMessage(
        "123456789",
        1,
        "Did I exercise?",
        "2024-01-01T10:00:00Z"
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[0]).toBe(
        "https://api.telegram.org/bottest-bot-token/sendMessage"
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
      expect(body.text).toContain("🌱 *Reminder*");
      expect(body.text).toContain("*Did I exercise?*");
      expect(body.reply_markup).toBeDefined();
      expect(body.reply_markup.inline_keyboard).toBeDefined();
    });

    it("should include tracking icon in message", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          ok: true,
          result: {
            message_id: 456,
          },
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await telegramService.sendReminderMessage(
        "123456789",
        1,
        "Did I exercise?",
        "2024-01-01T10:00:00Z",
        "🏃"
      );

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.text).toContain("🏃");
    });

    it("should include tracking notes in message", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          ok: true,
          result: {
            message_id: 456,
          },
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await telegramService.sendReminderMessage(
        "123456789",
        1,
        "Did I exercise?",
        "2024-01-01T10:00:00Z",
        undefined,
        "Remember to stretch"
      );

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.text).toContain("📋 Tracking notes:");
      expect(body.text).toContain("Remember to stretch");
    });

    it("should include reminder notes in message", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          ok: true,
          result: {
            message_id: 456,
          },
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await telegramService.sendReminderMessage(
        "123456789",
        1,
        "Did I exercise?",
        "2024-01-01T10:00:00Z",
        undefined,
        undefined,
        "Personal reminder note"
      );

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.text).toContain("📝 Reminder notes:");
      expect(body.text).toContain("Personal reminder note");
    });

    it("should include all optional fields in message", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          ok: true,
          result: {
            message_id: 456,
          },
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await telegramService.sendReminderMessage(
        "123456789",
        1,
        "Did I exercise?",
        "2024-01-01T10:00:00Z",
        "🏃",
        "Tracking note",
        "Reminder note"
      );

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.text).toContain("🏃");
      expect(body.text).toContain("📋 Tracking notes:");
      expect(body.text).toContain("Tracking note");
      expect(body.text).toContain("📝 Reminder notes:");
      expect(body.text).toContain("Reminder note");
    });

    it("should include inline keyboard with action buttons", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          ok: true,
          result: {
            message_id: 456,
          },
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await telegramService.sendReminderMessage(
        "123456789",
        42,
        "Did I exercise?",
        "2024-01-01T10:00:00Z"
      );

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      const keyboard = body.reply_markup.inline_keyboard;

      expect(keyboard).toHaveLength(2);
      expect(keyboard[0]).toHaveLength(2);
      expect(keyboard[1]).toHaveLength(2);

      // Check first row buttons
      expect(keyboard[0][0].text).toBe("📝 Add Notes");
      expect(keyboard[0][0].url).toContain("reminderId=42");
      expect(keyboard[0][0].url).toContain("action=editNotes");
      expect(keyboard[0][1].text).toBe("✓ Complete");
      expect(keyboard[0][1].url).toContain("reminderId=42");
      expect(keyboard[0][1].url).toContain("action=complete");

      // Check second row buttons
      expect(keyboard[1][0].text).toBe("✕ Dismiss");
      expect(keyboard[1][0].url).toContain("reminderId=42");
      expect(keyboard[1][0].url).toContain("action=dismiss");
      expect(keyboard[1][1].text).toBe("💤 Snooze");
      expect(keyboard[1][1].url).toContain("reminderId=42");
      expect(keyboard[1][1].url).toContain("action=snooze");
    });

    it("should escape markdown special characters", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          ok: true,
          result: {
            message_id: 456,
          },
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await telegramService.sendReminderMessage(
        "123456789",
        1,
        "Did I *exercise*?",
        "2024-01-01T10:00:00Z",
        undefined,
        "Note with _underscore_ and [brackets]",
        "Reminder with (parentheses)"
      );

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      // Markdown should be escaped
      expect(body.text).toContain("*Did I \\*exercise\\*?*");
      expect(body.text).toContain(
        "Note with \\_underscore\\_ and \\[brackets\\]"
      );
      expect(body.text).toContain("Reminder with \\(parentheses\\)");
    });

    it("should use custom locale and timezone", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          ok: true,
          result: {
            message_id: 456,
          },
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await telegramService.sendReminderMessage(
        "123456789",
        1,
        "Did I exercise?",
        "2024-01-01T10:00:00Z",
        undefined,
        undefined,
        undefined,
        "en-US",
        "America/New_York"
      );

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      // The formatted time should be present
      expect(body.text).toContain("📅 Scheduled for:");
    });

    it("should throw error when bot token is not configured", async () => {
      telegramService = new TelegramService({
        botToken: "",
        frontendUrl: "http://test.com",
      });

      await expect(
        telegramService.sendReminderMessage(
          "123456789",
          1,
          "Did I exercise?",
          "2024-01-01T10:00:00Z"
        )
      ).rejects.toThrow("Telegram bot token not configured");
    });

    it("should throw error when chat ID is missing", async () => {
      await expect(
        telegramService.sendReminderMessage(
          "",
          1,
          "Did I exercise?",
          "2024-01-01T10:00:00Z"
        )
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
        telegramService.sendReminderMessage(
          "123456789",
          1,
          "Did I exercise?",
          "2024-01-01T10:00:00Z"
        )
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
        telegramService.sendReminderMessage(
          "123456789",
          1,
          "Did I exercise?",
          "2024-01-01T10:00:00Z"
        )
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
        telegramService.sendReminderMessage(
          "123456789",
          1,
          "Did I exercise?",
          "2024-01-01T10:00:00Z"
        )
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
        telegramService.sendReminderMessage(
          "123456789",
          1,
          "Did I exercise?",
          "2024-01-01T10:00:00Z"
        )
      ).rejects.toThrow("Telegram bot token is invalid");
    });

    it("should handle network errors gracefully", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      await expect(
        telegramService.sendReminderMessage(
          "123456789",
          1,
          "Did I exercise?",
          "2024-01-01T10:00:00Z"
        )
      ).rejects.toThrow("Failed to send Telegram message");
    });

    it("should handle HTTP errors when response.json() fails", async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: vi.fn().mockRejectedValue(new Error("Failed to parse JSON")),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await expect(
        telegramService.sendReminderMessage(
          "123456789",
          1,
          "Did I exercise?",
          "2024-01-01T10:00:00Z"
        )
      ).rejects.toThrow("Telegram API error: HTTP 500: Internal Server Error");
    });

    it("should handle HTTP errors without description", async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: vi.fn().mockResolvedValue({}),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await expect(
        telegramService.sendReminderMessage(
          "123456789",
          1,
          "Did I exercise?",
          "2024-01-01T10:00:00Z"
        )
      ).rejects.toThrow("Telegram API error: HTTP 500: Internal Server Error");
    });

    it("should use default icon when trackingIcon is not provided", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          ok: true,
          result: {
            message_id: 456,
          },
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await telegramService.sendReminderMessage(
        "123456789",
        1,
        "Did I exercise?",
        "2024-01-01T10:00:00Z"
      );

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.text).toContain("📝");
    });
  });

  describe("getChatInfo", () => {
    beforeEach(() => {
      telegramService = new TelegramService({
        botToken: "test-bot-token",
        frontendUrl: "http://test.com",
      });
    });

    it("should get chat info successfully", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          ok: true,
          result: {
            id: 123456789,
            username: "testuser",
            first_name: "Test",
            type: "private",
          },
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const chatInfo = await telegramService.getChatInfo("123456789");

      expect(chatInfo).toEqual({
        username: "testuser",
        first_name: "Test",
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[0]).toBe(
        "https://api.telegram.org/bottest-bot-token/getChat"
      );
      expect(callArgs[1]).toMatchObject({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const body = JSON.parse(callArgs[1].body);
      expect(body.chat_id).toBe("123456789");
    });

    it("should handle missing username and first_name", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          ok: true,
          result: {
            id: 123456789,
            type: "private",
          },
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const chatInfo = await telegramService.getChatInfo("123456789");

      expect(chatInfo).toEqual({
        username: undefined,
        first_name: undefined,
      });
    });

    it("should throw error when bot token is not configured", async () => {
      telegramService = new TelegramService({
        botToken: "",
        frontendUrl: "http://test.com",
      });

      await expect(telegramService.getChatInfo("123456789")).rejects.toThrow(
        "Telegram bot token not configured"
      );
    });

    it("should throw error when chat ID is missing", async () => {
      await expect(telegramService.getChatInfo("")).rejects.toThrow(
        "Telegram chat ID is required"
      );
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

      await expect(telegramService.getChatInfo("123456789")).rejects.toThrow(
        "Telegram API error"
      );
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

      await expect(telegramService.getChatInfo("123456789")).rejects.toThrow(
        "Telegram API error"
      );
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

      await expect(telegramService.getChatInfo("123456789")).rejects.toThrow(
        "Telegram chat not found"
      );
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

      await expect(telegramService.getChatInfo("123456789")).rejects.toThrow(
        "Telegram bot token is invalid"
      );
    });

    it("should handle network errors gracefully", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      await expect(telegramService.getChatInfo("123456789")).rejects.toThrow(
        "Failed to get Telegram chat info"
      );
    });

    it("should handle HTTP errors when response.json() fails", async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: vi.fn().mockRejectedValue(new Error("Failed to parse JSON")),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await expect(telegramService.getChatInfo("123456789")).rejects.toThrow(
        "Telegram API error: HTTP 500: Internal Server Error"
      );
    });

    it("should handle HTTP errors without description", async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: vi.fn().mockResolvedValue({}),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await expect(telegramService.getChatInfo("123456789")).rejects.toThrow(
        "Telegram API error: HTTP 500: Internal Server Error"
      );
    });
  });
});
