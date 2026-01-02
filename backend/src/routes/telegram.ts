import { Router, Request, Response } from "express";
import { ServiceManager } from "../services/index.js";
import { ServerConfig } from "../setup/constants.js";

const router = Router();

// Lazy-load services to allow dependency injection in tests
const getTelegramConnectionServiceInstance = () =>
  ServiceManager.getTelegramConnectionService();
const getUserServiceInstance = () => ServiceManager.getUserService();
const getTelegramServiceInstance = () => ServiceManager.getTelegramService();

/**
 * Telegram webhook update interface.
 * @private
 */
interface TelegramUpdate {
  update_id?: number;
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
 * @returns {object} { ok: boolean }
 */
router.post("/webhook", async (req: Request, res: Response) => {
  try {
    const update: TelegramUpdate = req.body;

    // Ignore updates without message
    if (!update.message || !update.message.text) {
      return res.json({ ok: true });
    }

    const messageText = update.message.text.trim();
    const chatId = update.message.chat.id.toString();

    // Check if it's a /start command with token
    if (messageText.startsWith("/start")) {
      const parts = messageText.split(/\s+/);

      // Format: /start <token> <userId>
      if (parts.length >= 3) {
        const token = parts[1];
        const userId = parseInt(parts[2], 10);

        if (!isNaN(userId) && token) {
          console.log(
            `[${new Date().toISOString()}] TELEGRAM_WEBHOOK | Processing /start command for userId: ${userId}, chatId: ${chatId}`
          );

          // Validate token
          const telegramConnectionService =
            getTelegramConnectionServiceInstance();
          const tokenValidation = await telegramConnectionService.validateToken(
            token
          );

          if (tokenValidation && tokenValidation.userId === userId) {
            // Token is valid - associate chat ID with user
            const userService = getUserServiceInstance();
            const user = await userService.getUserById(userId);

            if (user) {
              // Update user's telegram_chat_id
              await userService.updateNotificationPreferences(
                userId,
                "Telegram",
                chatId
              );

              console.log(
                `[${new Date().toISOString()}] TELEGRAM_WEBHOOK | Successfully associated chatId ${chatId} with userId ${userId}`
              );

              // Send welcome message (will be implemented in Step 10)
              // For now, we'll just log that it should be sent
              const telegramService = getTelegramServiceInstance();
              const frontendUrl = `${ServerConfig.getServerUrl()}:${ServerConfig.getPort()}`;
              const welcomeMessage = `✅ *Telegram Connected!*\n\nYour Habitus account has been successfully connected to Telegram.\n\nYou will now receive reminders via Telegram.\n\n[Open Habitus](${frontendUrl})`;

              try {
                await telegramService.sendMessage(chatId, welcomeMessage);
                console.log(
                  `[${new Date().toISOString()}] TELEGRAM_WEBHOOK | Welcome message sent to chatId: ${chatId}`
                );
              } catch (error) {
                console.error(
                  `[${new Date().toISOString()}] TELEGRAM_WEBHOOK | Error sending welcome message:`,
                  error
                );
                // Don't fail the webhook if welcome message fails
              }
            } else {
              console.warn(
                `[${new Date().toISOString()}] TELEGRAM_WEBHOOK | User not found: userId ${userId}`
              );
            }
          } else {
            console.warn(
              `[${new Date().toISOString()}] TELEGRAM_WEBHOOK | Invalid or expired token for userId: ${userId}`
            );
          }
        }
      }
    }

    // Always return ok: true to Telegram (even if we ignore the message)
    return res.json({ ok: true });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] TELEGRAM_WEBHOOK | Error processing webhook:`,
      error
    );
    // Always return ok: true to Telegram to prevent retries
    return res.json({ ok: true });
  }
});

export default router;
