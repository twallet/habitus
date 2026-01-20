import { ServerConfig } from "../setup/constants.js";
import { DateUtils } from "@habitus/shared/utils";
import { Logger } from "../setup/logger.js";

/**
 * Telegram Bot API configuration interface.
 * @public
 */
export interface TelegramConfig {
  botToken: string;
  frontendUrl: string;
}

/**
 * Telegram API error response interface.
 * @public
 */
interface TelegramErrorResponse {
  description?: string;
  error_code?: number;
  ok?: boolean;
}

/**
 * Telegram API success response interface.
 * @public
 */
interface TelegramSuccessResponse {
  ok: boolean;
  result?: {
    message_id: number;
    [key: string]: unknown;
  };
  description?: string;
}

/**
 * Service for sending messages via Telegram Bot API.
 * @public
 */
export class TelegramService {
  private config: TelegramConfig;
  private readonly apiBaseUrl = "https://api.telegram.org/bot";

  /**
   * Create a new TelegramService instance.
   * @param config - Telegram configuration (optional, uses environment variables if not provided)
   * @public
   */
  constructor(config?: Partial<TelegramConfig>) {
    this.config = {
      botToken:
        config?.botToken !== undefined
          ? config.botToken
          : process.env.TELEGRAM_BOT_TOKEN || "",
      frontendUrl: config?.frontendUrl || ServerConfig.getPublicUrl(),
    };
  }

  /**
   * Send a reminder message via Telegram.
   * @param chatId - Telegram chat ID
   * @param reminderId - Reminder ID
   * @param trackingQuestion - Tracking question text
   * @param scheduledTime - Scheduled time for the reminder
   * @param trackingIcon - Tracking icon (emoji)
   * @param trackingDetails - Optional tracking details
   * @param notes - Optional reminder notes
   * @returns Promise that resolves when message is sent
   * @throws Error if message sending fails
   * @public
   */
  async sendReminderMessage(
    chatId: string,
    reminderId: number,
    trackingQuestion: string,
    scheduledTime: string,
    trackingIcon?: string,
    trackingDetails?: string,
    notes?: string,
    locale?: string,
    timezone?: string
  ): Promise<number> {
    Logger.info(`TELEGRAM | Preparing to send reminder message to chatId: ${chatId}, reminderId: ${reminderId}`);

    if (!this.config.botToken) {
      throw new Error(
        "Telegram bot token not configured. Please set TELEGRAM_BOT_TOKEN environment variable."
      );
    }

    if (!chatId) {
      throw new Error("Telegram chat ID is required");
    }

    const formattedTime = DateUtils.formatDateTime(
      scheduledTime,
      locale || "es-AR",
      timezone,
      {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    );

    const icon = trackingIcon || "📝";
    const dashboardUrl = `${this.config.frontendUrl}/`;

    // Build message text
    let messageText = `🌱 *Reminder*\n\n`;
    messageText += `${icon} *${this.escapeMarkdown(trackingQuestion)}*\n\n`;
    messageText += `📅 Scheduled for: ${formattedTime}\n`;

    if (trackingDetails) {
      messageText += `\n📋 Tracking details:\n${this.escapeMarkdown(
        trackingDetails
      )}\n`;
    }

    if (notes) {
      messageText += `\n📝 Reminder notes:\n${this.escapeMarkdown(notes)}\n`;
    }

    messageText += `\n[View Dashboard](${dashboardUrl})`;

    // Build inline keyboard with callback_data instead of URLs
    const inlineKeyboard = {
      inline_keyboard: [
        [
          {
            text: "\u2714\ufe0f",
            callback_data: `complete_${reminderId}`,
          },
          {
            text: "\u274c",
            callback_data: `dismiss_${reminderId}`,
          },
          {
            text: "\ud83d\udca4",
            callback_data: `postpone_${reminderId}`,
          },
          {
            text: "\ud83d\udcc4",
            callback_data: `addnote_${reminderId}`,
          },
        ],
      ],
    };

    try {
      const url = `${this.apiBaseUrl}${this.config.botToken}/sendMessage`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: messageText,
          parse_mode: "Markdown",
          reply_markup: inlineKeyboard,
        }),
      });

      if (!response.ok) {
        const errorData = (await response
          .json()
          .catch(() => ({}))) as TelegramErrorResponse;
        const errorMessage =
          errorData.description ||
          `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(`Telegram API error: ${errorMessage}`);
      }

      const result = (await response.json()) as TelegramSuccessResponse;
      if (!result.ok) {
        throw new Error(
          `Telegram API error: ${result.description || "Unknown error"}`
        );
      }

      const messageId = result.result?.message_id || 0;
      Logger.info(
        `TELEGRAM | Reminder message sent successfully to chatId: ${chatId}, reminderId: ${reminderId}, messageId: ${messageId}`
      );

      return messageId;
    } catch (error: any) {
      Logger.error(
        `TELEGRAM | Error sending reminder message to ${chatId}:`,
        error
      );

      if (error.message?.includes("chat not found")) {
        throw new Error(
          "Telegram chat not found. Please make sure you have started a conversation with the bot and provided the correct chat ID."
        );
      }

      if (error.message?.includes("bot token")) {
        throw new Error(
          "Telegram bot token is invalid. Please verify your TELEGRAM_BOT_TOKEN environment variable."
        );
      }

      throw new Error(
        `Failed to send Telegram message: ${error.message || "Unknown error"}`
      );
    }
  }

  /**
   * Send a welcome message to a user after they connect their Telegram account.
   * @param chatId - Telegram chat ID
   * @param userId - Habitus user ID
   * @param frontendUrl - Frontend URL for the link back to the app
   * @returns Promise that resolves when message is sent
   * @throws Error if message sending fails
   * @public
   */
  async sendWelcomeMessage(
    chatId: string,
    userId: number,
    frontendUrl: string
  ): Promise<void> {
    Logger.info(`TELEGRAM | Preparing to send welcome message to chatId: ${chatId}, userId: ${userId}`);

    if (!this.config.botToken) {
      throw new Error(
        "Telegram bot token not configured. Please set TELEGRAM_BOT_TOKEN environment variable."
      );
    }

    if (!chatId) {
      throw new Error("Telegram chat ID is required");
    }

    const messageText = `🎉 *Welcome to 🌱 Habitus!*\n\nYour Telegram account has been successfully connected, so you will now receive reminders via Telegram.\n\n[Go to 🌱 Habitus Dashboard](${frontendUrl})`;

    try {
      const url = `${this.apiBaseUrl}${this.config.botToken}/sendMessage`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: messageText,
          parse_mode: "Markdown",
        }),
      });

      if (!response.ok) {
        const errorData = (await response
          .json()
          .catch(() => ({}))) as TelegramErrorResponse;
        const errorMessage =
          errorData.description ||
          `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(`Telegram API error: ${errorMessage}`);
      }

      const result = (await response.json()) as TelegramSuccessResponse;
      if (!result.ok) {
        throw new Error(
          `Telegram API error: ${result.description || "Unknown error"}`
        );
      }

      Logger.info(
        `TELEGRAM | Welcome message sent successfully to chatId: ${chatId}, userId: ${userId}, messageId: ${result.result?.message_id}`
      );
    } catch (error: any) {
      Logger.error(
        `TELEGRAM | Error sending welcome message to ${chatId}:`,
        error
      );

      if (error.message?.includes("chat not found")) {
        throw new Error(
          "Telegram chat not found. Please make sure you have started a conversation with the bot."
        );
      }

      if (error.message?.includes("bot token")) {
        throw new Error(
          "Telegram bot token is invalid. Please verify your TELEGRAM_BOT_TOKEN environment variable."
        );
      }

      throw new Error(
        `Failed to send Telegram welcome message: ${error.message || "Unknown error"
        }`
      );
    }
  }

  /**
   * Get chat information from Telegram API.
   * @param chatId - Telegram chat ID
   * @returns Promise resolving to chat information including username
   * @throws Error if chat info retrieval fails
   * @public
   */
  async getChatInfo(
    chatId: string
  ): Promise<{ username?: string; first_name?: string }> {
    if (!this.config.botToken) {
      throw new Error(
        "Telegram bot token not configured. Please set TELEGRAM_BOT_TOKEN environment variable."
      );
    }

    if (!chatId) {
      throw new Error("Telegram chat ID is required");
    }

    try {
      const url = `${this.apiBaseUrl}${this.config.botToken}/getChat`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
        }),
      });

      if (!response.ok) {
        const errorData = (await response
          .json()
          .catch(() => ({}))) as TelegramErrorResponse;
        const errorMessage =
          errorData.description ||
          `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(`Telegram API error: ${errorMessage}`);
      }

      const result = (await response.json()) as {
        ok: boolean;
        result?: {
          username?: string;
          first_name?: string;
          [key: string]: unknown;
        };
        description?: string;
      };

      if (!result.ok) {
        throw new Error(
          `Telegram API error: ${result.description || "Unknown error"}`
        );
      }

      return {
        username: result.result?.username,
        first_name: result.result?.first_name,
      };
    } catch (error: any) {
      Logger.error(
        `TELEGRAM | Error getting chat info for ${chatId}:`,
        error
      );

      if (error.message?.includes("chat not found")) {
        throw new Error(
          "Telegram chat not found. Please make sure you have started a conversation with the bot."
        );
      }

      if (error.message?.includes("bot token")) {
        throw new Error(
          "Telegram bot token is invalid. Please verify your TELEGRAM_BOT_TOKEN environment variable."
        );
      }

      throw new Error(
        `Failed to get Telegram chat info: ${error.message || "Unknown error"}`
      );
    }
  }

  /**
   * Escape Markdown special characters to prevent formatting issues.
   * @param text - Text to escape
   * @returns Escaped text
   * @private
   */
  private escapeMarkdown(text: string): string {
    return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
  }

  /**
   * Send postpone options inline keyboard.
   * @param chatId - Telegram chat ID
   * @param reminderId - Reminder ID
   * @param messageId - Message ID to edit
   * @returns Promise that resolves when message is sent
   * @throws Error if message sending fails
   * @public
   */
  async sendPostponeOptionsMessage(
    chatId: string,
    reminderId: number,
    messageId: number
  ): Promise<void> {
    if (!this.config.botToken) {
      throw new Error(
        "Telegram bot token not configured. Please set TELEGRAM_BOT_TOKEN environment variable."
      );
    }

    const inlineKeyboard = {
      inline_keyboard: [
        [
          {
            text: "5 min",
            callback_data: `postpone_${reminderId}_5`,
          },
          {
            text: "15 min",
            callback_data: `postpone_${reminderId}_15`,
          },
          {
            text: "30 min",
            callback_data: `postpone_${reminderId}_30`,
          },
        ],
        [
          {
            text: "1 hour",
            callback_data: `postpone_${reminderId}_60`,
          },
          {
            text: "3 hours",
            callback_data: `postpone_${reminderId}_180`,
          },
        ],
        [
          {
            text: "1 day",
            callback_data: `postpone_${reminderId}_1440`,
          },
          {
            text: "7 days",
            callback_data: `postpone_${reminderId}_10080`,
          },
        ],
      ],
    };

    try {
      const url = `${this.apiBaseUrl}${this.config.botToken}/editMessageReplyMarkup`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          reply_markup: inlineKeyboard,
        }),
      });

      if (!response.ok) {
        const errorData = (await response
          .json()
          .catch(() => ({}))) as TelegramErrorResponse;
        const errorMessage =
          errorData.description ||
          `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(`Telegram API error: ${errorMessage}`);
      }

      Logger.info(
        `TELEGRAM | Postpone options sent to chatId: ${chatId}, reminderId: ${reminderId}`
      );
    } catch (error: any) {
      Logger.error(
        `TELEGRAM | Error sending postpone options to ${chatId}:`,
        error
      );
      throw new Error(
        `Failed to send postpone options: ${error.message || "Unknown error"}`
      );
    }
  }

  /**
   * Send note prompt message.
   * @param chatId - Telegram chat ID
   * @returns Promise that resolves when message is sent
   * @throws Error if message sending fails
   * @public
   */
  async sendNotePromptMessage(chatId: string): Promise<void> {
    if (!this.config.botToken) {
      throw new Error(
        "Telegram bot token not configured. Please set TELEGRAM_BOT_TOKEN environment variable."
      );
    }

    const messageText = "📝 Please send your note as a text message.";

    try {
      const url = `${this.apiBaseUrl}${this.config.botToken}/sendMessage`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: messageText,
        }),
      });

      if (!response.ok) {
        const errorData = (await response
          .json()
          .catch(() => ({}))) as TelegramErrorResponse;
        const errorMessage =
          errorData.description ||
          `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(`Telegram API error: ${errorMessage}`);
      }

      Logger.info(`TELEGRAM | Note prompt sent to chatId: ${chatId}`);
    } catch (error: any) {
      Logger.error(`TELEGRAM | Error sending note prompt to ${chatId}:`, error);
      throw new Error(
        `Failed to send note prompt: ${error.message || "Unknown error"}`
      );
    }
  }

  /**
   * Send confirmation message.
   * @param chatId - Telegram chat ID
   * @param action - Action type (complete, dismiss, postpone, addnote)
   * @param details - Optional details (e.g., postpone duration)
   * @returns Promise that resolves when message is sent
   * @throws Error if message sending fails
   * @public
   */
  async sendConfirmationMessage(
    chatId: string,
    action: "complete" | "dismiss" | "postpone" | "addnote",
    details?: string
  ): Promise<void> {
    if (!this.config.botToken) {
      throw new Error(
        "Telegram bot token not configured. Please set TELEGRAM_BOT_TOKEN environment variable."
      );
    }

    let messageText = "";
    switch (action) {
      case "complete":
        messageText = "✅ Reminder marked as completed!";
        break;
      case "dismiss":
        messageText = "🚫 Reminder dismissed!";
        break;
      case "postpone":
        messageText = `⏰ Reminder postponed${details ? ` for ${details}` : ""}!`;
        break;
      case "addnote":
        messageText = "📝 Note added successfully!";
        break;
    }

    try {
      const url = `${this.apiBaseUrl}${this.config.botToken}/sendMessage`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: messageText,
        }),
      });

      if (!response.ok) {
        const errorData = (await response
          .json()
          .catch(() => ({}))) as TelegramErrorResponse;
        const errorMessage =
          errorData.description ||
          `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(`Telegram API error: ${errorMessage}`);
      }

      Logger.info(
        `TELEGRAM | Confirmation message sent to chatId: ${chatId}, action: ${action}`
      );
    } catch (error: any) {
      Logger.error(
        `TELEGRAM | Error sending confirmation to ${chatId}:`,
        error
      );
      throw new Error(
        `Failed to send confirmation: ${error.message || "Unknown error"}`
      );
    }
  }

  /**
   * Remove inline keyboard from a message.
   * @param chatId - Telegram chat ID
   * @param messageId - Message ID
   * @returns Promise that resolves when keyboard is removed
   * @throws Error if operation fails
   * @public
   */
  async editMessageReplyMarkup(
    chatId: string,
    messageId: number
  ): Promise<void> {
    if (!this.config.botToken) {
      throw new Error(
        "Telegram bot token not configured. Please set TELEGRAM_BOT_TOKEN environment variable."
      );
    }

    try {
      const url = `${this.apiBaseUrl}${this.config.botToken}/editMessageReplyMarkup`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          reply_markup: { inline_keyboard: [] },
        }),
      });

      if (!response.ok) {
        const errorData = (await response
          .json()
          .catch(() => ({}))) as TelegramErrorResponse;
        const errorMessage =
          errorData.description ||
          `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(`Telegram API error: ${errorMessage}`);
      }

      Logger.info(
        `TELEGRAM | Removed inline keyboard from message ${messageId} in chat ${chatId}`
      );
    } catch (error: any) {
      Logger.error(
        `TELEGRAM | Error removing inline keyboard from message ${messageId}:`,
        error
      );
      throw new Error(
        `Failed to remove inline keyboard: ${error.message || "Unknown error"}`
      );
    }
  }
}
