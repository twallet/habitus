import { Response } from "express";

/**
 * Represents an SSE client connection.
 * @private
 */
interface SseClient {
  userId: number;
  res: Response;
  lastHeartbeat: Date;
}

/**
 * Service for managing Server-Sent Events connections.
 * Handles real-time notifications for Telegram connection status.
 * Follows OOP principles by organizing related methods in a class.
 * @public
 */
export class SseService {
  private clients: Map<number, SseClient[]> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  /**
   * Create a new SseService instance.
   * Starts the heartbeat interval to keep connections alive.
   * @public
   */
  constructor() {
    // Send heartbeat every 30 seconds to keep connections alive
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 30000);
  }

  /**
   * Register a new SSE client connection.
   * @param userId - The user ID
   * @param res - Express Response object for SSE stream
   * @public
   */
  addClient(userId: number, res: Response): void {
    const client: SseClient = {
      userId,
      res,
      lastHeartbeat: new Date(),
    };

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

    // Add to clients map
    if (!this.clients.has(userId)) {
      this.clients.set(userId, []);
    }
    this.clients.get(userId)!.push(client);

    console.log(
      `[${new Date().toISOString()}] SSE | Client connected for userId: ${userId}`
    );

    // Remove client on connection close
    res.on("close", () => {
      this.removeClient(userId, res);
    });

    // Send initial connection success message
    this.sendEvent(res, "connected", { message: "Connection established" });
  }

  /**
   * Remove a client connection.
   * @param userId - The user ID
   * @param res - Express Response object to remove
   * @private
   */
  private removeClient(userId: number, res: Response): void {
    const clients = this.clients.get(userId);
    if (clients) {
      const filtered = clients.filter((c) => c.res !== res);
      if (filtered.length === 0) {
        this.clients.delete(userId);
      } else {
        this.clients.set(userId, filtered);
      }
    }
    console.log(
      `[${new Date().toISOString()}] SSE | Client disconnected for userId: ${userId}`
    );
  }

  /**
   * Notify a user that their Telegram account was connected.
   * @param userId - The user ID
   * @param chatId - Telegram chat ID
   * @param username - Telegram username (optional)
   * @public
   */
  notifyTelegramConnected(
    userId: number,
    chatId: string,
    username?: string
  ): void {
    const clients = this.clients.get(userId);
    if (!clients || clients.length === 0) {
      console.log(
        `[${new Date().toISOString()}] SSE | No clients connected for userId: ${userId}`
      );
      return;
    }

    const data = {
      chatId,
      username,
      timestamp: new Date().toISOString(),
    };

    console.log(
      `[${new Date().toISOString()}] SSE | Notifying ${
        clients.length
      } client(s) for userId: ${userId}`
    );

    clients.forEach((client) => {
      this.sendEvent(client.res, "telegram-connected", data);
    });
  }

  /**
   * Send heartbeat to all connected clients.
   * @private
   */
  private sendHeartbeat(): void {
    const now = new Date();
    this.clients.forEach((clients) => {
      clients.forEach((client) => {
        this.sendEvent(client.res, "heartbeat", {
          timestamp: now.toISOString(),
        });
        client.lastHeartbeat = now;
      });
    });
  }

  /**
   * Send an SSE event to a client.
   * @param res - Express Response object
   * @param event - Event name
   * @param data - Event data object
   * @private
   */
  private sendEvent(res: Response, event: string, data: any): void {
    try {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] SSE | Error sending event:`,
        error
      );
    }
  }

  /**
   * Clean up resources on service shutdown.
   * @public
   */
  destroy(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.clients.clear();
  }
}
