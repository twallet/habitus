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

  describe("removeToken", () => {
    it("should remove token from localStorage", () => {
      localStorage.setItem("habitus_token", "existing-token");
      const manager = new TokenManager();
      manager.removeToken();
      expect(localStorage.getItem("habitus_token")).toBeNull();
    });

    it("should notify listeners when token is removed", () => {
      localStorage.setItem("habitus_token", "existing-token");
      const manager = new TokenManager();
      const listener = vi.fn();
      manager.onTokenChange(listener);

      manager.removeToken();
      expect(listener).toHaveBeenCalledWith(null);
    });
  });

  describe("stopPolling", () => {
    it("should stop polling when called", async () => {
      const manager = new TokenManager();
      const onTokenChange = vi.fn();
      manager.startPolling(onTokenChange);

      manager.stopPolling();

      // Change token after stopping
      localStorage.setItem("habitus_token", "token-after-stop");

      // Wait for polling interval
      await new Promise((resolve) => setTimeout(resolve, 600));

      // Should not have been called after stop
      expect(onTokenChange).not.toHaveBeenCalled();
    });

    it("should handle stopPolling when not polling", () => {
      const manager = new TokenManager();
      // Should not throw error
      expect(() => manager.stopPolling()).not.toThrow();
    });
  });

  describe("reset", () => {
    it("should stop polling and clear listeners", async () => {
      const manager = new TokenManager();
      const listener = vi.fn();
      manager.onTokenChange(listener);
      manager.startPolling(vi.fn());

      manager.reset();

      // Verify polling is stopped
      localStorage.setItem("habitus_token", "token-after-reset");
      await new Promise((resolve) => setTimeout(resolve, 600));

      // Verify listeners are cleared
      manager.setToken("new-token");
      expect(listener).not.toHaveBeenCalled();
    });

    it("should reset currentToken to localStorage value", () => {
      localStorage.setItem("habitus_token", "stored-token");
      const manager = new TokenManager();
      manager.setToken("different-token");
      // Change localStorage after setting token
      localStorage.setItem("habitus_token", "new-stored-token");
      manager.reset();
      // After reset, currentToken should reflect localStorage value
      expect(manager.getToken()).toBe("new-stored-token");
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

    it("should clear existing interval when starting new polling", async () => {
      const manager = new TokenManager();
      const firstCallback = vi.fn();
      const secondCallback = vi.fn();

      manager.startPolling(firstCallback);
      manager.startPolling(secondCallback);

      localStorage.setItem("habitus_token", "new-token");

      await new Promise((resolve) => setTimeout(resolve, 600));

      manager.stopPolling();

      // Only second callback should be called
      expect(firstCallback).not.toHaveBeenCalled();
      expect(secondCallback).toHaveBeenCalled();
    });
  });

  describe("setToken edge cases", () => {
    it("should not notify listeners when token is set to same value", () => {
      const manager = new TokenManager();
      manager.setToken("same-token");
      const listener = vi.fn();
      manager.onTokenChange(listener);

      manager.setToken("same-token");
      expect(listener).not.toHaveBeenCalled();
    });

    it("should handle multiple listeners", () => {
      const manager = new TokenManager();
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      manager.onTokenChange(listener1);
      manager.onTokenChange(listener2);
      manager.onTokenChange(listener3);

      manager.setToken("new-token");

      expect(listener1).toHaveBeenCalledWith("new-token");
      expect(listener2).toHaveBeenCalledWith("new-token");
      expect(listener3).toHaveBeenCalledWith("new-token");
    });

    it("should dispatch custom token change event", () => {
      const manager = new TokenManager();
      const eventListener = vi.fn();
      window.addEventListener("habitus_token_change", eventListener);

      manager.setToken("event-token");

      expect(eventListener).toHaveBeenCalled();
      const event = eventListener.mock.calls[0][0] as CustomEvent;
      expect(event.detail.token).toBe("event-token");

      window.removeEventListener("habitus_token_change", eventListener);
    });

    it("should handle listener errors gracefully", () => {
      const manager = new TokenManager();
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const errorListener = vi.fn(() => {
        throw new Error("Listener error");
      });
      const normalListener = vi.fn();

      manager.onTokenChange(errorListener);
      manager.onTokenChange(normalListener);

      manager.setToken("error-token");

      // Error should be logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error in token change listener:",
        expect.any(Error)
      );

      // Normal listener should still be called
      expect(normalListener).toHaveBeenCalledWith("error-token");

      consoleErrorSpy.mockRestore();
    });
  });

  describe("storage event listener", () => {
    it("should detect token changes from other tabs", () => {
      const manager = new TokenManager();
      const listener = vi.fn();
      manager.onTokenChange(listener);

      // Simulate storage event from another tab
      // jsdom requires a different approach for StorageEvent
      const storageEvent = new StorageEvent("storage", {
        key: "habitus_token",
        newValue: "cross-tab-token",
        oldValue: null,
      });

      // Update localStorage to match the event
      localStorage.setItem("habitus_token", "cross-tab-token");
      window.dispatchEvent(storageEvent);

      expect(listener).toHaveBeenCalledWith("cross-tab-token");
      expect(manager.getToken()).toBe("cross-tab-token");
    });

    it("should ignore storage events for other keys", () => {
      const manager = new TokenManager();
      const listener = vi.fn();
      manager.onTokenChange(listener);

      const storageEvent = new StorageEvent("storage", {
        key: "other_key",
        newValue: "other-value",
        oldValue: null,
      });

      window.dispatchEvent(storageEvent);

      expect(listener).not.toHaveBeenCalled();
    });

    it("should ignore storage events when token hasn't changed", () => {
      const manager = new TokenManager();
      manager.setToken("same-token");
      const listener = vi.fn();
      manager.onTokenChange(listener);

      const storageEvent = new StorageEvent("storage", {
        key: "habitus_token",
        newValue: "same-token",
        oldValue: null,
      });

      window.dispatchEvent(storageEvent);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("constructor", () => {
    it("should initialize with token from localStorage", () => {
      localStorage.setItem("habitus_token", "initial-token");
      const manager = new TokenManager();
      expect(manager.getToken()).toBe("initial-token");
    });

    it("should initialize with null when no token in localStorage", () => {
      const manager = new TokenManager();
      expect(manager.getToken()).toBeNull();
    });

    it("should setup storage listener on construction", () => {
      const manager = new TokenManager();
      const listener = vi.fn();
      manager.onTokenChange(listener);

      // Simulate storage event
      const storageEvent = new StorageEvent("storage", {
        key: "habitus_token",
        newValue: "storage-token",
        oldValue: null,
      });

      // Update localStorage to match the event
      localStorage.setItem("habitus_token", "storage-token");
      window.dispatchEvent(storageEvent);

      expect(listener).toHaveBeenCalled();
    });
  });
});
