import { Logger } from "../setup/logger.js";

/**
 * Session data for Telegram users waiting to add notes.
 * @public
 */
export interface TelegramSession {
    reminderId: number;
    messageId: number;
    userId: number;
    expiresAt: Date;
}

/**
 * Service for managing Telegram user sessions.
 * Tracks users who are in "waiting for note" state after clicking the Add Note button.
 * @public
 */
export class TelegramSessionService {
    private sessions: Map<string, TelegramSession> = new Map();
    private cleanupInterval: NodeJS.Timeout | null = null;
    private readonly SESSION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
    private readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

    /**
     * Create a new TelegramSessionService instance.
     * Starts automatic cleanup of expired sessions.
     * @public
     */
    constructor() {
        this.startCleanup();
    }

    /**
     * Set a user session to "waiting for note" state.
     * @param chatId - Telegram chat ID
     * @param reminderId - Reminder ID
     * @param messageId - Message ID of the reminder message
     * @param userId - User ID
     * @public
     */
    setWaitingForNote(
        chatId: string,
        reminderId: number,
        messageId: number,
        userId: number
    ): void {
        const expiresAt = new Date(Date.now() + this.SESSION_TIMEOUT_MS);
        this.sessions.set(chatId, {
            reminderId,
            messageId,
            userId,
            expiresAt,
        });

        Logger.info(
            `TELEGRAM_SESSION | Set waiting for note session for chatId: ${chatId}, reminderId: ${reminderId}, expires at: ${expiresAt.toISOString()}`
        );
    }

    /**
     * Get active session for a chat ID.
     * Returns null if session doesn't exist or has expired.
     * @param chatId - Telegram chat ID
     * @returns Session data or null
     * @public
     */
    getSession(chatId: string): TelegramSession | null {
        const session = this.sessions.get(chatId);

        if (!session) {
            return null;
        }

        // Check if session has expired
        if (new Date() > session.expiresAt) {
            Logger.debug(
                `TELEGRAM_SESSION | Session expired for chatId: ${chatId}, removing`
            );
            this.sessions.delete(chatId);
            return null;
        }

        return session;
    }

    /**
     * Clear session for a chat ID.
     * @param chatId - Telegram chat ID
     * @public
     */
    clearSession(chatId: string): void {
        const existed = this.sessions.delete(chatId);
        if (existed) {
            Logger.info(`TELEGRAM_SESSION | Cleared session for chatId: ${chatId}`);
        }
    }

    /**
     * Start automatic cleanup of expired sessions.
     * Runs every 5 minutes.
     * @private
     */
    private startCleanup(): void {
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredSessions();
        }, this.CLEANUP_INTERVAL_MS);

        Logger.info(
            "TELEGRAM_SESSION | Started automatic session cleanup (every 5 minutes)"
        );
    }

    /**
     * Stop automatic cleanup of expired sessions.
     * Should be called when shutting down the service.
     * @public
     */
    stopCleanup(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
            Logger.info("TELEGRAM_SESSION | Stopped automatic session cleanup");
        }
    }

    /**
     * Clean up all expired sessions.
     * @private
     */
    private cleanupExpiredSessions(): void {
        const now = new Date();
        let expiredCount = 0;

        for (const [chatId, session] of this.sessions.entries()) {
            if (now > session.expiresAt) {
                this.sessions.delete(chatId);
                expiredCount++;
            }
        }

        if (expiredCount > 0) {
            Logger.info(
                `TELEGRAM_SESSION | Cleaned up ${expiredCount} expired session(s)`
            );
        }
    }

    /**
     * Get the number of active sessions.
     * @returns Number of active sessions
     * @public
     */
    getActiveSessionCount(): number {
        return this.sessions.size;
    }

    /**
     * Clear all sessions.
     * Useful for testing.
     * @public
     */
    clearAllSessions(): void {
        const count = this.sessions.size;
        this.sessions.clear();
        Logger.info(`TELEGRAM_SESSION | Cleared all ${count} session(s)`);
    }
}
