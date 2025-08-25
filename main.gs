var log = null, db = null, user = null, request = null, tracking = null, modifiedTrackings = [], requestsAdded = [], config = null;

function sendRequests() {
  try {
    initiate();
    log.add([Utils.method(sendRequests)], 2, DEBUG_START);
    Tracking.pendingTrackings().forEach(function (pendingTracking) {
      pendingTracking.sendRequest();
    });
    log.add([Utils.method(sendRequests)], 2, DEBUG_END);
    close();
    
  } catch (error) {
    close();
    log.add(['⛔ Error', error], 1);
    throw error;
  }
}

function initiate() {
  log = new Log();
  db = new DB();
}

function close() {
  if (user !== null) db.saveUser(user);
  if (request !== null && !request.toDelete) db.saveRequest(request);
  if (request !== null && request.toDelete) db.deleteRequest(request);
  if (tracking !== null) db.saveTracking(tracking);
  if (config !== null) db.saveConfig(config);
  modifiedTrackings.forEach(value => db.saveTracking(value));
  requestsAdded.forEach(value => db.addRequest(value[0], value[1]));
  log.write();
}

function doPost(e) {
  try {
    const contents = JSON.parse(e.postData.contents);
    const userId = (contents.callback_query) ? contents.callback_query.from.id : contents.message.from.id;
    const data = (contents.callback_query) ? contents.callback_query.data : contents.message.text;
    const messageId = (contents.callback_query) ? contents.callback_query.message.message_id : contents.message.message_id;
    const toastId = (contents.callback_query) ? contents.callback_query.id : '';
    initiate(userId);
    log.add(['⤵️ Message received', data, contents], 1);

    /** --------------- FIRST TIME USER --------------- */
    if (User.isNew(userId)) {
      user = User.create(contents);
      Telegram.sendMessage(`🤙 ${I18N.get('help')}\n\n<i>${I18N.get('helpCommands')}</i>`);
      close();
      return;
    } else {
      user = User.get(userId);
    }

    /** --------------- MISC --------------- */

    /** Cancel */
    if (contents.callback_query && data.startsWith(`${BOT_ID}_${CANCEL_KEY}`)) {
      user.cancel();
      Telegram.deleteMessage(messageId);
      log.add(['✖️ All clear'], 1);
      Telegram.sendToast(toastId, I18N.get('canceled'));
      close();
      return;
    }

    /** Back */
    if (contents.callback_query && data.startsWith(`${BOT_ID}_${BACK_KEY}`)) {
      config = CONFIG_MAP[user.command].get();
      config.back();
      close();
      return;
    }

    /** Finish */
    if (contents.callback_query && data.startsWith(`${BOT_ID}_${FINISH_KEY}`)) {
      user.cancel();
      Telegram.deleteMessage(messageId);
      log.add(['✖️ All clear'], 1);
      Telegram.sendToast(toastId, `${I18N.get('finished')}`);
      close();
      return;
    }

    /** Date Picker */
    if (contents.callback_query && data.startsWith(`${BOT_ID}_${DP}`)) {
      DatePicker.handleDatePicker(contents);
      close();
      return;
    }

    /** --------------- REQUEST RESPONSE --------------- */
    if (contents.callback_query && data.startsWith(`${BOT_ID}_${RESPONSE_KEY}`)) {
      const responseType = data.split('_')[2];
      request = Request.get(messageId);

      /** Boolean request response */
      if (responseType == BOOLEAN_KEY) {
        request.setResponse(data.split('_')[3]);
        close();
        return;
      }

      /** Snooze request response */
      if (responseType == SNOOZE_KEY) {
        Telegram.editMessage(request.messageId, `<i>${request.tracking.question}</i>\n\n${I18N.get('snoozeText')}`, request.snoozeKeyboard());
        close();
        return;
      }

      /** Snooze option chosen */
      if (responseType == SNOOZED_KEY) {
        const snoozeOption = data.split('_')[3];
        request.snooze(SNOOZE_TIMES[snoozeOption]);
        Telegram.sendToast(toastId, `${I18N.get('snoozeToast')} ${I18N.get('snoozeOptions')[snoozeOption]}: ${request.tracking.question}`);
        log.add(['💤 Request snoozed', I18N.get('snoozeOptions')[snoozeOption]], 1);
        close();
        return;
      }
    }

    /** Request response through reply */
    if (contents.message && contents.message.reply_to_message) {
      Telegram.deleteMessage(messageId);
      request = Request.get(contents.message.reply_to_message.message_id);
      request.setResponse(data);
      close();
      return;
    }

    /** --------------- 📊 PROGRESS COMMAND --------------- */

    /** Progress command received' */
    if (contents.message && data.startsWith(COMMANDS[2])) {
      config = new ConfigProgress(user, PROGRESS, '', '', '', '', '');
      user.setCommand(COMMANDS[2]);
      config.stepProgress();
      close();
      return;
    }

    if ((contents.message || contents.callback_query) && user.command === COMMANDS[2]) {
      config = ConfigProgress.get();

      /** Archived Trackings option */
      if (contents.callback_query && data.startsWith(`${BOT_ID}_${ARCHIVED_KEY}`)) {
        config.stepArchived();
        close();
        return;
      }

      /** Tracking selected for progress */
      if (contents.callback_query && data.startsWith(`${BOT_ID}_${TRACKING_KEY}`)) {
        config.stepTracking(data.split('_')[2]);
        close();
        return;
      }

      /** Custom period for progress */
      if (contents.callback_query && data.startsWith(`${BOT_ID}_${CUSTOM_KEY}`)) {
        config.stepCustomPeriod();
        close();
        return;
      }

      /** Period selected for progress */
      if (contents.callback_query && data.startsWith(`${BOT_ID}_${PERIOD_KEY}`)) {
        config.stepGenerateReport(data.split('_')[2]);
        close();
        return;
      }
    }

    /** --------------- ✏️ EDIT COMMAND --------------- */

    /** Edit command received */
    if (contents.message && data.startsWith(COMMANDS[1])) {
      config = new ConfigEdit(user, EDIT, '', '', '', '');
      user.setCommand(COMMANDS[1]);
      config.stepEdit();
      close();
      return;
    }

    if ((contents.message || contents.callback_query) && user.command === COMMANDS[1]) {
      config = ConfigEdit.get(user);

      /** Archived Trackings option */
      if (contents.callback_query && data.startsWith(`${BOT_ID}_${ARCHIVED_KEY}`)) {
        config.stepArchived(data.split('_')[2], toastId);
        close();
        return;
      }

      /** Tracking selected for edit */
      if (contents.callback_query && data.startsWith(`${BOT_ID}_${TRACKING_KEY}`)) {
        config.stepTracking(data.split('_')[2]);
        close();
        return;
      }

      /** Restore tracking option for edit */
      if (contents.callback_query && data.startsWith(`${BOT_ID}_${EDIT_RESTORE_KEY}`)) {
        config.stepRestore(data.split('_')[2], toastId);
        close();
        return;
      }

      /** Archive tracking option for edit */
      if (contents.callback_query && data.startsWith(`${BOT_ID}_${EDIT_ARCHIVE_KEY}`)) {
        config.stepArchive(data.split('_')[2], toastId);
        close();
        return;
      }

      /** Tracking question edit */
      if (contents.callback_query && data.startsWith(`${BOT_ID}_${EDIT_QUESTION_KEY}`)) {
        config.stepEditQuestion(data.split('_')[2]);
        close();
        return;
      }

      /** Question edited */
      if (contents.message && config.step === EDIT_QUESTION) {
        Telegram.deleteMessage(messageId);
        config.stepQuestionEdited(data);
        close();
        return;
      }

      /** Tracking treshold edit */
      if (contents.callback_query && data.startsWith(`${BOT_ID}_${EDIT_TRESHOLD_KEY}`)) {
        config.stepEditTreshold(data.split('_')[2]);
        close();
        return;
      }

      /** Treshold edited */
      if (contents.message && config.step === EDIT_TRESHOLD) {
        Telegram.deleteMessage(messageId);
        config.stepTresholdEdited(data);
        close();
        return;
      }

      /** Tracking treshold type edit */
      if (contents.callback_query && data.startsWith(`${BOT_ID}_${EDIT_TRESHOLD_TYPE_KEY}`)) {
        config.stepEditTresholdType(data.split('_')[2]);
        close();
        return;
      }

      /** Treshold type edited */
      if (contents.callback_query && config.step === EDIT_TRESHOLD_TYPE) {
        config.stepTresholdTypeEdited(data);
        close();
        return;
      }

      /** Tracking hour edit */
      if (contents.callback_query && data.startsWith(`${BOT_ID}_${EDIT_HOUR_KEY}`)) {
        config.stepEditHour(data.split('_')[2]);
        close();
        return;
      }

      /** Hour edited */
      if (contents.message && config.step === EDIT_HOUR) {
        Telegram.deleteMessage(messageId);
        config.stepHourEdited(data);
        close();
        return;
      }

      /** Tracking start edit */
      if (contents.callback_query && data.startsWith(`${BOT_ID}_${EDIT_START_KEY}`)) {
        config.stepEditStart(data.split('_')[2]);
        close();
        return;
      }

      /** Tracking end edit */
      if (contents.callback_query && data.startsWith(`${BOT_ID}_${EDIT_END_KEY}`)) {
        config.stepEditEnd(data.split('_')[2]);
        close();
        return;
      }

      /** End edited */
      if (contents.message && config.step === EDIT_END) {
        config.stepEndEdited(data);
        close();
        return;
      }

      /** Tracking frequency edit */
      if (contents.callback_query && data.startsWith(`${BOT_ID}_${EDIT_FREQUENCY_KEY}`)) {
        config.stepEditFrequency(data.split('_')[2]);
        close();
        return;
      }

      /** Frequency edited */
      if (contents.callback_query && config.step === EDIT_FREQUENCY) {
        config.stepFrequencyEdited(data);
        close();
        return;
      }

      /** Tracking DaysMonths edit */
      if (contents.callback_query && data.startsWith(`${BOT_ID}_${EDIT_DAYS_MONTHS_KEY}`)) {
        config.stepEditDaysMonths(data.split('_')[2]);
        close();
        return;
      }

      /** Weekly days edited */
      if (contents.callback_query && config.step === EDIT_WEEKLY_DAYS) {
        config.stepDaysMonthsEdited(data, I18N.get('weekdays'), 7, toastId);
        close();
        return;
      }

      /** Monthly days edited */
      if (config.step === EDIT_MONTHLY_DAYS) {
        config.stepDaysMonthsEdited(data, I18N.get('monthDays'), 4, toastId);
        close();
        return;
      }

      /** Yearly months edited */
      if (config.step === EDIT_YEARLY_MONTHS) {
        config.stepDaysMonthsEdited(data, I18N.get('months'), 4, toastId);
        close();
        return;
      }

    }

    /** --------------- ➕ NEW COMMAND --------------- */

    /** New command received */
    if (contents.message && contents.message.text.startsWith(COMMANDS[0])) {
      config = new ConfigNew(user, NEW, '', '', '', '', '', '', '', '', '', '', '');
      user.setCommand(COMMANDS[0]);
      config.stepNew();
      close();
      return;
    }

    if ((contents.message || contents.callback_query) && user.command === COMMANDS[0]) {
      config = ConfigNew.get(user);
      const data = (contents.callback_query) ? contents.callback_query.data : contents.message.text;
      const messageId = (contents.callback_query) ? contents.callback_query.message.message_id : contents.message.message_id;
      const toastId = (contents.callback_query) ? contents.callback_query.id : '';

      /** Question step */
      if (config.step === NEW_QUESTION) {
        config.stepQuestion(data);
        Telegram.deleteMessage(messageId);
        close();
        return;
      }

      /** Type step */
      if (config.step === NEW_TYPE) {
        config.stepType(data);
        close();
        return;
      }

      /** Treshold step */
      if (config.step === NEW_TRESHOLD) {
        config.stepTreshold(data);
        Telegram.deleteMessage(messageId);
        close();
        return;
      }

      /** Treshold Type step */
      if (config.step === NEW_TRESHOLD_TYPE) {
        config.stepTresholdType(data);
        close();
        return;
      }

      /** Hour step */
      if (config.step === NEW_HOUR) {
        config.stepHour(data);
        Telegram.deleteMessage(messageId);
        close();
        return;
      }

      /** Frequency step */
      if (config.step === NEW_FREQUENCY) {
        config.stepFrequency(data);
        close();
        return;
      }

      /** Monitor Start step */
      if (config.step === NEW_MONITOR_START) {
        Telegram.deleteMessage(messageId);
        config.stepMonitorStart(data);
        close();
        return;
      }

      /** Weekly days step */
      if (config.step === NEW_WEEKLY_DAYS) {
        config.stepDaysMonths(data, I18N.get('weekdays'), 7, toastId);
        close();
        return;
      }

      /** Monthly days step */
      if (config.step === NEW_MONTHLY_DAYS) {
        config.stepDaysMonths(data, I18N.get('monthDays'), 4, toastId);
        close();
        return;
      }

      /** Yearly months step */
      if (config.step === NEW_YEARLY_MONTHS) {
        config.stepDaysMonths(data, I18N.get('months'), 4, toastId);
        close();
        return;
      }

      /** Confirmation step */
      if (config.step === NEW_CONFIRMATION) {
        config.stepConfirmation(data);
        close();
        return;
      }
    }
  } catch (error) {
    close();
    log.add(['⛔ Error', error], 1);
    throw error;
  }
}

function setWebhook() {
  Logger.log(UrlFetchApp.fetch(`${TELEGRAM_URL}/setWebhook?url=${WEBAPP_URL}`));
}
