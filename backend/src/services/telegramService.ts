import { ServerConfig } from "../setup/constants.js";
import { DateUtils } from "@habitus/shared/utils";

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
      frontendUrl:
        config?.frontendUrl ||
        `${ServerConfig.getServerUrl()}:${ServerConfig.getPort()}`,
    };
  }

  /**
   * Send a reminder message via Telegram.
   * @param chatId - Telegram chat ID
   * @param reminderId - Reminder ID
   * @param trackingQuestion - Tracking question text
   * @param scheduledTime - Scheduled time for the reminder
   * @param trackingIcon - Tracking icon (emoji)
   * @param trackingNotes - Optional tracking notes
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
    trackingNotes?: string,
    notes?: string,
    locale?: string,
    timezone?: string
  ): Promise<void> {
    console.log(
      `[${new Date().toISOString()}] TELEGRAM | Preparing to send reminder message to chatId: ${chatId}, reminderId: ${reminderId}`
    );

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
      locale || "en-US",
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
    const baseUrl = `${dashboardUrl}?reminderId=${reminderId}`;

    // Build message text
    let messageText = `🌱 *Reminder*\n\n`;
    messageText += `${icon} *${this.escapeMarkdown(trackingQuestion)}*\n\n`;
    messageText += `📅 Scheduled for: ${formattedTime}\n`;

    if (trackingNotes) {
      messageText += `\n📋 Tracking notes:\n${this.escapeMarkdown(
        trackingNotes
      )}\n`;
    }

    if (notes) {
      messageText += `\n📝 Reminder notes:\n${this.escapeMarkdown(notes)}\n`;
    }

    messageText += `\n[View Dashboard](${dashboardUrl})`;

    // Build inline keyboard with action buttons
    const inlineKeyboard = {
      inline_keyboard: [
        [
          {
            text: "📝 Add Notes",
            url: `${baseUrl}&action=editNotes`,
          },
          {
            text: "✓ Complete",
            url: `${baseUrl}&action=complete`,
          },
        ],
        [
          {
            text: "✕ Dismiss",
            url: `${baseUrl}&action=dismiss`,
          },
          {
            text: "💤 Snooze",
            url: `${baseUrl}&action=snooze`,
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

      console.log(
        `[${new Date().toISOString()}] TELEGRAM | Reminder message sent successfully to chatId: ${chatId}, reminderId: ${reminderId}, messageId: ${
          result.result?.message_id
        }`
      );
    } catch (error: any) {
      console.error(
        `[${new Date().toISOString()}] TELEGRAM | Error sending reminder message to ${chatId}:`,
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
   * Escape Markdown special characters to prevent formatting issues.
   * @param text - Text to escape
   * @returns Escaped text
   * @private
   */
  private escapeMarkdown(text: string): string {
    return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
  }
}
