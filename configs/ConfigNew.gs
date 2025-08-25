class ConfigNew {

  static get() {
    log.add([`${this.name}.${Utils.method(this.get)}`], 2, DEBUG_START);
    const gotConfig = db.getConfig(user);
    log.add([`${this.name}.${Utils.method(this.get)}`, gotConfig], 2, DEBUG_RETURN);
    return gotConfig;
  }

  constructor(user, step, messageId, question, type, treshold, tresholdType, hour, min, frequency, daysMonths, start, end) {
    log.add([`new ${this.constructor.name}(user, step, messageId, question, type, treshold, tresholdType, hour, min, frequency, daysMonths, start, end)`, user, step, messageId, question, type, treshold, tresholdType, hour, min, frequency, daysMonths, start, end], 2, DEBUG_NEW);
    this.user = user;
    this.step = step;
    this.messageId = messageId;
    this.question = question;
    this.type = type;
    this.treshold = treshold;
    this.tresholdType = tresholdType;
    this.hour = hour;
    this.min = min;
    this.frequency = frequency;
    this.daysMonths = daysMonths;
    this.start = start;
    this.end = end;
    log.add([`new ${this.constructor.name}(user, step, messageId, question, type, treshold, tresholdType, hour, min, frequency, daysMonths, start, end)`, this], 2, DEBUG_RETURN);
  }

  back() {
    log.add([`${this.constructor.name}.${Utils.method(this.back)}`, this.user.command, this.step], 2, DEBUG_START);
    log.add(['⬅️ Back', this.user.command, this.step], 1);
    switch (this.step) {
      case NEW_TYPE:
        Telegram.deleteMessage(this.messageId);
        this.question = '';
        this.messageId = '';
        this.stepNew();
        break;
      case NEW_TRESHOLD:
        this.type = '';
        this.stepQuestion(this.question);
        break;
      case NEW_TRESHOLD_TYPE:
        this.treshold = '';
        this.stepType(this.type);
        break;
      case NEW_HOUR:
        if (this.type === I18N.get('types')[1]) {
          this.tresholdType = '';
          this.stepTreshold(this.treshold);
        } else {
          this.type = '';
          this.stepQuestion(this.question);
        }
        break;
      case NEW_MONITOR_START:
        this.hour = '';
        this.min = '';
        if (this.type === I18N.get('types')[1]) {
          this.stepTresholdType(this.tresholdType);
        } else {
          this.stepType(this.type);
        }
        break;
      case NEW_MONITOR_END:
        this.start = '';
        this.stepHour(`${this.hour}:${this.min}`);
        break;
      case NEW_FREQUENCY:
        this.end = '';
        this.stepMonitorStart(this.start);
        break;
      case NEW_WEEKLY_DAYS:
        this.frequency = '';
        this.stepMonitorEnd(this.end);
        break;
      case NEW_MONTHLY_DAYS:
        this.frequency = '';
        this.stepMonitorEnd(this.end);
        break;
      case NEW_YEARLY_MONTHS:
        this.frequency = '';
        this.stepMonitorEnd(this.end);
        break;
      case NEW_CONFIRMATION:
        this.daysMonths = '';
        if (this.frequency == I18N.get('frequencies')[0]) {
          this.frequency = '';
          this.stepMonitorEnd(this.end);
        } else {
          this.stepFrequency(this.frequency);
        }
        break;
      default:
        break;
    }
    log.add([`${this.constructor.name}.${Utils.method(this.back)}`, this.user.command, this.step], 2, DEBUG_END);
  }

  print(header = null) {
    log.add([`${this.constructor.name}.${Utils.method(this.print)}`], 2, DEBUG_START);
    var print = (header == null) ? `➕ <b>${I18N.get('newHeader')}</b>\n\n` : header;
    print += this.question && `✔️ ${I18N.get('question')}: ${this.question}`;
    if (this.step === NEW_TYPE) { print += `\n👣 ${I18N.get('type')}...`; }
    print += this.type && `\n✔️ ${I18N.get('type')}: ${this.type}`;
    if (this.type && this.type === I18N.get('types')[1]) {
      if (this.step === NEW_TRESHOLD) { print += `\n👣 ${I18N.get('treshold')}...`; }
      print += this.treshold && `\n✔️ ${I18N.get('treshold')}: ${this.treshold}`;
      if (this.step === NEW_TRESHOLD_TYPE) { print += `\n👣 ${I18N.get('tresholdType')}...`; }
      print += this.tresholdType && `\n✔️ ${I18N.get('tresholdType')}: ${this.tresholdType}`;
    }
    print += this.hour && `\n✔️ ${I18N.get('hour')}: ${this.hour.toString().padStart(2, '0')}:${this.min.toString().padStart(2, '0')}`;
    if (this.step === NEW_HOUR) { print += `\n👣 ${I18N.get('hour')}...`; }
    print += this.start && `\n✔️ ${I18N.get('startMonitoring')}: ${Utils.formatDate(this.start)}`;
    if (this.step === NEW_MONITOR_START) { print += `\n👣 ${I18N.get('startMonitoring')}...`; }
    print += this.end && `\n✔️ ${I18N.get('endMonitoring')}: ${(this.end !== NEVER_V) ? Utils.formatDate(this.end) : I18N.get('never')}`;
    if (this.step === NEW_MONITOR_END) { print += `\n👣 ${I18N.get('endMonitoring')}...`; }
    print += this.frequency && `\n✔️ ${I18N.get('frequency')}: ${this.frequency}`;
    if (this.step === NEW_FREQUENCY) { print += `\n👣 ${I18N.get('frequency')}...`; }
    print += this.daysMonths && `\n✔️ ${I18N.get((this.frequency === I18N.get('frequencies')[3]) ? 'monthsLabel' : 'daysLabel')}: ${this.daysMonths}`;
    if (this.step === NEW_WEEKLY_DAYS || this.step === NEW_MONTHLY_DAYS || this.step === NEW_YEARLY_MONTHS) { print += `\n👣 ${I18N.get((this.frequency === I18N.get('frequencies')[3]) ? 'monthsLabel' : 'daysLabel')}...`; }
    log.add([`${this.constructor.name}.${Utils.method(this.print)}`, print], 2, DEBUG_RETURN);
    return print;
  }

  stepNew() {
    log.add([`${this.constructor.name}.${Utils.method(this.stepNew)}`], 2, DEBUG_START);
    log.add(['➕ New tracking definition'], 1);
    this.step = NEW_QUESTION;
    const text = `➕ <b>${I18N.get('newHeader')}</b>\n\n<i>${I18N.get('newIntro')}</i>\n\n👣 ${I18N.get('question')}...\n\n${I18N.get('questionDef')}`;
    this.messageId = Telegram.sendMessage(text, Telegram.inlineKeyboard([], { cancel: true }));
    log.add([`${this.constructor.name}.${Utils.method(this.stepNew)}`], 2, DEBUG_END);
  }

  stepQuestion(question) {
    log.add([`${this.constructor.name}.${Utils.method(this.stepQuestion)}`, question], 2, DEBUG_START);
    if (!Tracking.checkDuplicatedQuestion(question)) {
      this.step = NEW_TYPE;
      this.question = question;
      log.add(['✔️ Question registered', question], 1);
      const text = `${this.print()}\n\n<i>${I18N.get('typeDef')}</i>`;
      this.messageId = Telegram.editMessage(this.messageId, text,
        Telegram.inlineKeyboard(I18N.get('types'), { cancel: true, back: true, groupSize: 3 }));
    } else {
      const warningText = `⚠️ <b>${I18N.get('questionDuplicated')}</b>: ${question}\n\n➕ <b>${I18N.get('newHeader')}</b>\n\n👣 ${I18N.get('question')}...\n\n${I18N.get('questionDef')}`;
      Telegram.editMessage(this.messageId, warningText, Telegram.inlineKeyboard([], { cancel: true })
      );
    }
    log.add([`${this.constructor.name}.${Utils.method(this.stepQuestion)}`], 2, DEBUG_END);
  }

  stepType(type) {
    log.add([`${this.constructor.name}.${Utils.method(this.stepType)}`, type], 2, DEBUG_START);
    this.type = type;
    log.add(['✔️ Type registered', type], 1);
    if (this.type === I18N.get('types')[1]) { /** 6️⃣ Number   */
      this.step = NEW_TRESHOLD;
      this.messageId = Telegram.editMessage(this.messageId, `${this.print()}\n\n${I18N.get('tresholdDef')}`,
        Telegram.inlineKeyboard([], { cancel: true, back: true })
      );
    } else { /** ✔️ Yes/No or 🖊️ Text*/
      this.step = NEW_HOUR;
      this.messageId = Telegram.editMessage(this.messageId, `${this.print()}\n\n${I18N.get('hourDef')}`,
        Telegram.inlineKeyboard([], { cancel: true, back: true })
      );
    }
    log.add([`${this.constructor.name}.${Utils.method(this.stepType)}`], 2, DEBUG_END);
  }

  stepTreshold(data) {
    log.add([`${this.constructor.name}.${Utils.method(this.stepTreshold)}`, data], 2, DEBUG_START);
    if (Utils.isValidFloat(data)) {
      this.step = NEW_TRESHOLD_TYPE;
      this.treshold = data;
      this.messageId = Telegram.editMessage(this.messageId, `${this.print()}\n\n<i>${I18N.get('tresholdTypeDef')}</i>`,
        Telegram.inlineKeyboard(I18N.get('tresholdTypes'), { cancel: true, back: true, groupSize: 2 })
      );
      log.add(['✔️ Treshold registered', data], 1);
    } else {
      this.messageId = Telegram.editMessage(this.messageId,
        `⚠️ <b>${I18N.get('tresholdWrong')}:</b> ${data}\n\n${this.print()}\n\n${I18N.get('tresholdDef')}`,
        Telegram.inlineKeyboard([], { cancel: true, back: true })
      );
      log.add(['⚠️ Not valid treshold', data], 1);
    }
    log.add([`${this.constructor.name}.${Utils.method(this.stepTreshold)}`], 2, DEBUG_END);
  }

  stepTresholdType(tresholdType) {
    log.add([`${this.constructor.name}.${Utils.method(this.stepTresholdType)}`, tresholdType], 2, DEBUG_START);
    log.add(['✔️ Treshold type registered', tresholdType], 1);
    this.step = NEW_HOUR;
    this.tresholdType = tresholdType;
    this.messageId = Telegram.editMessage(this.messageId, `${this.print()}\n\n${I18N.get('hourDef')}`,
      Telegram.inlineKeyboard([], { cancel: true, back: true })
    );
    log.add([`${this.constructor.name}.${Utils.method(this.stepTresholdType)}`], 2, DEBUG_END);
  }

  stepHour(data) {
    log.add([`${this.constructor.name}.${Utils.method(this.stepHour)}`, data], 2, DEBUG_START);
    const hour = Utils.validateHour(data);
    if (hour == -1) {
      this.messageId = Telegram.editMessage(this.messageId,
        `⚠️ <b>${I18N.get('hourWrong')}:</b> ${data}\n\n${this.print()}\n\n${I18N.get('hourDef')}`,
        Telegram.inlineKeyboard([], { cancel: true, back: true })
      );
      log.add(['⚠️ Not valid hour', data], 1);
      log.add([`${this.constructor.name}.${Utils.method(this.stepHour)}`], 2, DEBUG_END);
    } else {
      this.step = NEW_MONITOR_START;
      this.hour = hour.split(':')[0];
      this.min = hour.split(':')[1];
      log.add(['✔️ Hour registered', hour], 1);
      this.messageId = Telegram.editMessage(this.messageId,
        `${this.print()}\n\n<i>${I18N.get('startMonitoringDef')}</i>`,
        DatePicker.inlineKeyboard(new Date(), NEW_MONITOR_START, { cancel: true, back: true })
      );
      log.add([`${this.constructor.name}.${Utils.method(this.stepHour)}`], 2, DEBUG_END);
    }
  }

  stepMonitorStart(date) {
    log.add([`${this.constructor.name}.${Utils.method(this.stepMonitorStart)}`, date], 2, DEBUG_START);
    this.step = NEW_MONITOR_END;
    this.start = new Date(date);
    log.add(['✔️ Monitor start registered', date], 1);
    date.setMonth(date.getMonth() + 1);
    this.messageId = Telegram.editMessage(this.messageId, `${this.print()}\n\n<i>${I18N.get('endMonitoringDef')}</i>`,
      DatePicker.inlineKeyboard(date, NEW_MONITOR_END, { never: true, cancel: true, back: true })
    );
    log.add([`${this.constructor.name}.${Utils.method(this.stepMonitorStart)}`], 2, DEBUG_END);
  }

  stepMonitorEnd(date) {
    log.add([`${this.constructor.name}.${Utils.method(this.stepMonitorEnd)}`, date], 2, DEBUG_START);
    if (date !== NEVER_V && date.getTime() <= this.start.getTime()) {
      const newDate = new Date(this.start);
      newDate.setDate(newDate.getDate() + 30);
      this.messageId = Telegram.editMessage(this.messageId,
        `⚠️ <b>${I18N.get('endMonitoringWrong')}:</b> ${Utils.formatDate(date)}\n\n${this.print()}\n\n<i>${I18N.get('endMonitoringDef')}</i>`,
        DatePicker.inlineKeyboard(newDate, NEW_MONITOR_END, { never: true, cancel: true, back: true })
      );
      log.add(['⚠️ Wrong monitoring period', Utils.formatDate(this.start), Utils.formatDate(date)], 1);
    } else {
      this.end = (date == NEVER_V) ? date : new Date(date);
      this.step = NEW_FREQUENCY;
      log.add(['✔️ Monitor end registered', (date == NEVER_V) ? I18N.get('never') : this.end], 1);
      this.messageId = Telegram.editMessage(this.messageId, `${this.print()}\n\n<i>${I18N.get('frequencyDef')}</i>`,
        Telegram.inlineKeyboard(I18N.get('frequencies'), { cancel: true, back: true, groupSize: 4 })
      );
      log.add([`${this.constructor.name}.${Utils.method(this.stepMonitorEnd)}`], 2, DEBUG_END);
    }
  }

  stepFrequency(data) {
    log.add([`${this.constructor.name}.${Utils.method(this.stepFrequency)}`, data], 2, DEBUG_START);
    this.frequency = data;
    switch (this.frequency) {
      case I18N.get('frequencies')[0]: /** Daily */
        this.step = NEW_CONFIRMATION;
        this.messageId = Telegram.editMessage(this.messageId, `${this.print()}\n\n<i>${I18N.get('confirmationDef')}</i>`,
          Telegram.inlineKeyboard(I18N.get('confirmations'), { back: true, groupSize: 2 })
        );
        break;
      case I18N.get('frequencies')[1]: /** Weekly */
        this.step = NEW_WEEKLY_DAYS;
        this.messageId = Telegram.editMessage(this.messageId,
          `${this.print()}\n\n<i>${I18N.get('weeklyDaysDef')}</i>`,
          Telegram.inlineKeyboard(I18N.get('weekdays'), { cancel: true, back: true, save: true, groupSize: 7 })
        );
        break;
      case I18N.get('frequencies')[2]: /** Monthly */
        this.step = NEW_MONTHLY_DAYS;
        this.messageId = Telegram.editMessage(this.messageId,
          `${this.print()}\n\n<i>${I18N.get('monthlyDaysDef')}</i>`,
          Telegram.inlineKeyboard(I18N.get('monthDays'), { cancel: true, back: true, save: true, groupSize: 4 })
        );
        break;
      case I18N.get('frequencies')[3]: /** Yearly */
        this.step = NEW_YEARLY_MONTHS;
        this.messageId = Telegram.editMessage(this.messageId,
          `${this.print()}\n\n<i>${I18N.get('yearlyMonthsDef')}</i>`,
          Telegram.inlineKeyboard(I18N.get('months'), { cancel: true, back: true, save: true, groupSize: 4 })
        );
        break;
      default:
        break;
    }
    log.add(['✔️ Frequency registered', this.frequency], 1);
    log.add([`${this.constructor.name}.${Utils.method(this.stepFrequency)}`], 2, DEBUG_END);
  }

  stepDaysMonths(selectedOption, allOptions, groupSize, toastId) {
    log.add([`${this.constructor.name}.${Utils.method(this.stepDaysMonths)}`, selectedOption, allOptions, groupSize, toastId], 2, DEBUG_START);
    const daysMonths = this.daysMonths;
    if (selectedOption === `${BOT_ID}_${SAVE_KEY}`) {
      if (daysMonths.length > 0) {
        this.step = NEW_CONFIRMATION;
        this.messageId = Telegram.editMessage(this.messageId,
          `${this.print()}\n\n<i>${I18N.get('confirmationDef')}</i>`,
          Telegram.inlineKeyboard(I18N.get('confirmations'), { back: true, groupSize: 2 })
        );
        log.add(['✔️ Days/Months registered', daysMonths], 1);
      } else {
        Telegram.sendToast(toastId, I18N.get('saveAlert'));
      }
    } else {
      Telegram.updateSelection(this.messageId, allOptions, this.updateDaysMonths(selectedOption), { groupSize: groupSize, cancel: true, save: true, back: true });
    }
    log.add([`${this.constructor.name}.${Utils.method(this.stepDaysMonths)}`], 2, DEBUG_END);
  }

  updateDaysMonths(value) {
    log.add([`${this.constructor.name}.${Utils.method(this.updateDaysMonths)}`, value], 2, DEBUG_START);
    var daysMonths = (this.daysMonths === '') ? [] : this.daysMonths.split(', ')
    const index = daysMonths.map(element => String(element)).indexOf(String(value));
    if (index === -1) {
      daysMonths.push(value);
    } else {
      daysMonths.splice(index, 1);
    }
    switch (this.frequency) {
      case I18N.get('frequencies')[1]: /** Weekly */
        daysMonths = Utils.sort(I18N.get('weekdays'), daysMonths);
        break;
      case I18N.get('frequencies')[2]: /** Monthly */
        daysMonths = Utils.sort(I18N.get('monthDays'), daysMonths);
        break;
      case I18N.get('frequencies')[3]: /** Yearly */
        daysMonths = Utils.sort(I18N.get('months'), daysMonths);
        break;
      default:
        break;
    }
    this.daysMonths = daysMonths.join(', ');
    log.add([`${this.constructor.name}.${Utils.method(this.updateDaysMonths)}`, daysMonths], 2, DEBUG_RETURN);
    return daysMonths;
  }

  stepConfirmation(value) {
    log.add([`${this.constructor.name}.${Utils.method(this.stepConfirmation)}`, value], 2, DEBUG_START);
    if (value === I18N.get('confirmations')[0]) { /** Confirm */
      const newId = Tracking.newId(user);
      tracking = new Tracking(newId, this.question, this.type, this.treshold, this.tresholdType, this.hour, this.min, this.frequency, this.daysMonths, this.start, this.end, '', 0);
      tracking.setNext();
      const nextText = (tracking.next === '') ? '' : `\n✔️ ${I18N.get('nextText')}: ${Utils.formatDateToDDMMYYYYHHMM(tracking.next)}`;
      log.add(['✔️ Tracking created', tracking.question], 1);
      Telegram.editMessage(this.messageId,
        `${this.print(`🚀 <b>${I18N.get('trackingStarted')}</b>\n\n`)}${nextText}\n\n<i>${I18N.get('helpCommands')}</i>`
      );
    } else { /** Discard */
      Telegram.editMessage(this.messageId, `🚮 <b>${I18N.get('discarded')}</b>\n\n<i>${I18N.get('helpCommands')}</i>`);
    }
    user.cancel();
    log.add([`${this.constructor.name}.${Utils.method(this.stepConfirmation)}`], 2, DEBUG_END);
  }
}
