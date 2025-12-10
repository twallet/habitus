#!/usr/bin/env node

/**
 * Script to send a test reminder message via Telegram Bot API.
 * Usage: npm run send-telegram-reminder
 * Or: tsx backend/scripts/send-telegram-reminder.ts
 */

const TELEGRAM_BOT_TOKEN = "8446582128:AAEenBpKCwJ5g4ojI9hCngFZzzBZuFi1juw";
const CHAT_ID = "86754393";
const API_BASE_URL = "https://api.telegram.org/bot";
// Use a valid HTTPS URL for testing (Telegram requires HTTPS URLs for inline buttons)
const FRONTEND_URL = "https://habitus.app";

/**
 * Escape Markdown special characters to prevent formatting issues.
 * @param text - Text to escape
 * @returns Escaped text
 */
function escapeMarkdown(text: string): string {
  return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
}

/**
 * Send a reminder message via Telegram Bot API.
 */
async function sendReminderMessage(): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set");
  }

  if (!CHAT_ID) {
    throw new Error("CHAT_ID is not set");
  }

  // Simulate reminder data
  const reminderId = 123;
  const trackingQuestion = "¿Hiciste ejercicio hoy?";
  const scheduledTime = new Date().toISOString();
  const trackingIcon = "💪";
  const trackingNotes = "Recuerda hacer al menos 30 minutos de ejercicio";
  const notes = "Este es un recordatorio de prueba";

  const scheduledDate = new Date(scheduledTime);
  const formattedTime = scheduledDate.toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const icon = trackingIcon || "📝";
  const dashboardUrl = `${FRONTEND_URL}/`;
  const baseUrl = `${dashboardUrl}?reminderId=${reminderId}`;

  // Build message text (same format as TelegramService)
  let messageText = `🌱 *Reminder*\n\n`;
  messageText += `${icon} *${escapeMarkdown(trackingQuestion)}*\n\n`;
  messageText += `📅 Scheduled for: ${formattedTime}\n`;

  if (trackingNotes) {
    messageText += `\n📋 Tracking notes:\n${escapeMarkdown(trackingNotes)}\n`;
  }

  if (notes) {
    messageText += `\n📝 Reminder notes:\n${escapeMarkdown(notes)}\n`;
  }

  messageText += `\n[View Dashboard](${dashboardUrl})`;

  // Build inline keyboard with action buttons (same as TelegramService)
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

  const url = `${API_BASE_URL}${TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    console.log("📤 Sending reminder message...");
    console.log(`   Reminder ID: ${reminderId}`);
    console.log(`   Question: ${trackingQuestion}`);
    console.log(`   Scheduled: ${formattedTime}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: messageText,
        parse_mode: "Markdown",
        reply_markup: inlineKeyboard,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        (errorData as any).description ||
        `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(`Telegram API error: ${errorMessage}`);
    }

    const result = (await response.json()) as {
      ok: boolean;
      result?: { message_id: number };
      description?: string;
    };

    if (!result.ok) {
      throw new Error(
        `Telegram API error: ${result.description || "Unknown error"}`
      );
    }

    console.log(
      `✅ Reminder message sent successfully! Message ID: ${result.result?.message_id}`
    );
  } catch (error: any) {
    console.error("❌ Error sending reminder message:", error.message);

    if (error.message?.includes("chat not found")) {
      console.error(
        "\n💡 Tip: Make sure you have started a conversation with the bot first."
      );
    }

    if (error.message?.includes("bot token")) {
      console.error("\n💡 Tip: Verify that the bot token is correct.");
    }

    process.exit(1);
  }
}

// Run the script
sendReminderMessage()
  .then(() => {
    console.log("\n✨ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Fatal error:", error);
    process.exit(1);
  });
