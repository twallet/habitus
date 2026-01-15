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
    it("should return port number from PORT environment variable (Railway/production)", () => {
      process.env.PORT = "8080";
      delete process.env.VITE_PORT;
      const port = ServerConfig.getPort();
      expect(port).toBe(8080);
    });

    it("should return port number from VITE_PORT environment variable (development)", () => {
      delete process.env.PORT;
      process.env.VITE_PORT = "3005";
      const port = ServerConfig.getPort();
      expect(port).toBe(3005);
    });

    it("should prioritize PORT over VITE_PORT when both are set", () => {
      process.env.PORT = "8080";
      process.env.VITE_PORT = "3005";
      const port = ServerConfig.getPort();
      expect(port).toBe(8080);
    });

    it("should throw error when PORT and VITE_PORT are not set", () => {
      delete process.env.PORT;
      delete process.env.VITE_PORT;
      expect(() => ServerConfig.getPort()).toThrow(
        /PORT or VITE_PORT environment variable is required/
      );
    });

    it("should throw error when VITE_PORT is invalid (not a number)", () => {
      delete process.env.PORT;
      process.env.VITE_PORT = "not-a-number";
      expect(() => ServerConfig.getPort()).toThrow(/Invalid port value/);
    });

    it("should throw error when VITE_PORT is zero", () => {
      delete process.env.PORT;
      process.env.VITE_PORT = "0";
      expect(() => ServerConfig.getPort()).toThrow(/Invalid port value/);
    });

    it("should throw error when VITE_PORT is negative", () => {
      delete process.env.PORT;
      process.env.VITE_PORT = "-1";
      expect(() => ServerConfig.getPort()).toThrow(/Invalid port value/);
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

  describe("getPublicUrl", () => {
    it("should return localhost URL with port in development", () => {
      process.env.NODE_ENV = "development";
      process.env.VITE_SERVER_URL = "http://localhost";
      process.env.VITE_PORT = "3005";
      const url = ServerConfig.getPublicUrl();
      expect(url).toBe("http://localhost:3005");
    });

    it("should return 127.0.0.1 URL with port in development", () => {
      process.env.NODE_ENV = "development";
      process.env.VITE_SERVER_URL = "http://127.0.0.1";
      process.env.VITE_PORT = "3000";
      const url = ServerConfig.getPublicUrl();
      expect(url).toBe("http://127.0.0.1:3000");
    });

    it("should return production URL without port", () => {
      process.env.NODE_ENV = "production";
      process.env.VITE_SERVER_URL = "https://habitus-production.up.railway.app";
      const url = ServerConfig.getPublicUrl();
      expect(url).toBe("https://habitus-production.up.railway.app");
    });

    it("should add https protocol if missing in production", () => {
      process.env.NODE_ENV = "production";
      process.env.VITE_SERVER_URL = "habitus-production.up.railway.app";
      const url = ServerConfig.getPublicUrl();
      expect(url).toBe("https://habitus-production.up.railway.app");
    });

    it("should return non-localhost URL without port even in development", () => {
      process.env.NODE_ENV = "development";
      process.env.VITE_SERVER_URL = "https://my-proxy.com";
      const url = ServerConfig.getPublicUrl();
      expect(url).toBe("https://my-proxy.com");
    });
  });
});
