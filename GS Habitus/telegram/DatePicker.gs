const DP = 'dp', YEAR_DP = 'Year', MONTH_DP = 'Month', DAY_DP = 'Day', NULL_DP = 'Null', SAVE_DP = 'Save', LESS_DP = '◀️', MORE_DP = '▶️';
class DatePicker {

  static inlineKeyboard(date, key, options) {  /** options = { cancel[Boolean], back[Boolean], never[Boolean] })*/
    log.add([`${this.name}.${Utils.method(this.inlineKeyboard)}`, date, key, options], 3, DEBUG_START);
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = (new Date(year, month + 1, 1) - new Date(year, month, 1)) / (1000 * 60 * 60 * 24);
    const inlineKeyboard = [];
    inlineKeyboard.push([
      { text: LESS_DP, callback_data: `${BOT_ID}_${DP}_${YEAR_DP}_${LESS_DP}_${year}_${key}` },
      { text: year, callback_data: `${BOT_ID}_${DP}_${NULL_DP}_${key}` },
      { text: MORE_DP, callback_data: `${BOT_ID}_${DP}_${YEAR_DP}_${MORE_DP}_${year}_${key}` }
    ]);
    inlineKeyboard.push([
      { text: LESS_DP, callback_data: `${BOT_ID}_${DP}_${MONTH_DP}_${LESS_DP}_${year}_${month}_${key}` },
      { text: I18N.get('months')[month], callback_data: `${BOT_ID}_${DP}_${NULL_DP}_${key}` },
      { text: MORE_DP, callback_data: `${BOT_ID}_${DP}_${MONTH_DP}_${MORE_DP}_${year}_${month}_${key}` }
    ]);
    inlineKeyboard.push(I18N.get('weekdays').map(function (day) { return { text: day, callback_data: `${BOT_ID}_${DP}_${NULL_DP}_${key}` }; }));
    var row = [];
    for (let i = 0; i < new Date(year, month, 1).getDay(); i++) {
      row.push({ text: '.', callback_data: `${BOT_ID}_${DP}_${NULL_DP}_${key}` });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      row.push({ text: `${(d === date.getDate()) ? '✅ ' : ''}${d}`, callback_data: `${BOT_ID}_${DP}_${DAY_DP}_${d}_${key}` });
      var currentDate = new Date(year, month, d);
      if (currentDate.getDay() === I18N.get('weekdays').length - 1) {
        inlineKeyboard.push(row);
        row = [];
      }
    }
    for (let j = new Date(year, month, daysInMonth).getDay(); j < I18N.get('weekdays').length - 1; j++) {
      row.push({ text: '.', callback_data: `${BOT_ID}_${DP}_${NULL_DP}_${key}` });
    }
    inlineKeyboard.push(row);
    const endRow = [];
    if (options.back) {
      endRow.push({ text: I18N.get('back'), callback_data: `${BOT_ID}_${BACK_KEY}` });
    }
    if (options.never) {
      endRow.push({ text: `${NEVER_V} ${I18N.get('never')}`, callback_data: `${BOT_ID}_${DP}_${NEVER_V}_${key}` });
    }
    endRow.push({ text: I18N.get('save'), callback_data: `${BOT_ID}_${DP}_${SAVE_DP}_${key}` });
    if (options.cancel) {
      endRow.push({ text: I18N.get('cancel'), callback_data: `${BOT_ID}_${CANCEL_KEY}` });
    }
    inlineKeyboard.push(endRow);
    log.add([`${this.name}.${Utils.method(this.inlineKeyboard)}`, inlineKeyboard], 3, DEBUG_RETURN);
    return inlineKeyboard;
  }

  static handleDatePicker(contents) {
    log.add([`${this.name}.${Utils.method(this.handleDatePicker)}`, contents], 3, DEBUG_START);
    const callbackData = contents.callback_query.data;
    log.add(['📆 Date Picker', callbackData], 1);
    const oldDate = DatePicker.getSelectedDate(contents.callback_query.message.reply_markup.inline_keyboard);
    const options = DatePicker.getOptions(contents.callback_query.message.reply_markup.inline_keyboard);
    var newDate = new Date(oldDate);
    const callbackParts = callbackData.split('_');
    const key = callbackParts[callbackParts.length - 1];
    if (callbackData.startsWith(`${BOT_ID}_${DP}_${YEAR_DP}_${LESS_DP}`)) {
      newDate.setFullYear(newDate.getFullYear() - 1);
    }

    if (callbackData.startsWith(`${BOT_ID}_${DP}_${YEAR_DP}_${MORE_DP}`)) {
      newDate.setFullYear(newDate.getFullYear() + 1);
    }
    if (callbackData.startsWith(`${BOT_ID}_${DP}_${MONTH_DP}_${LESS_DP}`)) {
      newDate.setMonth(newDate.getMonth() - 1);
    }

    if (callbackData.startsWith(`${BOT_ID}_${DP}_${MONTH_DP}_${MORE_DP}`)) {
      newDate.setMonth(newDate.getMonth() + 1);
    }

    if (callbackData.startsWith(`${BOT_ID}_${DP}_${DAY_DP}`)) {
      newDate.setDate(parseInt(callbackData.split('_')[3]));
    }

    if (!callbackData.startsWith(`${BOT_ID}_${DP}_${NULL_DP}`) && (newDate.getTime() !== oldDate.getTime())) {
      Telegram.editMessage(contents.callback_query.message.message_id,
        user.getDatePickerMessage(key),
        DatePicker.inlineKeyboard(newDate, key, options)
      );
    }

    if (callbackData.startsWith(`${BOT_ID}_${DP}_${NEVER_V}`)) {
      user.dispatchDatePickerEnd(NEVER_V, key);
    }

    if (callbackData.startsWith(`${BOT_ID}_${DP}_${SAVE_DP}`)) {
      user.dispatchDatePickerEnd(newDate, key);
    }
    log.add([`${this.name}.${Utils.method(this.handleDatePicker)}`], 3, DEBUG_END);
  }

  static getSelectedDate(inlineKeyboard) {
    log.add([`${this.name}.${Utils.method(this.getSelectedDate)}`, inlineKeyboard], 3, DEBUG_START);
    let year, month, day;
    for (let row of inlineKeyboard) {
      for (let btn of row) {
        if (btn.callback_data) {
          if (btn.callback_data.startsWith(`${BOT_ID}_${DP}_${YEAR_DP}_${LESS_DP}`)) {
            year = parseInt(btn.callback_data.split('_')[4]);
          }
          if (btn.callback_data.startsWith(`${BOT_ID}_${DP}_${MONTH_DP}_${LESS_DP}`)) {
            month = parseInt(btn.callback_data.split('_')[5]);
          }
          if (btn.text.startsWith('✅')) {
            day = parseInt(btn.text.replace('✅', '').trim());
          }
        }
      }
    }
    log.add([`${this.name}.${Utils.method(this.getSelectedDate)}`, new Date(year, month, day)], 3, DEBUG_RETURN);
    return new Date(year, month, day);
  }

  static getOptions(inlineKeyboard) {
    log.add([`${this.name}.${Utils.method(this.getOptions)}`, inlineKeyboard], 3, DEBUG_START);
    const options = {
      cancel: false,
      back: false,
      never: false
    };
    const lastRow = inlineKeyboard[inlineKeyboard.length - 1];
    if (lastRow) {
      for (const button of lastRow) {
        if (button.callback_data === `${BOT_ID}_${BACK_KEY}`) {
          options.back = true;
        } else if (button.callback_data.includes(`${BOT_ID}_${DP}_${NEVER_V}`)) {
          options.never = true;
        } else if (button.callback_data === `${BOT_ID}_${CANCEL_KEY}`) {
          options.cancel = true;
        }
      }
      log.add([`${this.name}.${Utils.method(this.getOptions)}`, options], 3, DEBUG_RETURN);
      return options;
    }
  }
}
