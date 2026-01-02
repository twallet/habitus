import { Router, Request, Response } from "express";
import { ServiceManager } from "../services/index.js";
import { ServerConfig } from "../setup/constants.js";
import {
  authenticateToken,
  AuthRequest,
} from "../middleware/authMiddleware.js";

const router = Router();

/**
 * Telegram webhook update interface.
 * @private
 */
interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: {
      id: number;
      is_bot: boolean;
      first_name?: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
      first_name?: string;
      username?: string;
    };
    date: number;
    text?: string;
  };
}

/**
 * POST /api/telegram/webhook
 * Handle Telegram bot webhook updates.
 * Processes /start commands with connection tokens.
 * @route POST /api/telegram/webhook
 * @body {TelegramUpdate} - Telegram webhook update object
 * @returns {object} { ok: true }
 */
router.post("/webhook", async (req: Request, res: Response) => {
  try {
    const update = req.body as TelegramUpdate;

    // Telegram requires webhooks to always return 200 OK
    // We'll process the update asynchronously
    res.status(200).json({ ok: true });

    // Process the update asynchronously
    processTelegramUpdate(update).catch((error) => {
      console.error(
        `[${new Date().toISOString()}] TELEGRAM_WEBHOOK | Error processing update:`,
        error
      );
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] TELEGRAM_WEBHOOK | Error handling webhook:`,
      error
    );
    // Still return 200 OK to Telegram
    res.status(200).json({ ok: true });
  }
});

/**
 * Process a Telegram webhook update.
 * Handles /start commands with connection tokens.
 * @param update - Telegram webhook update object
 * @private
 */
async function processTelegramUpdate(update: TelegramUpdate): Promise<void> {
  // Only process messages (ignore other update types)
  if (!update.message || !update.message.text) {
    return;
  }

  const messageText = update.message.text.trim();
  const chatId = update.message.chat.id.toString();

  // Only process /start commands
  if (!messageText.startsWith("/start")) {
    return;
  }

  // Parse /start command: /start <token> <userId>
  const parts = messageText.split(/\s+/);
  if (parts.length < 3) {
    console.log(
      `[${new Date().toISOString()}] TELEGRAM_WEBHOOK | Invalid /start command format: ${messageText}`
    );
    return;
  }

  const token = parts[1];
  const userIdStr = parts[2];
  const userId = parseInt(userIdStr, 10);

  if (isNaN(userId)) {
    console.log(
      `[${new Date().toISOString()}] TELEGRAM_WEBHOOK | Invalid user ID in /start command: ${userIdStr}`
    );
    return;
  }

  // Validate token
  const telegramConnectionService =
    ServiceManager.getTelegramConnectionService();
  const validationResult = await telegramConnectionService.validateToken(token);

  if (!validationResult) {
    console.log(
      `[${new Date().toISOString()}] TELEGRAM_WEBHOOK | Invalid or expired token: ${token}`
    );
    return;
  }

  // Verify that the token's user ID matches the provided user ID
  if (validationResult.userId !== userId) {
    console.log(
      `[${new Date().toISOString()}] TELEGRAM_WEBHOOK | User ID mismatch: token belongs to user ${
        validationResult.userId
      }, but command specified user ${userId}`
    );
    return;
  }

  // Update user's telegram_chat_id
  const userService = ServiceManager.getUserService();
  const user = await userService.getUserById(userId);

  if (!user) {
    console.log(
      `[${new Date().toISOString()}] TELEGRAM_WEBHOOK | User not found: ${userId}`
    );
    return;
  }

  // Update user with telegram_chat_id
  await userService.updateNotificationPreferences(userId, "Telegram", chatId);

  console.log(
    `[${new Date().toISOString()}] TELEGRAM_WEBHOOK | Successfully connected Telegram account for userId: ${userId}, chatId: ${chatId}`
  );

  // Send welcome message
  const telegramService = ServiceManager.getTelegramService();
  const frontendUrl = `${ServerConfig.getServerUrl()}:${ServerConfig.getPort()}`;

  try {
    await telegramService.sendWelcomeMessage(chatId, userId, frontendUrl);
  } catch (error) {
    // Log error but don't fail the connection process
    console.error(
      `[${new Date().toISOString()}] TELEGRAM_WEBHOOK | Error sending welcome message:`,
      error
    );
  }
}

/**
 * Get Telegram bot username from Bot API.
 * @returns Promise resolving to bot username
 * @private
 */
async function getBotUsername(): Promise<string> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    throw new Error(
      "TELEGRAM_BOT_TOKEN not configured. Please set it in your .env file."
    );
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);

  if (!response.ok) {
    throw new Error(
      `Failed to get bot info: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as {
    ok: boolean;
    result?: { username?: string };
  };

  if (!data.ok || !data.result?.username) {
    throw new Error("Failed to get bot username from Telegram API");
  }

  return data.result.username;
}

/**
 * GET /api/telegram/start-link
 * Generate a Telegram bot start link with connection token.
 * @route GET /api/telegram/start-link
 * @header {string} Authorization - Bearer token
 * @returns {object} { link: string, token: string }
 */
router.get(
  "/start-link",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;

      // Generate connection token
      const telegramConnectionService =
        ServiceManager.getTelegramConnectionService();
      const token = await telegramConnectionService.generateConnectionToken(
        userId
      );

      // Get bot username
      const botUsername = await getBotUsername();

      // Construct Telegram deep link
      // Format: https://t.me/<bot_username>?start=<token>%20<userId>
      // Telegram will send this as: /start <token> <userId>
      const link = `https://t.me/${botUsername}?start=${encodeURIComponent(
        `${token} ${userId}`
      )}`;

      console.log(
        `[${new Date().toISOString()}] TELEGRAM_ROUTE | Generated start link for userId: ${userId}`
      );

      res.json({ link, token });
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] TELEGRAM_ROUTE | Error generating start link:`,
        error
      );

      if (error instanceof Error) {
        if (error.message.includes("TELEGRAM_BOT_TOKEN")) {
          return res.status(500).json({
            error: "Telegram bot not configured. Please contact support.",
          });
        }
        if (error.message.includes("not found")) {
          return res.status(404).json({ error: "User not found" });
        }
      }

      res.status(500).json({ error: "Error generating start link" });
    }
  }
);

/**
 * GET /api/telegram/status
 * Get Telegram connection status for the authenticated user.
 * @route GET /api/telegram/status
 * @header {string} Authorization - Bearer token
 * @returns {object} { connected: boolean, telegramChatId: string | null }
 */
router.get(
  "/status",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;

      const userService = ServiceManager.getUserService();
      const user = await userService.getUserById(userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const connected = !!user.telegram_chat_id;

      res.json({
        connected,
        telegramChatId: user.telegram_chat_id || null,
      });
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] TELEGRAM_ROUTE | Error getting connection status:`,
        error
      );
      res.status(500).json({ error: "Error getting connection status" });
    }
  }
);

export default router;
