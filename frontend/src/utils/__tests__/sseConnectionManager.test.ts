// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  SseConnectionManager,
  DEFAULT_RETRY_CONFIG,
  type SseRetryConfig,
  type SseEventHandlers,
} from "../sseConnectionManager";

/**
 * Mock EventSource implementation for testing.
 */
class MockEventSource {
  url: string;
  withCredentials: boolean;
  readyState: number = 0; // CONNECTING
  listeners: Map<string, Array<(e: MessageEvent) => void>> = new Map();
  onopen: ((ev: Event) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;

  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;

  constructor(url: string, options?: { withCredentials?: boolean }) {
    this.url = url;
    this.withCredentials = options?.withCredentials ?? false;
  }

  addEventListener(
    type: string,
    listener: (e: MessageEvent) => void
  ): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);
  }

  removeEventListener(
    type: string,
    listener: (e: MessageEvent) => void
  ): void {
    const listeners = this.listeners.get(type);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  close(): void {
    this.readyState = MockEventSource.CLOSED;
  }

  /**
   * Simulate connection opening.
   */
  simulateOpen(): void {
    this.readyState = MockEventSource.OPEN;
    if (this.onopen) {
      this.onopen(new Event("open"));
    }
  }

  /**
   * Simulate connection error.
   */
  simulateError(): void {
    if (this.onerror) {
      this.onerror(new Event("error"));
    }
  }

  /**
   * Simulate receiving an event.
   */
  simulateEvent(type: string, data?: any): void {
    const listeners = this.listeners.get(type);
    if (listeners) {
      const event = new MessageEvent(type, {
        data: data ? JSON.stringify(data) : undefined,
      });
      listeners.forEach((listener) => listener(event));
    }
  }
}

describe("sseConnectionManager", () => {
  let mockEventSource: MockEventSource | null = null;
  let originalEventSource: typeof EventSource;
  let eventSourceCalls: Array<{ url: string; options?: any }> = [];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    eventSourceCalls = [];

    // Mock EventSource
    originalEventSource = global.EventSource;
    // Create a proper constructor function
    const EventSourceConstructor = function (
      this: any,
      url: string,
      options?: any
    ) {
      eventSourceCalls.push({ url, options });
      mockEventSource = new MockEventSource(url, options);
      return mockEventSource;
    } as any;
    EventSourceConstructor.CONNECTING = 0;
    EventSourceConstructor.OPEN = 1;
    EventSourceConstructor.CLOSED = 2;
    global.EventSource = EventSourceConstructor as typeof EventSource;
  });

  afterEach(() => {
    vi.useRealTimers();
    global.EventSource = originalEventSource;
    mockEventSource = null;
    eventSourceCalls = [];
  });

  describe("DEFAULT_RETRY_CONFIG", () => {
    it("should have correct default values", () => {
      expect(DEFAULT_RETRY_CONFIG.maxRetryAttempts).toBe(10);
      expect(DEFAULT_RETRY_CONFIG.initialRetryDelay).toBe(1000);
      expect(DEFAULT_RETRY_CONFIG.maxRetryDelay).toBe(30000);
      expect(DEFAULT_RETRY_CONFIG.heartbeatTimeout).toBe(90000);
      expect(DEFAULT_RETRY_CONFIG.heartbeatCheckInterval).toBe(30000);
    });
  });

  describe("SseConnectionManager constructor", () => {
    it("should initialize with default config", () => {
      const handlers: SseEventHandlers = {};
      const shouldConnect = () => true;
      const manager = new SseConnectionManager(
        "http://test.com/sse",
        handlers,
        shouldConnect
      );

      expect(manager.isCurrentlyConnected()).toBe(false);
    });

    it("should initialize with custom config", () => {
      const handlers: SseEventHandlers = {};
      const shouldConnect = () => true;
      const customConfig: Partial<SseRetryConfig> = {
        maxRetryAttempts: 5,
        initialRetryDelay: 500,
      };
      const manager = new SseConnectionManager(
        "http://test.com/sse",
        handlers,
        shouldConnect,
        customConfig
      );

      expect(manager.isCurrentlyConnected()).toBe(false);
    });
  });

  describe("connect", () => {
    it("should create EventSource with correct URL and credentials", () => {
      const handlers: SseEventHandlers = {};
      const shouldConnect = () => true;
      const manager = new SseConnectionManager(
        "http://test.com/sse",
        handlers,
        shouldConnect
      );

      manager.connect();

      expect(eventSourceCalls.length).toBe(1);
      expect(eventSourceCalls[0].url).toBe("http://test.com/sse");
      expect(eventSourceCalls[0].options).toEqual({ withCredentials: true });
    });

    it("should not connect if shouldConnect returns false", () => {
      const handlers: SseEventHandlers = {};
      const shouldConnect = vi.fn(() => false);
      const manager = new SseConnectionManager(
        "http://test.com/sse",
        handlers,
        shouldConnect
      );

      manager.connect();

      expect(eventSourceCalls.length).toBe(0);
    });

    it("should not connect if already connected", () => {
      const handlers: SseEventHandlers = {};
      const shouldConnect = () => true;
      const manager = new SseConnectionManager(
        "http://test.com/sse",
        handlers,
        shouldConnect
      );

      manager.connect();
      const firstCallCount = eventSourceCalls.length;

      manager.connect();
      const secondCallCount = eventSourceCalls.length;

      expect(secondCallCount).toBe(firstCallCount);
    });

    it("should not connect if max retry attempts reached", () => {
      const handlers: SseEventHandlers = {
        onMaxRetriesReached: vi.fn(),
      };
      const shouldConnect = () => true;
      const config: Partial<SseRetryConfig> = {
        maxRetryAttempts: 2,
      };
      const manager = new SseConnectionManager(
        "http://test.com/sse",
        handlers,
        shouldConnect,
        config
      );

      // Manually set retry count to max
      (manager as any).retryCount = 2;

      manager.connect();

      expect(eventSourceCalls.length).toBe(0);
      expect(handlers.onMaxRetriesReached).toHaveBeenCalled();
    });

    it("should clear pending retry timeout before connecting", () => {
      const handlers: SseEventHandlers = {};
      const shouldConnect = () => true;
      const config: Partial<SseRetryConfig> = {
        initialRetryDelay: 1000,
      };
      const manager = new SseConnectionManager(
        "http://test.com/sse",
        handlers,
        shouldConnect,
        config
      );

      // Set up a pending retry by causing an error first
      manager.connect();
      if (mockEventSource) {
        mockEventSource.simulateError();
      }
      // Wait a bit to set up retry
      vi.advanceTimersByTime(500);
      expect((manager as any).retryTimeout).not.toBeNull();

      // Now connect again - should clear the timeout
      manager.connect();

      expect((manager as any).retryTimeout).toBeNull();
    });

    it("should handle connected event", () => {
      const handlers: SseEventHandlers = {
        onConnected: vi.fn(),
      };
      const shouldConnect = () => true;
      const manager = new SseConnectionManager(
        "http://test.com/sse",
        handlers,
        shouldConnect
      );

      manager.connect();

      expect(mockEventSource).not.toBeNull();
      const testData = { status: "ok" };
      mockEventSource!.simulateEvent("connected", testData);

      expect(handlers.onConnected).toHaveBeenCalledWith(testData);
      expect((manager as any).isConnected).toBe(true);
      expect((manager as any).hasReceivedInitialConnection).toBe(true);
      expect((manager as any).retryCount).toBe(0);
      expect((manager as any).lastHeartbeat).not.toBeNull();
    });

    it("should handle connected event with empty data", () => {
      const handlers: SseEventHandlers = {
        onConnected: vi.fn(),
      };
      const shouldConnect = () => true;
      const manager = new SseConnectionManager(
        "http://test.com/sse",
        handlers,
        shouldConnect
      );

      manager.connect();

      mockEventSource!.simulateEvent("connected");

      expect(handlers.onConnected).toHaveBeenCalledWith({});
    });

    it("should handle connected event with invalid JSON", () => {
      const handlers: SseEventHandlers = {
        onConnected: vi.fn(),
      };
      const shouldConnect = () => true;
      const manager = new SseConnectionManager(
        "http://test.com/sse",
        handlers,
        shouldConnect
      );

      manager.connect();

      // Simulate invalid JSON by directly calling the listener with bad data
      const listeners = mockEventSource!.listeners.get("connected");
      if (listeners && listeners.length > 0) {
        const event = new MessageEvent("connected", {
          data: "{ invalid json",
        });
        listeners[0](event);
      }

      expect(handlers.onConnected).toHaveBeenCalledWith({});
    });

    it("should handle telegram-connected event", () => {
      const handlers: SseEventHandlers = {
        onTelegramConnected: vi.fn(),
      };
      const shouldConnect = () => true;
      const manager = new SseConnectionManager(
        "http://test.com/sse",
        handlers,
        shouldConnect
      );

      manager.connect();

      const telegramData = {
        chatId: "123",
        username: "testuser",
        timestamp: "2024-01-01T00:00:00Z",
      };
      mockEventSource!.simulateEvent("telegram-connected", telegramData);

      expect(handlers.onTelegramConnected).toHaveBeenCalledWith(telegramData);
    });

    it("should handle telegram-connected event with invalid JSON", () => {
      const handlers: SseEventHandlers = {
        onTelegramConnected: vi.fn(),
      };
      const shouldConnect = () => true;
      const manager = new SseConnectionManager(
        "http://test.com/sse",
        handlers,
        shouldConnect
      );

      manager.connect();

      // Simulate invalid JSON
      const listeners = mockEventSource!.listeners.get("telegram-connected");
      if (listeners && listeners.length > 0) {
        const event = new MessageEvent("telegram-connected", {
          data: "{ invalid json",
        });
        listeners[0](event);
      }

      // Should not call handler on parse error
      expect(handlers.onTelegramConnected).not.toHaveBeenCalled();
    });

    it("should handle heartbeat event", () => {
      const handlers: SseEventHandlers = {
        onHeartbeat: vi.fn(),
      };
      const shouldConnect = () => true;
      const manager = new SseConnectionManager(
        "http://test.com/sse",
        handlers,
        shouldConnect
      );

      manager.connect();
      mockEventSource!.simulateEvent("connected");

      (manager as any).retryCount = 5; // Set to non-zero
      (manager as any).hasReceivedInitialConnection = true;

      mockEventSource!.simulateEvent("heartbeat");

      expect(handlers.onHeartbeat).toHaveBeenCalled();
      expect((manager as any).lastHeartbeat).not.toBeNull();
      expect((manager as any).retryCount).toBe(0);
    });

    it("should not reset retry count on heartbeat if no initial connection", () => {
      const handlers: SseEventHandlers = {
        onHeartbeat: vi.fn(),
      };
      const shouldConnect = () => true;
      const manager = new SseConnectionManager(
        "http://test.com/sse",
        handlers,
        shouldConnect
      );

      manager.connect();

      (manager as any).retryCount = 5;
      (manager as any).hasReceivedInitialConnection = false;

      mockEventSource!.simulateEvent("heartbeat");

      expect((manager as any).retryCount).toBe(5);
    });

    it("should handle onopen event", () => {
      const handlers: SseEventHandlers = {};
      const shouldConnect = () => true;
      const manager = new SseConnectionManager(
        "http://test.com/sse",
        handlers,
        shouldConnect
      );

      manager.connect();

      mockEventSource!.simulateOpen();

      expect((manager as any).isConnected).toBe(true);
      expect((manager as any).retryCount).toBe(0);
    });

    it("should handle onerror event when connection is closed", () => {
      const handlers: SseEventHandlers = {
        onError: vi.fn(),
      };
      const shouldConnect = () => true;
      const config: Partial<SseRetryConfig> = {
        maxRetryAttempts: 3,
        initialRetryDelay: 100,
      };
      const manager = new SseConnectionManager(
        "http://test.com/sse",
        handlers,
        shouldConnect,
        config
      );

      manager.connect();

      mockEventSource!.readyState = MockEventSource.CLOSED;
      mockEventSource!.simulateError();

      expect((manager as any).eventSource).toBeNull();
      expect((manager as any).isConnected).toBe(false);
    });

    it("should handle onerror event when connection is connecting", () => {
      const handlers: SseEventHandlers = {};
      const shouldConnect = () => true;
      const config: Partial<SseRetryConfig> = {
        maxRetryAttempts: 3,
        initialRetryDelay: 100,
      };
      const manager = new SseConnectionManager(
        "http://test.com/sse",
        handlers,
        shouldConnect,
        config
      );

      manager.connect();

      mockEventSource!.readyState = MockEventSource.CONNECTING;
      mockEventSource!.simulateError();

      expect((manager as any).eventSource).toBeNull();
    });

    it("should handle synchronous error during connection creation", () => {
      const handlers: SseEventHandlers = {
        onError: vi.fn(),
      };
      const shouldConnect = () => true;
      const config: Partial<SseRetryConfig> = {
        maxRetryAttempts: 1,
        initialRetryDelay: 100,
      };
      const manager = new SseConnectionManager(
        "http://test.com/sse",
        handlers,
        shouldConnect,
        config
      );

      // Make EventSource throw an error by replacing it temporarily
      const originalES = global.EventSource;
      global.EventSource = function (this: any) {
        throw new Error("Connection failed");
      } as any;
      (global.EventSource as any).CONNECTING = 0;
      (global.EventSource as any).OPEN = 1;
      (global.EventSource as any).CLOSED = 2;

      manager.connect();

      expect((manager as any).eventSource).toBeNull();

      // Restore original EventSource
      global.EventSource = originalES;
    });

    it("should start heartbeat monitoring after connection", () => {
      const handlers: SseEventHandlers = {};
      const shouldConnect = () => true;
      const config: Partial<SseRetryConfig> = {
        heartbeatCheckInterval: 1000,
      };
      const manager = new SseConnectionManager(
        "http://test.com/sse",
        handlers,
        shouldConnect,
        config
      );

      manager.connect();
      mockEventSource!.simulateEvent("connected");

      expect((manager as any).heartbeatCheckInterval).not.toBeNull();

      // Advance time to trigger heartbeat check
      vi.advanceTimersByTime(1000);

      // Should still be connected (no timeout yet)
      expect((manager as any).eventSource).not.toBeNull();
    });
  });

  describe("disconnect", () => {
    it("should close EventSource and clean up", () => {
      const handlers: SseEventHandlers = {};
      const shouldConnect = () => true;
      const manager = new SseConnectionManager(
        "http://test.com/sse",
        handlers,
        shouldConnect
      );

      manager.connect();
      manager.disconnect();

      expect(mockEventSource?.readyState).toBe(MockEventSource.CLOSED);
      expect((manager as any).eventSource).toBeNull();
      expect((manager as any).retryCount).toBe(0);
      expect((manager as any).lastHeartbeat).toBeNull();
      expect((manager as any).isConnected).toBe(false);
      expect((manager as any).hasReceivedInitialConnection).toBe(false);
      expect((manager as any).heartbeatCheckInterval).toBeNull();
    });

    it("should clear retry timeout on disconnect", () => {
      const handlers: SseEventHandlers = {};
      const shouldConnect = () => true;
      const config: Partial<SseRetryConfig> = {
        initialRetryDelay: 1000,
      };
      const manager = new SseConnectionManager(
        "http://test.com/sse",
        handlers,
        shouldConnect,
        config
      );

      manager.connect();
      mockEventSource!.simulateError();

      // Set up retry
      vi.advanceTimersByTime(500);

      manager.disconnect();

      expect((manager as any).retryTimeout).toBeNull();
    });

    it("should stop heartbeat monitoring on disconnect", () => {
      const handlers: SseEventHandlers = {};
      const shouldConnect = () => true;
      const manager = new SseConnectionManager(
        "http://test.com/sse",
        handlers,
        shouldConnect
      );

      manager.connect();
      mockEventSource!.simulateEvent("connected");

      expect((manager as any).heartbeatCheckInterval).not.toBeNull();

      manager.disconnect();

      expect((manager as any).heartbeatCheckInterval).toBeNull();
    });
  });

  describe("isCurrentlyConnected", () => {
    it("should return false when not connected", () => {
      const handlers: SseEventHandlers = {};
      const shouldConnect = () => true;
      const manager = new SseConnectionManager(
        "http://test.com/sse",
        handlers,
        shouldConnect
      );

      expect(manager.isCurrentlyConnected()).toBe(false);
    });

    it("should return true when connected", () => {
      const handlers: SseEventHandlers = {};
      const shouldConnect = () => true;
      const manager = new SseConnectionManager(
        "http://test.com/sse",
        handlers,
        shouldConnect
      );

      manager.connect();
      mockEventSource!.simulateEvent("connected");

      expect(manager.isCurrentlyConnected()).toBe(true);
    });

    it("should return false when eventSource is null", () => {
      const handlers: SseEventHandlers = {};
      const shouldConnect = () => true;
      const manager = new SseConnectionManager(
        "http://test.com/sse",
        handlers,
        shouldConnect
      );

      manager.connect();
      mockEventSource!.simulateEvent("connected");
      (manager as any).eventSource = null;

      expect(manager.isCurrentlyConnected()).toBe(false);
    });
  });

  describe("resetRetryCount", () => {
    it("should reset retry count to zero", () => {
      const handlers: SseEventHandlers = {};
      const shouldConnect = () => true;
      const manager = new SseConnectionManager(
        "http://test.com/sse",
        handlers,
        shouldConnect
      );

      (manager as any).retryCount = 5;
      manager.resetRetryCount();

      expect((manager as any).retryCount).toBe(0);
    });
  });

  describe("retry logic", () => {
    it("should retry on error with exponential backoff", () => {
      const handlers: SseEventHandlers = {};
      const shouldConnect = () => true;
      const config: Partial<SseRetryConfig> = {
        maxRetryAttempts: 3,
        initialRetryDelay: 100,
        maxRetryDelay: 1000,
      };
      const manager = new SseConnectionManager(
        "http://test.com/sse",
        handlers,
        shouldConnect,
        config
      );

      manager.connect();
      mockEventSource!.simulateError();

      expect((manager as any).retryCount).toBe(1);

      // Advance time to trigger retry
      vi.advanceTimersByTime(200);

      // Should have attempted to reconnect
      expect(eventSourceCalls.length).toBeGreaterThan(1);
    });

    it("should not retry if shouldConnect returns false", () => {
      const handlers: SseEventHandlers = {};
      const shouldConnect = vi.fn(() => true);
      const config: Partial<SseRetryConfig> = {
        maxRetryAttempts: 3,
        initialRetryDelay: 100,
      };
      const manager = new SseConnectionManager(
        "http://test.com/sse",
        handlers,
        shouldConnect,
        config
      );

      manager.connect();
      const initialCallCount = eventSourceCalls.length;

      // Make shouldConnect return false
      shouldConnect.mockReturnValue(false);
      mockEventSource!.simulateError();

      // Advance time
      vi.advanceTimersByTime(200);

      // Should not have retried
      expect(eventSourceCalls.length).toBe(initialCallCount);
    });

    it("should call onMaxRetriesReached when max retries reached", () => {
      const handlers: SseEventHandlers = {
        onMaxRetriesReached: vi.fn(),
        onError: vi.fn(),
      };
      const shouldConnect = () => true;
      const config: Partial<SseRetryConfig> = {
        maxRetryAttempts: 2,
        initialRetryDelay: 100,
      };
      const manager = new SseConnectionManager(
        "http://test.com/sse",
        handlers,
        shouldConnect,
        config
      );

      // First error (attempt 0 fails, retryCount becomes 1)
      manager.connect();
      mockEventSource!.simulateError();
      expect((manager as any).retryCount).toBe(1);

      // Retry and fail again - the retry will automatically call connect()
      // This is attempt 1 (retryCount was 1, now becomes 2 after error)
      vi.advanceTimersByTime(200);
      // After retry, a new EventSource should be created
      expect(mockEventSource).not.toBeNull();
      if (mockEventSource) {
        mockEventSource.simulateError();
      }
      expect((manager as any).retryCount).toBe(2);

      // Retry one more time - this will be attempt 2
      vi.advanceTimersByTime(200);
      // After retry, a new EventSource should be created
      expect(mockEventSource).not.toBeNull();
      if (mockEventSource) {
        mockEventSource.simulateError();
      }
      // After third error, retryCount should be 3 (which >= maxRetryAttempts 2)
      expect((manager as any).retryCount).toBe(3);

      // Should have called onMaxRetriesReached because retryCount (3) >= maxRetryAttempts (2)
      expect(handlers.onMaxRetriesReached).toHaveBeenCalled();
      expect(handlers.onError).toHaveBeenCalled();
    });

    it("should reset retry count on successful connection", () => {
      const handlers: SseEventHandlers = {};
      const shouldConnect = () => true;
      const config: Partial<SseRetryConfig> = {
        maxRetryAttempts: 3,
        initialRetryDelay: 100,
      };
      const manager = new SseConnectionManager(
        "http://test.com/sse",
        handlers,
        shouldConnect,
        config
      );

      manager.connect();
      mockEventSource!.simulateError();
      expect((manager as any).retryCount).toBe(1);

      // Retry and succeed - the retry will automatically call connect()
      vi.advanceTimersByTime(200);
      // After retry, a new EventSource should be created
      expect(mockEventSource).not.toBeNull();
      if (mockEventSource) {
        mockEventSource.simulateEvent("connected");
      }

      expect((manager as any).retryCount).toBe(0);
    });

    it("should calculate retry delay with exponential backoff and jitter", () => {
      const handlers: SseEventHandlers = {};
      const shouldConnect = () => true;
      const config: Partial<SseRetryConfig> = {
        initialRetryDelay: 1000,
        maxRetryDelay: 10000,
      };
      const manager = new SseConnectionManager(
        "http://test.com/sse",
        handlers,
        shouldConnect,
        config
      );

      // Mock Math.random for consistent jitter
      const originalRandom = Math.random;
      Math.random = vi.fn(() => 0.1); // 10% jitter

      const delay0 = (manager as any).calculateRetryDelay(0);
      const delay1 = (manager as any).calculateRetryDelay(1);
      const delay2 = (manager as any).calculateRetryDelay(2);

      // delay0 should be around 1000 + jitter
      expect(delay0).toBeGreaterThanOrEqual(1000);
      expect(delay0).toBeLessThan(1300);

      // delay1 should be around 2000 + jitter
      expect(delay1).toBeGreaterThanOrEqual(2000);
      expect(delay1).toBeLessThan(2600);

      // delay2 should be around 4000 + jitter
      expect(delay2).toBeGreaterThanOrEqual(4000);
      expect(delay2).toBeLessThan(5200);

      Math.random = originalRandom;
    });

    it("should cap retry delay at maxRetryDelay", () => {
      const handlers: SseEventHandlers = {};
      const shouldConnect = () => true;
      const config: Partial<SseRetryConfig> = {
        initialRetryDelay: 1000,
        maxRetryDelay: 5000,
      };
      const manager = new SseConnectionManager(
        "http://test.com/sse",
        handlers,
        shouldConnect,
        config
      );

      // Mock Math.random for consistent jitter
      const originalRandom = Math.random;
      Math.random = vi.fn(() => 0.1);

      // Attempt 10 should be capped at maxRetryDelay
      const delay10 = (manager as any).calculateRetryDelay(10);

      expect(delay10).toBeLessThanOrEqual(6500); // 5000 + 30% jitter

      Math.random = originalRandom;
    });
  });

  describe("heartbeat monitoring", () => {
    it("should detect heartbeat timeout and reconnect", () => {
      const handlers: SseEventHandlers = {};
      const shouldConnect = () => true;
      const config: Partial<SseRetryConfig> = {
        heartbeatTimeout: 1000,
        heartbeatCheckInterval: 500,
      };
      const manager = new SseConnectionManager(
        "http://test.com/sse",
        handlers,
        shouldConnect,
        config
      );

      manager.connect();
      mockEventSource!.simulateEvent("connected");

      // Advance time past heartbeat timeout
      vi.advanceTimersByTime(1500);

      // Should have disconnected and attempted to reconnect
      expect((manager as any).retryCount).toBe(0);
      // New connection should be attempted
      expect(eventSourceCalls.length).toBeGreaterThan(1);
    });

    it("should not check heartbeat if shouldConnect returns false", () => {
      const handlers: SseEventHandlers = {};
      const shouldConnect = vi.fn(() => true);
      const config: Partial<SseRetryConfig> = {
        heartbeatTimeout: 1000,
        heartbeatCheckInterval: 500,
      };
      const manager = new SseConnectionManager(
        "http://test.com/sse",
        handlers,
        shouldConnect,
        config
      );

      // Connect first with shouldConnect returning true
      manager.connect();
      mockEventSource!.simulateEvent("connected");

      // Now make shouldConnect return false
      shouldConnect.mockReturnValue(false);

      // Advance time past heartbeat timeout
      vi.advanceTimersByTime(1500);

      // Should not have attempted reconnection because shouldConnect returns false
      expect(eventSourceCalls.length).toBe(1);
    });

    it("should not check heartbeat if eventSource is null", () => {
      const handlers: SseEventHandlers = {};
      const shouldConnect = () => true;
      const config: Partial<SseRetryConfig> = {
        heartbeatTimeout: 1000,
        heartbeatCheckInterval: 500,
      };
      const manager = new SseConnectionManager(
        "http://test.com/sse",
        handlers,
        shouldConnect,
        config
      );

      manager.connect();
      mockEventSource!.simulateEvent("connected");
      (manager as any).eventSource = null;

      // Advance time
      vi.advanceTimersByTime(1500);

      // Should not crash
      expect((manager as any).retryCount).toBe(0);
    });

    it("should not timeout if heartbeat received recently", () => {
      const handlers: SseEventHandlers = {};
      const shouldConnect = () => true;
      const config: Partial<SseRetryConfig> = {
        heartbeatTimeout: 1000,
        heartbeatCheckInterval: 500,
      };
      const manager = new SseConnectionManager(
        "http://test.com/sse",
        handlers,
        shouldConnect,
        config
      );

      manager.connect();
      mockEventSource!.simulateEvent("connected");

      // Send heartbeat
      vi.advanceTimersByTime(500);
      mockEventSource!.simulateEvent("heartbeat");

      // Advance time but not past timeout
      vi.advanceTimersByTime(500);

      // Should still be connected
      expect((manager as any).eventSource).not.toBeNull();
    });

    it("should handle case when lastHeartbeat is null", () => {
      const handlers: SseEventHandlers = {};
      const shouldConnect = () => true;
      const config: Partial<SseRetryConfig> = {
        heartbeatTimeout: 1000,
        heartbeatCheckInterval: 500,
      };
      const manager = new SseConnectionManager(
        "http://test.com/sse",
        handlers,
        shouldConnect,
        config
      );

      manager.connect();
      (manager as any).lastHeartbeat = null;

      // Advance time
      vi.advanceTimersByTime(1500);

      // Should not crash
      expect((manager as any).eventSource).not.toBeNull();
    });
  });

  describe("edge cases", () => {
    it("should handle multiple rapid connect calls", () => {
      const handlers: SseEventHandlers = {};
      const shouldConnect = () => true;
      const manager = new SseConnectionManager(
        "http://test.com/sse",
        handlers,
        shouldConnect
      );

      manager.connect();
      manager.connect();
      manager.connect();

      // Should only create one EventSource
      expect(eventSourceCalls.length).toBe(1);
    });

    it("should handle disconnect when not connected", () => {
      const handlers: SseEventHandlers = {};
      const shouldConnect = () => true;
      const manager = new SseConnectionManager(
        "http://test.com/sse",
        handlers,
        shouldConnect
      );

      // Should not throw
      expect(() => manager.disconnect()).not.toThrow();
    });

    it("should handle disconnect multiple times", () => {
      const handlers: SseEventHandlers = {};
      const shouldConnect = () => true;
      const manager = new SseConnectionManager(
        "http://test.com/sse",
        handlers,
        shouldConnect
      );

      manager.connect();
      manager.disconnect();
      manager.disconnect();

      // Should not throw
      expect((manager as any).eventSource).toBeNull();
    });

    it("should handle retry timeout cleanup when shouldConnect changes", () => {
      const handlers: SseEventHandlers = {};
      const shouldConnect = vi.fn(() => true);
      const config: Partial<SseRetryConfig> = {
        maxRetryAttempts: 3,
        initialRetryDelay: 1000,
      };
      const manager = new SseConnectionManager(
        "http://test.com/sse",
        handlers,
        shouldConnect,
        config
      );

      manager.connect();
      mockEventSource!.simulateError();

      // Set up retry
      expect((manager as any).retryTimeout).not.toBeNull();

      // Change shouldConnect to false
      shouldConnect.mockReturnValue(false);

      // Advance time to trigger retry
      vi.advanceTimersByTime(1500);

      // Should not have retried
      expect(eventSourceCalls.length).toBe(1);
    });
  });
});

