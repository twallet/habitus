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

    console.log(
      `[${new Date().toISOString()}] TELEGRAM_WEBHOOK | Received update: ${JSON.stringify(
        {
          update_id: update.update_id,
          has_message: !!update.message,
          message_text: update.message?.text?.substring(0, 50),
        }
      )}`
    );

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
  console.log(
    `[${new Date().toISOString()}] TELEGRAM_WEBHOOK | Processing update ${
      update.update_id
    }`
  );

  // Only process messages (ignore other update types)
  if (!update.message || !update.message.text) {
    console.log(
      `[${new Date().toISOString()}] TELEGRAM_WEBHOOK | Update ${
        update.update_id
      } has no message or text, skipping`
    );
    return;
  }

  const messageText = update.message.text.trim();
  const chatId = update.message.chat.id.toString();

  console.log(
    `[${new Date().toISOString()}] TELEGRAM_WEBHOOK | Processing message: "${messageText.substring(
      0,
      100
    )}" from chat ${chatId}`
  );

  // Only process /start commands
  if (!messageText.startsWith("/start")) {
    console.log(
      `[${new Date().toISOString()}] TELEGRAM_WEBHOOK | Message is not a /start command, skipping`
    );
    return;
  }

  // Parse /start command: /start <token> <userId>
  const parts = messageText.split(/\s+/);
  console.log(
    `[${new Date().toISOString()}] TELEGRAM_WEBHOOK | Parsed /start command parts: ${
      parts.length
    } parts`
  );

  if (parts.length < 3) {
    console.log(
      `[${new Date().toISOString()}] TELEGRAM_WEBHOOK | Invalid /start command format: "${messageText}". Expected format: /start <token> <userId>`
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
  // Construct frontend URL without port for production (custom domain)
  // Only add port in development (localhost)
  const serverUrl = ServerConfig.getServerUrl();
  let frontendUrl: string;
  if (serverUrl.startsWith("https://") || serverUrl.startsWith("http://")) {
    // Production: use URL as-is (no port needed)
    // Development: add port if it's localhost
    if (serverUrl.includes("localhost") || serverUrl.includes("127.0.0.1")) {
      frontendUrl = `${serverUrl}:${ServerConfig.getPort()}`;
    } else {
      frontendUrl = serverUrl;
    }
  } else {
    // Fallback: add port if URL doesn't have protocol
    frontendUrl = `${serverUrl}:${ServerConfig.getPort()}`;
  }

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

      // Check webhook status before generating link
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      let webhookConfigured = false;
      let webhookUrl = null;
      let webhookError = null;

      if (botToken) {
        try {
          const webhookInfoResponse = await fetch(
            `https://api.telegram.org/bot${botToken}/getWebhookInfo`
          );
          const webhookInfo = (await webhookInfoResponse.json()) as {
            ok: boolean;
            result?: {
              url?: string;
              last_error_message?: string;
              last_error_date?: number;
              pending_update_count?: number;
            };
          };
          if (webhookInfo.ok && webhookInfo.result?.url) {
            webhookConfigured = true;
            webhookUrl = webhookInfo.result.url;
            webhookError = webhookInfo.result.last_error_message || null;
          }
        } catch (error) {
          // Ignore webhook check errors
        }
      }

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
      const startParam = `${token} ${userId}`;
      const encodedParam = encodeURIComponent(startParam);
      const link = `https://t.me/${botUsername}?start=${encodedParam}`;

      console.log(
        `[${new Date().toISOString()}] TELEGRAM_ROUTE | Generated start link for userId: ${userId}`
      );

      // Warn if webhook is not configured or has errors
      if (!webhookConfigured) {
        console.warn(
          `[${new Date().toISOString()}] TELEGRAM_ROUTE | WARNING: Webhook is not configured. Telegram cannot send updates. Connection will not work.`
        );
      } else if (webhookError) {
        console.warn(
          `[${new Date().toISOString()}] TELEGRAM_ROUTE | WARNING: Webhook is configured but Telegram reports error: ${webhookError}`
        );
      }

      res.json({
        link,
        token,
        webhookConfigured,
        webhookUrl: webhookUrl || undefined,
        webhookError: webhookError || undefined,
      });
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
 * @returns {object} { connected: boolean, telegramChatId: string | null, telegramUsername: string | null }
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
      let telegramUsername: string | null = null;

      // Try to get Telegram username if connected
      if (connected && user.telegram_chat_id) {
        try {
          const telegramService = ServiceManager.getTelegramService();
          const chatInfo = await telegramService.getChatInfo(
            user.telegram_chat_id
          );
          telegramUsername = chatInfo.username || chatInfo.first_name || null;
        } catch (error) {
          // Log error but don't fail the request
          console.error(
            `[${new Date().toISOString()}] TELEGRAM_ROUTE | Error getting Telegram username:`,
            error
          );
        }
      }

      res.json({
        connected,
        telegramChatId: user.telegram_chat_id || null,
        telegramUsername,
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

/**
 * POST /api/telegram/set-webhook
 * Set up Telegram webhook URL.
 * This endpoint registers the webhook with Telegram so the bot can receive updates.
 * @route POST /api/telegram/set-webhook
 * @body {string} webhookUrl - The full URL where Telegram should send webhook updates (must be HTTPS)
 * @returns {object} { ok: boolean, result: object, description?: string }
 */
router.post("/set-webhook", async (req: Request, res: Response) => {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return res.status(500).json({
        error:
          "TELEGRAM_BOT_TOKEN not configured. Please set it in your .env file.",
      });
    }

    const { webhookUrl } = req.body;

    if (!webhookUrl) {
      return res.status(400).json({
        error: "webhookUrl is required in request body",
      });
    }

    // Validate that webhook URL is HTTPS (Telegram requirement)
    if (!webhookUrl.startsWith("https://")) {
      return res.status(400).json({
        error:
          "Webhook URL must use HTTPS. Telegram requires secure connections.",
      });
    }

    // Construct webhook URL with the endpoint
    const fullWebhookUrl = webhookUrl.endsWith("/")
      ? `${webhookUrl}api/telegram/webhook`
      : `${webhookUrl}/api/telegram/webhook`;

    console.log(
      `[${new Date().toISOString()}] TELEGRAM_ROUTE | Setting webhook to: ${fullWebhookUrl}`
    );

    // Call Telegram API to set webhook
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/setWebhook`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: fullWebhookUrl,
        }),
      }
    );

    const data = (await response.json()) as {
      ok: boolean;
      result?: boolean;
      description?: string;
    };

    if (!response.ok || !data.ok) {
      console.error(
        `[${new Date().toISOString()}] TELEGRAM_ROUTE | Failed to set webhook:`,
        data
      );
      return res.status(500).json({
        error: data.description || "Failed to set webhook",
        details: data,
      });
    }

    console.log(
      `[${new Date().toISOString()}] TELEGRAM_ROUTE | Webhook set successfully`
    );

    res.json({
      ok: true,
      webhookUrl: fullWebhookUrl,
      message: "Webhook set successfully",
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] TELEGRAM_ROUTE | Error setting webhook:`,
      error
    );
    res.status(500).json({
      error: "Error setting webhook",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/telegram/webhook-info
 * Get current webhook information from Telegram.
 * @route GET /api/telegram/webhook-info
 * @returns {object} { ok: boolean, result: object }
 */
router.get("/webhook-info", async (req: Request, res: Response) => {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return res.status(500).json({
        error:
          "TELEGRAM_BOT_TOKEN not configured. Please set it in your .env file.",
      });
    }

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getWebhookInfo`
    );

    const data = (await response.json()) as {
      ok: boolean;
      result?: {
        url?: string;
        has_custom_certificate?: boolean;
        pending_update_count?: number;
        last_error_date?: number;
        last_error_message?: string;
        max_connections?: number;
        allowed_updates?: string[];
      };
    };

    if (!response.ok || !data.ok) {
      return res.status(500).json({
        error: "Failed to get webhook info",
        details: data,
      });
    }

    res.json({
      ok: true,
      webhookInfo: data.result,
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] TELEGRAM_ROUTE | Error getting webhook info:`,
      error
    );
    res.status(500).json({
      error: "Error getting webhook info",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/telegram/webhook/test
 * Test endpoint to verify webhook route is accessible.
 * @route GET /api/telegram/webhook/test
 * @returns {object} { ok: true, message: string, timestamp: string }
 */
router.get("/webhook/test", async (req: Request, res: Response) => {
  res.json({
    ok: true,
    message: "Webhook endpoint is accessible",
    timestamp: new Date().toISOString(),
  });
});

export default router;
