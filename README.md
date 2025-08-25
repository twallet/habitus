# Habitus
Bot de Telegram para diseñar y seguir hábitos, metas y registros con recordatorios e informes para monitorear progresos.
Habitus Bot is a Telegram bot built with Google Apps Script that helps you track your habits and other activities.

## Características

*   **Create new trackings:** Set up new habits you want to monitor.
*   **Edit existing trackings:** Modify the properties of your trackings.
*   **Track your progress:** Get reports on your performance.
*   **Interactive conversations:** The bot guides you through the process with interactive keyboards.

## How it works

The bot is built using Google Apps Script and uses a Google Sheet as its database. All the logic is contained in `.gs` files.

*   `main.gs`: The main entry point for the bot, handling all incoming messages from Telegram.
*   `DB.gs`: Handles all database operations with the Google Sheet.
*   `Telegram.gs`: A wrapper for the Telegram Bot API.
*   `Config*.gs`: Manages the conversation flow for different commands.
*   `User.gs`, `Tracking.gs`, `Request.gs`: Data model classes.

## Setup

To run your own instance of this bot, you will need to:

1.  **Create a new Google Apps Script project.**
2.  **Copy all the `.gs` files from this repository into your project.**
3.  **Create a new Google Sheet.** This will be your database.
4.  **Get the ID of your Google Sheet** and update the `HABITUS_ID` constant in `DB.gs`.
5.  **Create a new Telegram Bot** using the [BotFather](https://t.me/botfather) and get your bot token.
6.  **Update the `BOT_TOKEN` constant in `Constants.gs`** with your token.
7.  **Deploy your script as a web app.**
8.  **Set the webhook for your Telegram bot** to the URL of your deployed web app. You can do this by calling the `setWebhook` function in `main.gs` once.
