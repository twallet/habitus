// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TokenManager, tokenManager } from "../TokenManager.js";

describe("TokenManager", () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    // Clear localStorage after each test
    localStorage.clear();
    tokenManager.stopPolling();
  });

  describe("getToken", () => {
    it("should return null when no token exists", () => {
      const manager = new TokenManager();
      expect(manager.getToken()).toBeNull();
    });

    it("should return token when it exists", () => {
      localStorage.setItem("habitus_token", "test-token");
      const manager = new TokenManager();
      expect(manager.getToken()).toBe("test-token");
    });
  });

  describe("setToken", () => {
    it("should set token in localStorage", () => {
      const manager = new TokenManager();
      manager.setToken("new-token");
      expect(localStorage.getItem("habitus_token")).toBe("new-token");
    });

    it("should remove token when set to null", () => {
      localStorage.setItem("habitus_token", "existing-token");
      const manager = new TokenManager();
      manager.setToken(null);
      expect(localStorage.getItem("habitus_token")).toBeNull();
    });

    it("should notify listeners when token changes", () => {
      const manager = new TokenManager();
      const listener = vi.fn();
      manager.onTokenChange(listener);

      manager.setToken("new-token");
      expect(listener).toHaveBeenCalledWith("new-token");
    });
  });

  describe("hasToken", () => {
    it("should return false when no token exists", () => {
      const manager = new TokenManager();
      expect(manager.hasToken()).toBe(false);
    });

    it("should return true when token exists", () => {
      localStorage.setItem("habitus_token", "test-token");
      const manager = new TokenManager();
      expect(manager.hasToken()).toBe(true);
    });
  });

  describe("onTokenChange", () => {
    it("should call listener when token changes", () => {
      const manager = new TokenManager();
      const listener = vi.fn();
      const unsubscribe = manager.onTokenChange(listener);

      manager.setToken("token-1");
      expect(listener).toHaveBeenCalledWith("token-1");

      manager.setToken("token-2");
      expect(listener).toHaveBeenCalledWith("token-2");

      unsubscribe();
      manager.setToken("token-3");
      // Should not be called again after unsubscribe
      expect(listener).toHaveBeenCalledTimes(2);
    });
  });

  describe("startPolling", () => {
    it("should poll for token changes", async () => {
      const manager = new TokenManager();
      const onTokenChange = vi.fn();
      const stopPolling = manager.startPolling(onTokenChange);

      // Change token in localStorage
      localStorage.setItem("habitus_token", "polled-token");

      // Wait for polling interval
      await new Promise((resolve) => setTimeout(resolve, 600));

      stopPolling();
      expect(onTokenChange).toHaveBeenCalled();
    });

    it("should stop polling when stop function is called", async () => {
      const manager = new TokenManager();
      const onTokenChange = vi.fn();
      const stopPolling = manager.startPolling(onTokenChange);

      stopPolling();

      // Change token after stopping
      localStorage.setItem("habitus_token", "token-after-stop");

      // Wait for polling interval
      await new Promise((resolve) => setTimeout(resolve, 600));

      // Should not have been called after stop
      expect(onTokenChange).not.toHaveBeenCalled();
    });
  });
});
