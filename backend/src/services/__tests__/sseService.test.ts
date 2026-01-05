import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SseService } from "../sseService.js";
import { Response } from "express";

/**
 * Mock Response object for testing SSE.
 * @private
 */
function createMockResponse(): Response & {
  emit: (event: string) => void;
  getWrittenData: () => string[];
} {
  const listeners: Record<string, Function[]> = {};
  const writtenData: string[] = [];

  const mockRes = {
    setHeader: vi.fn(),
    write: vi.fn((data: string) => {
      writtenData.push(data);
      return true;
    }),
    on: vi.fn((event: string, handler: Function) => {
      if (!listeners[event]) {
        listeners[event] = [];
      }
      listeners[event].push(handler);
    }),
    emit: (event: string) => {
      if (listeners[event]) {
        listeners[event].forEach((handler) => handler());
      }
    },
    getWrittenData: () => writtenData,
  };

  return mockRes as any;
}

describe("SseService", () => {
  let sseService: SseService;

  beforeEach(() => {
    vi.useFakeTimers();
    sseService = new SseService();
  });

  afterEach(() => {
    sseService.destroy();
    vi.useRealTimers();
  });

  describe("addClient", () => {
    it("should register a new client and send connected event", () => {
      const mockRes = createMockResponse();
      const userId = 1;

      sseService.addClient(userId, mockRes);

      // Verify headers were set
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "Content-Type",
        "text/event-stream"
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "Cache-Control",
        "no-cache"
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "Connection",
        "keep-alive"
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith("X-Accel-Buffering", "no");

      // Verify connected event was sent
      const writtenData = mockRes.getWrittenData();
      expect(writtenData).toContain("event: connected\n");
      expect(
        writtenData.some((d: string) => d.includes("Connection established"))
      ).toBe(true);
    });

    it("should handle multiple clients for the same user", () => {
      const mockRes1 = createMockResponse();
      const mockRes2 = createMockResponse();
      const userId = 1;

      sseService.addClient(userId, mockRes1);
      sseService.addClient(userId, mockRes2);

      // Both should receive connected event
      expect(mockRes1.getWrittenData()).toContain("event: connected\n");
      expect(mockRes2.getWrittenData()).toContain("event: connected\n");
    });

    it("should remove client on connection close", () => {
      const mockRes = createMockResponse();
      const userId = 1;

      sseService.addClient(userId, mockRes);

      // Simulate connection close
      mockRes.emit("close");

      // Client should be removed (verified by notifyTelegramConnected not sending to this client)
      const mockRes2 = createMockResponse();
      sseService.addClient(userId, mockRes2);
      sseService.notifyTelegramConnected(userId, "123456", "testuser");

      // Only mockRes2 should receive the notification
      expect(
        mockRes2
          .getWrittenData()
          .some((d: string) => d.includes("telegram-connected"))
      ).toBe(true);
    });
  });

  describe("notifyTelegramConnected", () => {
    it("should send telegram-connected event to all clients for a user", () => {
      const mockRes1 = createMockResponse();
      const mockRes2 = createMockResponse();
      const userId = 1;

      sseService.addClient(userId, mockRes1);
      sseService.addClient(userId, mockRes2);

      sseService.notifyTelegramConnected(userId, "123456", "testuser");

      // Both clients should receive the event
      [mockRes1, mockRes2].forEach((res) => {
        const writtenData = res.getWrittenData();
        expect(
          writtenData.some((d: string) =>
            d.includes("event: telegram-connected")
          )
        ).toBe(true);
        expect(writtenData.some((d: string) => d.includes("123456"))).toBe(
          true
        );
        expect(writtenData.some((d: string) => d.includes("testuser"))).toBe(
          true
        );
      });
    });

    it("should handle notification when no clients are connected", () => {
      // Should not throw error
      expect(() => {
        sseService.notifyTelegramConnected(999, "123456", "testuser");
      }).not.toThrow();
    });

    it("should send notification without username if not provided", () => {
      const mockRes = createMockResponse();
      const userId = 1;

      sseService.addClient(userId, mockRes);
      sseService.notifyTelegramConnected(userId, "123456");

      const writtenData = mockRes.getWrittenData();
      expect(
        writtenData.some((d: string) => d.includes("event: telegram-connected"))
      ).toBe(true);
      expect(writtenData.some((d: string) => d.includes("123456"))).toBe(true);
    });
  });

  describe("heartbeat", () => {
    it("should send heartbeat to all connected clients every 30 seconds", () => {
      const mockRes1 = createMockResponse();
      const mockRes2 = createMockResponse();

      sseService.addClient(1, mockRes1);
      sseService.addClient(2, mockRes2);

      // Clear initial connected events
      mockRes1.getWrittenData().length = 0;
      mockRes2.getWrittenData().length = 0;

      // Advance time by 30 seconds
      vi.advanceTimersByTime(30000);

      // Both clients should receive heartbeat
      [mockRes1, mockRes2].forEach((res) => {
        const writtenData = res.getWrittenData();
        expect(
          writtenData.some((d: string) => d.includes("event: heartbeat"))
        ).toBe(true);
      });
    });

    it("should send multiple heartbeats over time", () => {
      const mockRes = createMockResponse();
      sseService.addClient(1, mockRes);

      // Clear initial connected event
      mockRes.getWrittenData().length = 0;

      // Advance time by 90 seconds (3 heartbeats)
      vi.advanceTimersByTime(90000);

      const writtenData = mockRes.getWrittenData();
      const heartbeatCount = writtenData.filter((d: string) =>
        d.includes("event: heartbeat")
      ).length;
      expect(heartbeatCount).toBe(3);
    });
  });

  describe("destroy", () => {
    it("should clear heartbeat interval", () => {
      const mockRes = createMockResponse();
      sseService.addClient(1, mockRes);

      sseService.destroy();

      // Clear data
      mockRes.getWrittenData().length = 0;

      // Advance time - no heartbeat should be sent
      vi.advanceTimersByTime(30000);

      expect(mockRes.getWrittenData().length).toBe(0);
    });

    it("should clear all clients", () => {
      const mockRes = createMockResponse();
      sseService.addClient(1, mockRes);

      sseService.destroy();

      // Notification should not be sent to any clients
      sseService.notifyTelegramConnected(1, "123456", "testuser");

      // No telegram-connected event should be sent after destroy
      const writtenData = mockRes.getWrittenData();
      expect(
        writtenData.some((d: string) => d.includes("telegram-connected"))
      ).toBe(false);
    });
  });
});
