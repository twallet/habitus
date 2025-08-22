class User {

  static isNew(userId) {
    log.add([`${this.name}.${Utils.method(this.isNew)}`, userId], 2, DEBUG_START);
    const userExists = db.userExists(userId);
    log.add([`${this.name}.${Utils.method(this.isNew)}`, userExists], 2, DEBUG_RETURN);
    return !userExists;
  }

  static get(userId) {
    log.add([`${this.name}.${Utils.method(this.get)}`, userId], 2, DEBUG_START);
    const gotUser = db.getUser(userId);
    log.add([`${this.name}.${Utils.method(this.get)}`, gotUser], 2, DEBUG_RETURN);
    return gotUser;
  }

  static create(contents) {
    log.add([`${this.name}.${Utils.method(this.create)}`, contents], 2, DEBUG_START);
    let id, name, langCode;
    if (contents.callback_query && contents.callback_query.from) {
      id = contents.callback_query.from.id
      name = contents.callback_query.from.username || 'no_name';
      langCode = contents.callback_query.from.language_code;
    } else if (contents.message && contents.message.from) {
      id = contents.message.from.id;
      name = contents.message.from.username || 'no_name';
      langCode = contents.message.from.language_code;
    }
    const newUser = new User(id, name, I18N.supportedLanguage(langCode, id, name), '');
    log.add(['➕ User created', newUser.id, newUser.name, newUser.lang], 1);
    log.add([`${this.name}.${Utils.method(this.create)}`, newUser.id, newUser.name, newUser.lang], 2, DEBUG_RETURN);
    return newUser;
  }

  constructor(userId, name, lang, command) {
    log.add([`new ${this.constructor.name}(userId, name, lang, command)`, userId, name, lang, command], 2, DEBUG_NEW);
    this.id = userId;
    this.name = name;
    this.lang = lang;
    this.command = command;
    log.add([`new ${this.constructor.name}(userId, name, lang, command)`, this.id, this.name, this.lang, this.command], 2, DEBUG_RETURN);
  }

  setCommand(command) {
    log.add([`${this.constructor.name}.${Utils.method(this.setCommand)}`, command], 2, DEBUG_START);
    this.command = command;
    log.add([`${this.constructor.name}.${Utils.method(this.setCommand)}`], 2, DEBUG_END);
  }

  cancel() {
    log.add([`${this.constructor.name}.${Utils.method(this.cancel)}`], 2, DEBUG_START);
    config = new ConfigEdit(user, '', '', '');
    this.command = '';
    log.add([`${this.constructor.name}.${Utils.method(this.cancel)}`], 2, DEBUG_END);
  }

  getTrackings(options){
    log.add([`${this.constructor.name}.${Utils.method(this.getTrackings)}`, options], 2, DEBUG_START);
    const trackings = db.getTrackings(this, options);
    log.add([`${this.constructor.name}.${Utils.method(this.getTrackings)}`, trackings], 2, DEBUG_END);
    return trackings;
  }

  listActiveTrackings() {
    log.add([`${this.constructor.name}.${Utils.method(this.listActiveTrackings)}`], 2, DEBUG_START);
    const activeTrackingsList = db.listActiveTrackings(this);
    log.add([`${this.constructor.name}.${Utils.method(this.listActiveTrackings)}`, activeTrackingsList], 2, DEBUG_END);
    return activeTrackingsList;
  }

  listArchivedTrackings() {
    log.add([`${this.constructor.name}.${Utils.method(this.listArchivedTrackings)}`], 2, DEBUG_START);
    const archivedTrackingsList = db.listArchivedTrackings(this);
    log.add([`${this.constructor.name}.${Utils.method(this.listArchivedTrackings)}`, archivedTrackingsList], 2, DEBUG_END);
    return archivedTrackingsList;
  }

  dispatchDatePickerEnd(date, key) {
    log.add([`${this.constructor.name}.${Utils.method(this.dispatchDatePickerEnd)}`, date, key], 2, DEBUG_START);
    config = CONFIG_MAP[this.command].get();
    switch (key) {
      case (NEW_MONITOR_START):
        config.stepMonitorStart(date);
        break;
      case (NEW_MONITOR_END):
        config.stepMonitorEnd(date);
        break;
      case (EDIT_START):
        config.stepStartEdited(date);
        break;
      case (EDIT_END):
        config.stepEndEdited(date);
        break;
      case (PERIOD_START_KEY):
        config.stepCustomStartEdited(date);
        break;
      case (PERIOD_END_KEY):
        if (date < config.reportStart) {
          const newDate = new Date(config.reportStart);
          newDate.setMonth(newDate.getMonth() + 1);
          log.add(['⚠️ Not valid period', config.reportStart, date, newDate], 1);
          const text = `⚠️ <b>${I18N.get('startAfterEnd')}: </b>${Utils.formatDate(date)}\n\n${config.print()}\n\n<i>${I18N.get('periodEnd')}</i>`;
          const keyboard = DatePicker.inlineKeyboard(newDate, PERIOD_END_KEY, { cancel: true, back: true })
          config.messageId = Telegram.editMessage(config.messageId, text, keyboard);
        } else {
          config.reportEnd = date;
          config.reportEnd.setHours(23,59,59,999);
          config.stepGenerateReport();
        }
        break;
      default:
        break;
    }
    log.add([`${this.constructor.name}.${Utils.method(this.dispatchDatePickerEnd)}`], 2, DEBUG_END);
  }

  getDatePickerMessage(key) {
    log.add([`${this.constructor.name}.${Utils.method(this.getDatePickerMessage)}`, key], 2, DEBUG_START);
    config = CONFIG_MAP[this.command].get();
    let tracking, message;
    switch (key) {
      case (NEW_MONITOR_START):
        message = `${config.print()}\n\n<i>${I18N.get('startMonitoringDef')}</i>`;
        break;
      case (NEW_MONITOR_END):
        message = `${config.print()}\n\n<i>${I18N.get('endMonitoringDef')}</i>`;
        break;
      case (EDIT_START):
        tracking = Tracking.get(config.trackingId);
        message = `${config.print(tracking)}\n\n<i>${I18N.get('editStart')}</i>`;
        break;
      case (EDIT_END):
        tracking = Tracking.get(config.trackingId);
        message = `${config.print(tracking)}\n\n<i>${I18N.get('editEnd')}</i>`;
        break;
      case (PERIOD_START_KEY):
        message = `${config.print()}\n\n<i>${I18N.get('periodStart')}</i>`
        break;
      case (PERIOD_END_KEY):
        message = `${config.print()}\n\n<i>${I18N.get('periodEnd')}</i>`
        break;
      default:
        break;
    }
    log.add([`${this.constructor.name}.${Utils.method(this.getDatePickerMessage)}`, message], 2, DEBUG_RETURN);
    return message;
  }
}
