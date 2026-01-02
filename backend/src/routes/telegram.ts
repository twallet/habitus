import { Router, Request, Response } from "express";
import { ServiceManager } from "../services/index.js";
import { ServerConfig } from "../setup/constants.js";

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

export default router;
