import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  PERPLEXITY_DEFAULT_MODEL,
  PERPLEXITY_API_URL,
  AI_DEFAULT_EMOJI,
  ServerConfig,
} from "../constants.js";

describe("Constants", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables to original state
    process.env = { ...originalEnv };
    // Reset ServerConfig cache
    (ServerConfig as any).cachedPort = null;
    (ServerConfig as any).cachedServerUrl = null;
  });

  afterEach(() => {
    process.env = originalEnv;
    // Reset ServerConfig cache
    (ServerConfig as any).cachedPort = null;
    (ServerConfig as any).cachedServerUrl = null;
  });

  describe("AI Service Constants", () => {
    it("should export PERPLEXITY_DEFAULT_MODEL with correct value", () => {
      expect(PERPLEXITY_DEFAULT_MODEL).toBe("sonar");
    });

    it("should export PERPLEXITY_API_URL with correct value", () => {
      expect(PERPLEXITY_API_URL).toBe(
        "https://api.perplexity.ai/chat/completions"
      );
    });

    it("should export AI_DEFAULT_EMOJI with correct value", () => {
      expect(AI_DEFAULT_EMOJI).toBe("📝");
    });

    it("should have PERPLEXITY_DEFAULT_MODEL as a string", () => {
      expect(typeof PERPLEXITY_DEFAULT_MODEL).toBe("string");
      expect(PERPLEXITY_DEFAULT_MODEL.length).toBeGreaterThan(0);
    });

    it("should have PERPLEXITY_API_URL as a valid URL string", () => {
      expect(typeof PERPLEXITY_API_URL).toBe("string");
      expect(PERPLEXITY_API_URL).toMatch(/^https?:\/\//);
    });

    it("should have AI_DEFAULT_EMOJI as a non-empty string", () => {
      expect(typeof AI_DEFAULT_EMOJI).toBe("string");
      expect(AI_DEFAULT_EMOJI.length).toBeGreaterThan(0);
    });
  });

  describe("getPort", () => {
    it("should return port number from VITE_PORT environment variable", () => {
      process.env.VITE_PORT = "3005";
      const port = ServerConfig.getPort();
      expect(port).toBe(3005);
    });

    it("should throw error when VITE_PORT is not set", () => {
      delete process.env.VITE_PORT;
      expect(() => ServerConfig.getPort()).toThrow(
        "VITE_PORT environment variable is required"
      );
    });

    it("should throw error when VITE_PORT is invalid (not a number)", () => {
      process.env.VITE_PORT = "not-a-number";
      expect(() => ServerConfig.getPort()).toThrow(/Invalid VITE_PORT value/);
    });

    it("should throw error when VITE_PORT is zero", () => {
      process.env.VITE_PORT = "0";
      expect(() => ServerConfig.getPort()).toThrow(/Invalid VITE_PORT value/);
    });

    it("should throw error when VITE_PORT is negative", () => {
      process.env.VITE_PORT = "-1";
      expect(() => ServerConfig.getPort()).toThrow(/Invalid VITE_PORT value/);
    });
  });

  describe("getServerUrl", () => {
    it("should return server URL from VITE_SERVER_URL environment variable", () => {
      process.env.VITE_SERVER_URL = "http://localhost:3005";
      const url = ServerConfig.getServerUrl();
      expect(url).toBe("http://localhost:3005");
    });

    it("should throw error when VITE_SERVER_URL is not set", () => {
      delete process.env.VITE_SERVER_URL;
      expect(() => ServerConfig.getServerUrl()).toThrow(
        "VITE_SERVER_URL environment variable is required"
      );
    });

    it("should return any valid string as server URL", () => {
      process.env.VITE_SERVER_URL = "https://example.com";
      const url = ServerConfig.getServerUrl();
      expect(url).toBe("https://example.com");
    });
  });
});
