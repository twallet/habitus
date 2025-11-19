class Request {

  static get(messageId) {
    log.add([`${this.name}.${Utils.method(this.get)}`, messageId], 2, DEBUG_START);
    const gotRequest = db.getRequest(messageId);
    log.add([`${this.name}.${Utils.method(this.get)}`, gotRequest], 2, DEBUG_RETURN);
    return gotRequest;
  }

  constructor(timestamp, messageId, response) {
    log.add([`new ${this.constructor.name}(timestamp, messageId, response)`, timestamp, messageId, response], 2, DEBUG_NEW);
    this.timestamp = timestamp;
    this.user = user;
    this.tracking = tracking;
    this.messageId = messageId;
    this.response = response;
    this.toDelete = false;
    log.add([`new ${this.constructor.name}(timestamp, messageId, response)`, this.timestamp, this.use, this.tracking, this.messageId, this.response], 2, DEBUG_RETURN);
  }

  setResponse(value) {
    log.add([`${this.constructor.name}.${Utils.method(this.setResponse)}`, value], 2, DEBUG_START);
    if (tracking.type == I18N.get('types')[1]) {
      if (!Utils.isValidFloat(value)) {
        Telegram.editMessage(this.messageId, `${value}\n⚠️ ${I18N.get('tresholdWrong')}\n\n<i>${tracking.question}</i>\n${I18N.get('reply')}`,
          tracking.requestInlineKeyboard()
        );
        log.add([`${this.constructor.name}.${Utils.method(this.setResponse)}`], 2, DEBUG_END);
        return;
      }
    }
    this.response = (tracking.type == I18N.get('types')[0]) ? ((value == I18N.get('booleanResponses')[0]) ? YES_V : NO_V) : value;
    const allResponses = tracking.getAllResponses({ messageId: this.messageId, value: this.response });
    const currentStreak = tracking.getCurrentStreak(allResponses);
    const maxStreak = tracking.getMaxStreak(allResponses);
    const lastValues = tracking.getLastValues(allResponses);
    Telegram.editMessage(this.messageId, `<i>${tracking.question}</i>\n<b>${value}</b>\n${I18N.get('streak')}: ${lastValues} (🔥${currentStreak} 💪${maxStreak})`);
    log.add(['✔️ Response registered', value], 1);
    log.add([`${this.constructor.name}.${Utils.method(this.setResponse)}`], 2, DEBUG_END);
  }

  snooze(time) {
    log.add([`${this.constructor.name}.${Utils.method(this.snooze)}`, time], 2, DEBUG_START);
    this.toDelete = true;
    this.tracking.snooze(time);
    Telegram.deleteMessage(this.messageId);
    log.add([`${this.constructor.name}.${Utils.method(this.snooze)}`], 2, DEBUG_END);
  }

  snoozeKeyboard() {
    log.add([`${this.constructor.name}.${Utils.method(this.snoozeKeyboard)}`], 2, DEBUG_START);
    const snoozeCallbacks = SNOOZE_OPTIONS.map(value => `${BOT_ID}_${RESPONSE_KEY}_${SNOOZED_KEY}_${value}`);
    const snoozeKeyboard = Telegram.inlineKeyboard(I18N.get('snoozeOptionsTexts'), { groupSize: SNOOZE_OPTIONS.length, callbacks: snoozeCallbacks });
    log.add([`${this.constructor.name}.${Utils.method(this.snoozeKeyboard)}`, snoozeKeyboard], 2, DEBUG_RETURN);
    return snoozeKeyboard;
  }
}
