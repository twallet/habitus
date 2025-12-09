# Telegram Reminders Setup

This document describes how to configure Telegram reminders for Habitus.

## Overview

Habitus supports sending reminders via Telegram in addition to email. Users can configure their notification preferences through the Notifications modal in the application.

## Prerequisites

1. A Telegram Bot Token from BotFather
2. The Telegram chat ID of the user who will receive reminders

## Backend Configuration

### Environment Variables

Add the following environment variable to your `.env` file:

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
```

### Getting a Telegram Bot Token

1. Open Telegram and search for `@BotFather`
2. Start a conversation and send `/newbot`
3. Follow the instructions to create a bot
4. Copy the bot token provided by BotFather
5. Add it to your `.env` file as `TELEGRAM_BOT_TOKEN`

### Getting a Telegram Chat ID

There are several ways to get your Telegram chat ID:

1. **Using @userinfobot**: Send `/start` to `@userinfobot` and it will reply with your chat ID
2. **Using Bot Logs**: After starting a conversation with your bot, check the bot's logs or use the Telegram Bot API
3. **Using a helper bot**: Some bots can help you find your chat ID

The chat ID is typically a numeric string (e.g., `123456789`).

## User Configuration

1. Open the Notifications modal in the Habitus application
2. Select "Telegram" as one of your notification channels
3. Enter your Telegram chat ID in the provided field
4. Save your preferences

## How It Works

- When a reminder becomes pending, the system checks the user's notification preferences
- If Telegram is enabled and a chat ID is configured, a message is sent via the Telegram Bot API
- The message includes:
  - Reminder details (tracking question, scheduled time, notes)
  - Action buttons (Add Notes, Complete, Dismiss, Snooze)
  - Link to the dashboard

## Troubleshooting

### Bot Token Errors

If you see errors about the bot token:

- Verify that `TELEGRAM_BOT_TOKEN` is set correctly in your `.env` file
- Ensure the token hasn't been revoked or regenerated
- Check that the token format is correct (no extra spaces or quotes)

### Chat Not Found Errors

If you see "chat not found" errors:

- Make sure you've started a conversation with your bot first
- Verify that the chat ID is correct
- Ensure the bot hasn't been blocked

### Messages Not Received

If messages aren't being received:

- Check that Telegram notifications are enabled in the user's notification preferences
- Verify the chat ID is correct
- Ensure the bot is still active and hasn't been deleted

## API Reference

The Telegram service uses the Telegram Bot API:

- Base URL: `https://api.telegram.org/bot{token}/`
- Send Message endpoint: `sendMessage`
- Documentation: https://core.telegram.org/bots/api
