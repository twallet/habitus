import { vi, type Mock } from "vitest";
import { AiService } from "../aiService.js";
import {
  PERPLEXITY_DEFAULT_MODEL,
  PERPLEXITY_API_URL,
  AI_DEFAULT_EMOJI,
} from "../../setup/constants.js";

// Mock global fetch
global.fetch = vi.fn() as Mock;

describe("AiService", () => {
  let aiService: AiService;
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variables
    process.env = { ...originalEnv };
    // Clear fetch mock
    (global.fetch as Mock).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = originalEnv;
  });

  describe("constructor", () => {
    it("should use default model from constants when PERPLEXITY_MODEL is not set", () => {
      delete process.env.PERPLEXITY_MODEL;
      delete process.env.PERPLEXITY_API_KEY;

      aiService = new AiService();

      // Verify the service instance is created (we can't directly access private fields)
      expect(aiService).toBeInstanceOf(AiService);
    });

    it("should use PERPLEXITY_MODEL environment variable when set", () => {
      process.env.PERPLEXITY_MODEL = "custom-model";
      delete process.env.PERPLEXITY_API_KEY;

      aiService = new AiService();

      expect(aiService).toBeInstanceOf(AiService);
    });

    it("should read PERPLEXITY_API_KEY from environment", () => {
      process.env.PERPLEXITY_API_KEY = "test-api-key";
      delete process.env.PERPLEXITY_MODEL;

      aiService = new AiService();

      expect(aiService).toBeInstanceOf(AiService);
    });
  });

  describe("suggestEmoji", () => {
    beforeEach(() => {
      process.env.PERPLEXITY_API_KEY = "test-api-key";
      delete process.env.PERPLEXITY_MODEL;
      aiService = new AiService();
    });

    it("should throw error when API key is not configured", async () => {
      delete process.env.PERPLEXITY_API_KEY;
      const serviceWithoutKey = new AiService();

      await expect(
        serviceWithoutKey.suggestEmoji("How many hours did I sleep?")
      ).rejects.toThrow("Perplexity API key is not configured");
    });

    it("should throw error when question is empty", async () => {
      await expect(aiService.suggestEmoji("")).rejects.toThrow(
        "Question is required"
      );
    });

    it("should throw error when question is only whitespace", async () => {
      await expect(aiService.suggestEmoji("   ")).rejects.toThrow(
        "Question is required"
      );
    });

    it("should use constants API URL and default model in fetch request", async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "😴",
              },
            },
          ],
        }),
      });

      await aiService.suggestEmoji("How many hours did I sleep?");

      expect(global.fetch).toHaveBeenCalledWith(
        PERPLEXITY_API_URL,
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: "Bearer test-api-key",
          }),
          body: expect.stringContaining(PERPLEXITY_DEFAULT_MODEL),
        })
      );
    });

    it("should use custom model from environment variable when set", async () => {
      process.env.PERPLEXITY_MODEL = "custom-model";
      const customService = new AiService();

      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "😴",
              },
            },
          ],
        }),
      });

      await customService.suggestEmoji("How many hours did I sleep?");

      const callBody = JSON.parse((global.fetch as Mock).mock.calls[0][1].body);
      expect(callBody.model).toBe("custom-model");
    });

    it("should return emoji from API response", async () => {
      const expectedEmoji = "😴";
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: expectedEmoji,
              },
            },
          ],
        }),
      });

      const result = await aiService.suggestEmoji(
        "How many hours did I sleep?"
      );

      expect(result).toBe(expectedEmoji);
    });

    it("should extract emoji from response containing text and emoji", async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "Here is an emoji: 😴",
              },
            },
          ],
        }),
      });

      const result = await aiService.suggestEmoji(
        "How many hours did I sleep?"
      );

      expect(result).toBe("😴");
    });

    it("should return first character when API returns no emoji", async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "no emoji here",
              },
            },
          ],
        }),
      });

      const result = await aiService.suggestEmoji(
        "How many hours did I sleep?"
      );

      // The code returns the first character as fallback before default emoji
      expect(result).toBe("n");
    });

    it("should return default emoji from constants when API returns empty content", async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "",
              },
            },
          ],
        }),
      });

      const result = await aiService.suggestEmoji(
        "How many hours did I sleep?"
      );

      expect(result).toBe(AI_DEFAULT_EMOJI);
    });

    it("should return default emoji from constants when choices array is empty", async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [],
        }),
      });

      const result = await aiService.suggestEmoji(
        "How many hours did I sleep?"
      );

      expect(result).toBe(AI_DEFAULT_EMOJI);
    });

    it("should handle API error response with JSON", async () => {
      const errorJson = { error: "Invalid API key" };
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: async () => errorJson,
      });

      await expect(
        aiService.suggestEmoji("How many hours did I sleep?")
      ).rejects.toThrow(/Perplexity API error: 401 Unauthorized/);
    });

    it("should handle API error response with text", async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: async () => "Server error occurred",
      });

      await expect(
        aiService.suggestEmoji("How many hours did I sleep?")
      ).rejects.toThrow(/Perplexity API error: 500 Internal Server Error/);
    });

    it("should handle network errors", async () => {
      (global.fetch as Mock).mockRejectedValueOnce(
        new Error("Network request failed")
      );

      await expect(
        aiService.suggestEmoji("How many hours did I sleep?")
      ).rejects.toThrow();
    });

    it("should trim question before sending to API", async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "😴",
              },
            },
          ],
        }),
      });

      await aiService.suggestEmoji("  How many hours did I sleep?  ");

      const callBody = JSON.parse((global.fetch as Mock).mock.calls[0][1].body);
      expect(callBody.messages[1].content).toContain(
        "How many hours did I sleep?"
      );
      expect(callBody.messages[1].content).not.toContain("  ");
    });

    it("should send correct prompt format in request", async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "😴",
              },
            },
          ],
        }),
      });

      const question = "How many hours did I sleep?";
      await aiService.suggestEmoji(question);

      const callBody = JSON.parse((global.fetch as Mock).mock.calls[0][1].body);
      expect(callBody.messages).toHaveLength(2);
      expect(callBody.messages[0].role).toBe("system");
      expect(callBody.messages[0].content).toContain("emoji");
      expect(callBody.messages[1].role).toBe("user");
      expect(callBody.messages[1].content).toContain(question);
      expect(callBody.max_tokens).toBe(20);
      expect(callBody.temperature).toBe(0.7);
    });

    it("should return first character when emoji regex doesn't match", async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "invalid response",
              },
            },
          ],
        }),
      });

      const result = await aiService.suggestEmoji(
        "How many hours did I sleep?"
      );

      // The code returns the first character as fallback before default emoji
      expect(result).toBe("i");
    });
  });
});
