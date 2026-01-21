import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TelegramSessionService } from "../telegramSessionService.js";

describe("TelegramSessionService", () => {
    let sessionService: TelegramSessionService;

    beforeEach(() => {
        vi.useFakeTimers();
        sessionService = new TelegramSessionService();
    });

    afterEach(() => {
        sessionService.stopCleanup();
        sessionService.clearAllSessions();
        vi.useRealTimers();
    });

    it("should set and get a waiting for note session", () => {
        const chatId = "123456";
        const reminderId = 42;
        const messageId = 789;
        const userId = 1;

        sessionService.setWaitingForNote(chatId, reminderId, messageId, userId);
        const session = sessionService.getSession(chatId);

        expect(session).not.toBeNull();
        expect(session?.reminderId).toBe(reminderId);
        expect(session?.messageId).toBe(messageId);
        expect(session?.userId).toBe(userId);
        expect(session?.expiresAt).toBeInstanceOf(Date);
    });

    it("should return null for non-existent session", () => {
        const session = sessionService.getSession("nonexistent");
        expect(session).toBeNull();
    });

    it("should clear an existing session", () => {
        const chatId = "123456";
        sessionService.setWaitingForNote(chatId, 42, 789, 1);

        sessionService.clearSession(chatId);
        const session = sessionService.getSession(chatId);

        expect(session).toBeNull();
    });

    it("should expire sessions after timeout", () => {
        const now = Date.now();
        vi.setSystemTime(now);

        const chatId = "123456";
        sessionService.setWaitingForNote(chatId, 42, 789, 1);

        // Advance time by 11 minutes (timeout is 10 minutes)
        vi.advanceTimersByTime(11 * 60 * 1000);

        const session = sessionService.getSession(chatId);
        expect(session).toBeNull();
    });

    it("should automatically clean up expired sessions", () => {
        const now = Date.now();
        vi.setSystemTime(now);

        sessionService.setWaitingForNote("chat1", 42, 789, 1);
        sessionService.setWaitingForNote("chat2", 43, 790, 1);

        expect(sessionService.getActiveSessionCount()).toBe(2);

        // Advance time by 11 minutes
        vi.advanceTimersByTime(11 * 60 * 1000);

        // Trigger cleanup (it runs every 5 minutes automatically, but we can wait for the interval)
        // Instead of waiting, we can advanced timers again
        vi.advanceTimersByTime(5 * 60 * 1000); // 16 minutes total

        expect(sessionService.getActiveSessionCount()).toBe(0);
    });
});

