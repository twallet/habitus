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

    it("should fallback to empty string when no bot token provided and env is missing", () => {
      const originalEnv = process.env;
      process.env = { ...originalEnv };
      delete process.env.TELEGRAM_BOT_TOKEN;

      telegramService = new TelegramService({});
      expect(telegramService).toBeInstanceOf(TelegramService);

      process.env = originalEnv;
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
      expect(body.text).toContain("Welcome to 🌱 Habitus!");
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
      expect(body.text).toContain("Go to 🌱 Habitus Dashboard");
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
      expect(messageText).toContain("*Welcome to 🌱 Habitus!*");
      expect(messageText).toContain(
        "Your Telegram account has been successfully connected, so you will now receive reminders via Telegram"
      );
      expect(messageText).toContain("[Go to 🌱 Habitus Dashboard](http://test.com)");
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

    it("should include tracking details in message", async () => {
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
      expect(body.text).toContain("📋 Tracking details:");
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
        "Tracking detail",
        "Reminder note"
      );

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.text).toContain("🏃");
      expect(body.text).toContain("📋 Tracking details:");
      expect(body.text).toContain("Tracking detail");
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

      expect(keyboard).toHaveLength(1);
      expect(keyboard[0]).toHaveLength(4);

      // Check buttons
      expect(keyboard[0][0].text).toBe("\u2714\ufe0f");
      expect(keyboard[0][0].callback_data).toBe("complete_42");
      expect(keyboard[0][1].text).toBe("\u274c");
      expect(keyboard[0][1].callback_data).toBe("dismiss_42");
      expect(keyboard[0][2].text).toBe("\ud83d\udca4");
      expect(keyboard[0][2].callback_data).toBe("postpone_42");
      expect(keyboard[0][3].text).toBe("\ud83d\udcc4");
      expect(keyboard[0][3].callback_data).toBe("addnote_42");
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
      ).rejects.toThrow("Telegram API error: Unauthorized");
    });

    it("should use default error message when description is missing", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          ok: false,
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
      ).rejects.toThrow("Telegram API error: Unknown error");
    });

    it("should fallback to message ID 0 when result is missing messageId", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          ok: true,
          result: {},
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const messageId = await telegramService.sendReminderMessage(
        "123456789",
        1,
        "Did I exercise?",
        "2024-01-01T10:00:00Z"
      );

      expect(messageId).toBe(0);
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

  describe("sendPostponeOptionsMessage", () => {
    beforeEach(() => {
      telegramService = new TelegramService({
        botToken: "test-bot-token",
        frontendUrl: "http://test.com",
      });
    });

    it("should send postpone options successfully", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          ok: true,
          result: { ok: true },
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await telegramService.sendPostponeOptionsMessage("123456789", 1, 456);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[0]).toBe(
        "https://api.telegram.org/bottest-bot-token/editMessageReplyMarkup"
      );
      const body = JSON.parse(callArgs[1].body);
      expect(body.chat_id).toBe("123456789");
      expect(body.message_id).toBe(456);
      expect(body.reply_markup.inline_keyboard).toHaveLength(3);
    });

    it("should throw error when bot token is not configured", async () => {
      telegramService = new TelegramService({
        botToken: "",
      });

      await expect(
        telegramService.sendPostponeOptionsMessage("123456789", 1, 456)
      ).rejects.toThrow("Telegram bot token not configured");
    });

    it("should handle API errors", async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: vi.fn().mockResolvedValue({
          ok: false,
          description: "Message not found",
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await expect(
        telegramService.sendPostponeOptionsMessage("123456789", 1, 456)
      ).rejects.toThrow("Telegram API error: Message not found");
    });
  });

  describe("sendNotePromptMessage", () => {
    beforeEach(() => {
      telegramService = new TelegramService({
        botToken: "test-bot-token",
      });
    });

    it("should send note prompt successfully", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          ok: true,
          result: { message_id: 789 },
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await telegramService.sendNotePromptMessage("123456789");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.text).toContain("send your note");
    });

    it("should handle error when token missing", async () => {
      telegramService = new TelegramService({ botToken: "" });
      await expect(
        telegramService.sendNotePromptMessage("123456789")
      ).rejects.toThrow("Telegram bot token not configured");
    });
  });

  describe("sendConfirmationMessage", () => {
    beforeEach(() => {
      telegramService = new TelegramService({
        botToken: "test-bot-token",
      });
    });

    it("should send complete confirmation", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ ok: true }),
      });

      await telegramService.sendConfirmationMessage("123456789", "complete");

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.text).toContain("marked as completed");
    });

    it("should send dismiss confirmation", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ ok: true }),
      });

      await telegramService.sendConfirmationMessage("123456789", "dismiss");

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.text).toContain("dismissed");
    });

    it("should send postpone confirmation with details", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ ok: true }),
      });

      await telegramService.sendConfirmationMessage(
        "123456789",
        "postpone",
        "1 hour"
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.text).toContain("postponed for 1 hour");
    });

    it("should send addnote confirmation", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ ok: true }),
      });

      await telegramService.sendConfirmationMessage("123456789", "addnote");

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.text).toContain("Note added successfully");
    });
  });

  describe("editMessageReplyMarkup", () => {
    beforeEach(() => {
      telegramService = new TelegramService({
        botToken: "test-bot-token",
      });
    });

    it("should remove keyboard successfully", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ ok: true }),
      });

      await telegramService.editMessageReplyMarkup("123456789", 456);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.reply_markup.inline_keyboard).toEqual([]);
    });

    it("should handle errors", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: vi.fn().mockResolvedValue({
          ok: false,
          description: "Message not found",
        }),
      });

      await expect(
        telegramService.editMessageReplyMarkup("123456789", 456)
      ).rejects.toThrow("Telegram API error: Message not found");
    });
  });
});


