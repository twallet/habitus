#!/usr/bin/env node

/**
 * Script to send a test message via Telegram Bot API.
 * Usage: npm run send-telegram-message [message]
 * Or: tsx backend/scripts/send-telegram-message.ts [message]
 */

const TELEGRAM_BOT_TOKEN = "8446582128:AAEenBpKCwJ5g4ojI9hCngFZzzBZuFi1juw";
const CHAT_ID = "86754393";
const API_BASE_URL = "https://api.telegram.org/bot";

/**
 * Send a message via Telegram Bot API.
 * @param message - Message text to send
 * @returns Promise resolving when message is sent
 */
async function sendTelegramMessage(message: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set");
  }

  if (!CHAT_ID) {
    throw new Error("CHAT_ID is not set");
  }

  const url = `${API_BASE_URL}${TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: "Markdown",
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
      `✅ Message sent successfully! Message ID: ${result.result?.message_id}`
    );
  } catch (error: any) {
    console.error("❌ Error sending message:", error.message);

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

// Get message from command line arguments or use default
const message =
  process.argv[2] ||
  "Hola! Este es un mensaje de prueba desde el bot de Habitus 🤖";

// Run the script
sendTelegramMessage(message)
  .then(() => {
    console.log("\n✨ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Fatal error:", error);
    process.exit(1);
  });
