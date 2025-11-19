class Telegram {

  static sendMessage(text, inlineKeyboard = null) {
    log.add([`${this.name}.${Utils.method(this.sendMessage)}`, text, inlineKeyboard], 3, DEBUG_START);
    Utils.htmlTagsBalanceCheck(text);
    const payload = {
      chat_id: String(user.id),
      text: Utils.truncateString(text, MESSAGE_MAX_SIZE),
      parse_mode: 'HTML',
    };
    if (inlineKeyboard) {
      payload.reply_markup = { inline_keyboard: inlineKeyboard };
    }
    const response = Telegram.apiRequest('sendMessage', payload);
    log.add(['⤴️ Message sent', Utils.truncateString(text, MESSAGE_MAX_SIZE)], 1);
    log.add([`${this.name}.${Utils.method(this.sendMessage)}`, response.result.message_id], 3, DEBUG_RETURN);
    return response.result.message_id;
  }

  static editMessage(messageId, newText, newInlineKeyboard = null) {
    log.add([`${this.name}.${Utils.method(this.editMessage)}`, messageId, newText, newInlineKeyboard], 3, DEBUG_START);
    Utils.htmlTagsBalanceCheck(newText);
    const payload = {
      chat_id: String(user.id),
      message_id: String(messageId),
      text: Utils.truncateString(newText, MESSAGE_MAX_SIZE),
      parse_mode: 'HTML',
    };
    if (newInlineKeyboard) {
      payload.reply_markup = { inline_keyboard: newInlineKeyboard };
    } else {
      payload.reply_markup = { inline_keyboard: [[]] };
    }
    const response = Telegram.apiRequest('editMessageText', payload);
    log.add(['✍️ Message edited', Utils.truncateString(newText, MESSAGE_MAX_SIZE), 1]);
    log.add([`${this.name}.${Utils.method(this.editMessage)}`, response.result.message_id], 3, DEBUG_RETURN);
    return response.result.message_id;
  }

  static deleteMessage(messageId) {
    log.add([`${this.name}.${Utils.method(this.deleteMessage)}`, messageId], 3, DEBUG_START);
    Telegram.apiRequest('deleteMessage', { chat_id: String(user.id), message_id: String(messageId) });
    log.add([`${this.name}.${Utils.method(this.deleteMessage)}`], 3, DEBUG_END);
  }

  static sendToast(callbackQueryId, text) {
    log.add([`${this.name}.${Utils.method(this.sendToast)}`, callbackQueryId, text], 3, DEBUG_START);
    const payload = {
      callback_query_id: callbackQueryId,
      text: Utils.truncateString(text, TOAST_MAX_SIZE),
      show_alert: true
    };
    Telegram.apiRequest('answerCallbackQuery', payload);
    log.add(['🍞 Toast sent', Utils.truncateString(text, TOAST_MAX_SIZE)], 1);
    log.add([`${this.name}.${Utils.method(this.sendToast)}`], 3, DEBUG_END);
  }

  static updateSelection(messageId, allOptions, selectedOptions, options) {
    /** options = {groupsize[Number], back[Boolean], save[Boolean], cancel[Boolean]} */
    log.add([`${this.name}.${Utils.method(this.updateSelection)}`, messageId, allOptions, selectedOptions, options], 3, DEBUG_START);
    const inlineKeyboard = [];
    const groupSize = options.groupSize;
    for (let i = 0; i < allOptions.length; i += groupSize) {
      const row = allOptions.slice(i, i + groupSize).map(option => {
        const isSelected = selectedOptions.map(String).includes(String(option));
        return {
          text: (isSelected ? '✅ ' : '') + option,
          callback_data: option
        };
      });
      inlineKeyboard.push(row);
    }
    if (options.cancel || options.back || options.save) {
      const optionsLine = [];
      (options.back) ? optionsLine.push({ text: I18N.get('back'), callback_data: `${BOT_ID}_${BACK_KEY}` }) : null;
      (options.save) ? optionsLine.push({ text: I18N.get('save'), callback_data: `${BOT_ID}_${SAVE_KEY}` }) : null;
      (options.cancel) ? optionsLine.push({ text: I18N.get('cancel'), callback_data: `${BOT_ID}_${CANCEL_KEY}` }) : null;
      inlineKeyboard.push(optionsLine);
    }
    const payload = {
      chat_id: String(user.id),
      message_id: String(messageId),
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: inlineKeyboard
      }
    };
    Telegram.apiRequest('editMessageReplyMarkup', payload);
    log.add(['♻️ Selection updated', selectedOptions.join(', ')], 1);
    log.add([`${this.name}.${Utils.method(this.updateSelection)}`], 3, DEBUG_END);
  }

  static editMessageWithSelection(messageId, newText, allOptions, selectedOptions, options) {
    log.add([`${this.name}.${Utils.method(this.editMessageWithSelection)}`,  messageId, newText, allOptions, selectedOptions, options], 3, DEBUG_START);
    const inlineKeyboard = [];
    const groupSize = options.groupSize;
    for (let i = 0; i < allOptions.length; i += groupSize) {
      const row = allOptions.slice(i, i + groupSize).map(option => {
        const isSelected = selectedOptions.map(String).includes(String(option));
        return {
          text: (isSelected ? '✅ ' : '') + option,
          callback_data: option
        };
      });
      inlineKeyboard.push(row);
    }
    if (options.cancel || options.back || options.save) {
      const optionsLine = [];
      (options.back) ? optionsLine.push({ text: I18N.get('back'), callback_data: `${BOT_ID}_${BACK_KEY}` }) : null;
      (options.save) ? optionsLine.push({ text: I18N.get('save'), callback_data: `${BOT_ID}_${SAVE_KEY}` }) : null;
      (options.cancel) ? optionsLine.push({ text: I18N.get('cancel'), callback_data: `${BOT_ID}_${CANCEL_KEY}` }) : null;
      inlineKeyboard.push(optionsLine);
    }
    Utils.htmlTagsBalanceCheck(newText);
    const payload = {
      chat_id: String(user.id),
      message_id: String(messageId),
      text: Utils.truncateString(newText, MESSAGE_MAX_SIZE),
      parse_mode: 'HTML',
    };
    payload.reply_markup = { inline_keyboard: inlineKeyboard };
    const response = Telegram.apiRequest('editMessageText', payload);
    log.add(['✍️ Message edited with selection ', Utils.truncateString(newText, MESSAGE_MAX_SIZE)],1);
    log.add([`${this.name}.${Utils.method(this.editMessageWithSelection)}`, response.result.message_id], 3, DEBUG_RETURN);
    return response.result.message_id;
  }

  static apiRequest(method, payload) {
    try {
      const response = UrlFetchApp.fetch(`${TELEGRAM_URL}/`, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({ method: method, ...payload })
      });
      const responseData = JSON.parse(response.getContentText());
      if (!responseData.ok) {
        throw new Error(`[apiRequest(method=${method}, payload)] Error in Telegram API - ${responseData.error_code}: ${responseData.description}`);
      }
      return responseData;
    } catch (error) {
      throw new Error(`[apiRequest(method=${method}, payload)] Could not make request to Telegram: ${error.message}`);
    }
  }

  static inlineKeyboard(values, options) {
    /** options = {cancel[Boolean], back[Boolean], finish[Boolean], groupSize[Integer], callbacks[array], save[Boolean]} */
    log.add([`${this.name}.${Utils.method(this.inlineKeyboard)}`, values, options], 3, DEBUG_START);
    const inlineKeyboard = [];
    const groupSize = (options.groupSize) ? options.groupSize : 1;
    const callbacks = (options.callbacks === null || options.callbacks === undefined) ? values : options.callbacks;
    for (let i = 0; i < values.length; i += groupSize) {
      const row = values.slice(i, i + groupSize).map((value, j) => {
        return {
          text: value,
          callback_data: callbacks[i + j]
        };
      });
      inlineKeyboard.push(row);
    }
    if (options.cancel || options.back || options.save || options.finish) {
      const optionsLine = [];
      (options.back) ? optionsLine.push({ text: I18N.get('back'), callback_data: `${BOT_ID}_${BACK_KEY}` }) : null;
      (options.save) ? optionsLine.push({ text: I18N.get('save'), callback_data: `${BOT_ID}_${SAVE_KEY}` }) : null;
      (options.cancel) ? optionsLine.push({ text: I18N.get('cancel'), callback_data: `${BOT_ID}_${CANCEL_KEY}` }) : null;
      (options.finish) ? optionsLine.push({ text: I18N.get('finish'), callback_data: `${BOT_ID}_${FINISH_KEY}` }) : null;
      inlineKeyboard.push(optionsLine);
    }
    log.add([`${this.name}.${Utils.method(this.inlineKeyboard)}`, inlineKeyboard], 3, DEBUG_RETURN);
    return inlineKeyboard;
  }
}
