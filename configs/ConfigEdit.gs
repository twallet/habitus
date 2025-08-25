class ConfigEdit {

  static get() {
    log.add([`${this.name}.${Utils.method(this.get)}`], 2, DEBUG_START);
    const gotConfig = db.getConfig(user);
    log.add([`${this.name}.${Utils.method(this.get)}`, gotConfig], 2, DEBUG_RETURN);
    return gotConfig;
  }

  constructor(user, step, messageId, trackingId, frequency, daysMonths) {
    log.add([`new ${this.constructor.name}(user, step, messageId, trackingId, frequency, daysMonths)`, user, step, messageId, trackingId, frequency, daysMonths], 2, DEBUG_NEW);
    this.user = user;
    this.step = step;
    this.messageId = messageId;
    this.trackingId = trackingId;
    this.frequency = frequency;
    this.daysMonths = daysMonths;
    log.add([`new ${this.constructor.name}(user, step, messageId, trackingId, frequency, daysMonths)`, this], 2, DEBUG_RETURN);
  }

  print(tracking) {
    log.add([`${this.constructor.name}.${Utils.method(this.print)}`, tracking], 2, DEBUG_START);
    var print = `✍️ <b>${I18N.get('editHeader')}</b>\n\n`;
    print += (this.step === EDIT_QUESTION) ? '✏️ ' : '✔️ ';
    print += `${I18N.get('question')}: ${tracking.question}`;
    print += `\n⚓ ${I18N.get('type')}: ${tracking.type}`;
    if (tracking.type === I18N.get('types')[1]) {
      print += (this.step === EDIT_TRESHOLD) ? '\n✏️ ' : '\n✔️ ';
      print += `${I18N.get('treshold')}: ${tracking.treshold}`;
      print += (this.step === EDIT_TRESHOLD_TYPE) ? '\n✏️ ' : '\n✔️ ';
      print += `${I18N.get('tresholdType')}: ${tracking.tresholdType}`;
    }
    print += (this.step === EDIT_HOUR) ? '\n✏️ ' : '\n✔️ ';
    print += `${I18N.get('hour')}: ${tracking.hour}:${tracking.min.toString().padStart(2, '0')}`;
    print += (this.step === EDIT_START) ? '\n✏️ ' : '\n✔️ ';
    print += `${I18N.get('startMonitoring')}: ${Utils.formatDate(tracking.start)}`;
    print += (this.step === EDIT_END) ? '\n✏️ ' : '\n✔️ ';
    print += `${I18N.get('endMonitoring')}: ${(tracking.end !== NEVER_V) ? Utils.formatDate(tracking.end) : I18N.get('never')}`;
    print += (this.step === EDIT_FREQUENCY) ? '\n✏️ ' : '\n✔️ ';
    print += `${I18N.get('frequency')}: ${tracking.frequency}`;
    if (tracking.frequency !== I18N.get('frequencies')[0]) {
      print += (this.step === EDIT_WEEKLY_DAYS || this.step === EDIT_MONTHLY_DAYS || this.step === EDIT_YEARLY_MONTHS) ? '\n✏️ ' : '\n✔️ ';
      print += `${I18N.get((tracking.frequency === I18N.get('frequencies')[3]) ? 'monthsLabel' : 'daysLabel')}: ${tracking.daysMonths}`;
    }
    print += `\n✔️ ${I18N.get('state')}: ${(tracking.next == '') ? I18N.get('archived') : I18N.get('activated')} ${(tracking.next == '') ? '🗂️' : '🚀'}`;
    if (tracking.next !== '') print += `\n⚓ ${I18N.get('nextText')}: ${Utils.formatDateToDDMMYYYYHHMM(tracking.next)}`;
    log.add([`${this.constructor.name}.${Utils.method(this.print)}`, print], 2, DEBUG_RETURN);
    return print;
  }

  back() {
    log.add([`${this.constructor.name}.${Utils.method(this.back)}`, this.user.command, this.step], 2, DEBUG_START);
    log.add(['⬅️ Back', this.user.command, this.step], 1);
    switch (this.step) {
      case EDIT_ARCHIVED:
        Telegram.deleteMessage(this.messageId);
        this.stepEdit();
        break;
      case EDIT_TRACKING:
        Telegram.deleteMessage(this.messageId);
        this.stepEdit();
        break;
      default:
        this.stepTracking(this.trackingId);
        break;
    }
    log.add([`${this.constructor.name}.${Utils.method(this.back)}`, this.user.command, this.step], 2, DEBUG_END);
  }

  stepEdit() {
    log.add([`${this.constructor.name}.${Utils.method(this.stepEdit)}`], 2, DEBUG_START);
    log.add(['✍️ Edition started'], 1);
    const activeTrackings = user.listActiveTrackings();
    const activeTrackingsCB = activeTrackings.map(pair => `${BOT_ID}_${TRACKING_KEY}_${pair[0]}`);
    activeTrackingsCB.push(`${BOT_ID}_${ARCHIVED_KEY}`);
    const activeTrackingsQuestions = activeTrackings.map(pair => pair[1]);
    activeTrackingsQuestions.push(`🗂️ ${I18N.get('archivedTrackings')}`);
    const keyboard = Telegram.inlineKeyboard(activeTrackingsQuestions, { cancel: true, callbacks: activeTrackingsCB })
    const text = `✍️ <b>${I18N.get('editHeader')}</b>\n\n🤟 <i>${I18N.get('editIntro')}\n\n${I18N.get('editText')}</i>`;
    this.messageId = Telegram.sendMessage(text, keyboard);
    log.add([`${this.constructor.name}.${Utils.method(this.stepEdit)}`], 2, DEBUG_END);
  }

  stepArchived() {
    log.add([`${this.constructor.name}.${Utils.method(this.stepArchived)}`], 2, DEBUG_START);
    this.step = EDIT_ARCHIVED;
    this.trackingId = '';
    const archivedTrackings = user.listArchivedTrackings();
    const archivedTrackingsCB = archivedTrackings.map(pair => `${BOT_ID}_${TRACKING_KEY}_${pair[0]}`);
    const archivedTrackingsQuestions = archivedTrackings.map(pair => pair[1]);
    const keyboard = Telegram.inlineKeyboard(archivedTrackingsQuestions, { cancel: true, back: true, callbacks: archivedTrackingsCB });
    log.add(['🗂️ Showing archived trackings'], 1);
    this.messageId = Telegram.editMessage(this.messageId, I18N.get('editText'), keyboard);
    log.add([`${this.constructor.name}.${Utils.method(this.stepArchived)}`], 2, DEBUG_END);
  }

  stepTracking(id, existingTracking = null) {
    log.add([`${this.constructor.name}.${Utils.method(this.stepTracking)}`, id, existingTracking], 2, DEBUG_START);
    this.step = EDIT_TRACKING;
    this.trackingId = id;
    this.frequency = '';
    this.daysMonths = '';
    tracking = (existingTracking) ? existingTracking : Tracking.get(id);
    const text = `${this.print(tracking)}\n\n<i>${I18N.get('chooseEdit')}</i>`;
    const keyboard = tracking.editKeyboard();
    this.messageId = Telegram.editMessage(this.messageId, text, keyboard);
    log.add(['👀 Showing tracking attributes'], 1);
    log.add([`${this.constructor.name}.${Utils.method(this.stepTracking)}`], 2, DEBUG_END);
  }

  stepRestore(id, toastId) {
    log.add([`${this.constructor.name}.${Utils.method(this.stepRestore)}`, id, toastId], 2, DEBUG_START);
    this.step = EDIT_TRACKING;
    tracking = Tracking.get(id);
    tracking.setNext();
    var errorText = '';
    if (tracking.next === '') {
      errorText = `⚠️ <b>${I18N.get('impossibleRestore')} </b> ⚠️\n\n`;
    } else {
      log.add(['🚀 Tracking activated', tracking.question], 1);
    }
    this.messageId = Telegram.editMessage(this.messageId, `${errorText}${this.print(tracking)}`, tracking.editKeyboard());
    Telegram.sendToast(toastId, I18N.get('trackingRestored'));
    log.add([`${this.constructor.name}.${Utils.method(this.stepRestore)}`, id, toastId], 2, DEBUG_END);
  }

  stepArchive(id, toastId) {
    log.add([`${this.constructor.name}.${Utils.method(this.stepArchive)}`, id, toastId], 2, DEBUG_START);
    this.step = EDIT_TRACKING;
    tracking = Tracking.get(id);
    tracking.next = '';
    tracking.streakRegisters = 0;
    this.stepTracking(id, tracking);
    log.add(['🗂️ Tracking archived', tracking.question], 1);
    Telegram.sendToast(toastId, I18N.get('trackingArchived'));
    log.add([`${this.constructor.name}.${Utils.method(this.stepArchive)}`, id, toastId], 2, DEBUG_END);
  }

  stepEditQuestion(id) {
    log.add([`${this.constructor.name}.${Utils.method(this.stepEditQuestion)}`, id], 2, DEBUG_START);
    this.step = EDIT_QUESTION;
    tracking = Tracking.get(id);
    this.trackingId = id;
    this.messageId = Telegram.editMessage(this.messageId, `${this.print(tracking)}\n\n<i>${I18N.get('editQuestion')}</i>`,
      Telegram.inlineKeyboard([], { back: true })
    );
    log.add(['✍️ Question edition'], 1);
    log.add([`${this.constructor.name}.${Utils.method(this.stepEditQuestion)}`], 2, DEBUG_END);
  }

  stepQuestionEdited(data) {
    log.add([`${this.constructor.name}.${Utils.method(this.stepQuestionEdited)}`, data], 2, DEBUG_START);
    tracking = Tracking.get(this.trackingId);
    if (!Tracking.checkDuplicatedQuestion(data)) {
      tracking.question = data;
      this.stepTracking(this.trackingId, tracking);
      log.add(['✔️ Question edited', data], 1);
    } else {
      Telegram.editMessage(this.messageId, `⚠️ <b>${I18N.get('questionDuplicated')}:</b> ${data}\n\n` +
        `${this.print(tracking)}\n\n<i>${I18N.get('editQuestion')}</i>`,
        Telegram.inlineKeyboard([], { cancel: true, back: true })
      );
    }
    log.add([`${this.constructor.name}.${Utils.method(this.stepQuestionEdited)}`], 2, DEBUG_END);
  }

  stepEditTreshold(id) {
    log.add([`${this.constructor.name}.${Utils.method(this.stepEditTreshold)}`, id], 2, DEBUG_START);
    this.step = EDIT_TRESHOLD;
    tracking = Tracking.get(id);
    this.trackingId = id;
    this.messageId = Telegram.editMessage(this.messageId, `${this.print(tracking)}\n\n${I18N.get('editTreshold')}`,
      Telegram.inlineKeyboard([], { back: true })
    );
    log.add(['✍️ Treshold edition'], 1);
    log.add([`${this.constructor.name}.${Utils.method(this.stepEditTreshold)}`], 2, DEBUG_END);
  }

  stepTresholdEdited(data) {
    log.add([`${this.constructor.name}.${Utils.method(this.stepTresholdEdited)}`, data], 2, DEBUG_START);
    tracking = Tracking.get(this.trackingId);
    if (Utils.isValidFloat(data)) {
      tracking.treshold = data;
      this.stepTracking(this.trackingId, tracking);
      log.add(['✔️ Treshold edited', data]);
    } else {
      log.add(['⚠️ Not valid treshold', data], 1);
      Telegram.editMessage(this.messageId, `⚠️ <b>${I18N.get('tresholdWrong')}: </b>${data}\n\n` +
        `${this.print(tracking)}\n\n${I18N.get('editTreshold')}`,
        Telegram.inlineKeyboard([], { cancel: true, back: true })
      );
    }
    log.add([`${this.constructor.name}.${Utils.method(this.stepTresholdEdited)}`], 2, DEBUG_END);
  }

  stepEditTresholdType(id) {
    log.add([`${this.constructor.name}.${Utils.method(this.stepEditTresholdType)}`, id], 2, DEBUG_START);
    this.step = EDIT_TRESHOLD_TYPE;
    tracking = Tracking.get(id);
    this.trackingId = id;
    this.messageId = Telegram.editMessage(this.messageId,
      `${this.print(tracking)}\n\n<i>${I18N.get('tresholdTypeDef')}</i>`,
      Telegram.inlineKeyboard(I18N.get('tresholdTypes'), { back: true, groupSize: 2 })
    );
    log.add(['✍️ Treshold type edition'], 1);
    log.add([`${this.constructor.name}.${Utils.method(this.stepEditTresholdType)}`], 2, DEBUG_END);
  }

  stepTresholdTypeEdited(data) {
    log.add([`${this.constructor.name}.${Utils.method(this.stepTresholdTypeEdited)}`, data], 2, DEBUG_START);
    tracking = Tracking.get(this.trackingId);
    tracking.tresholdType = data;;
    this.stepTracking(this.trackingId, tracking);
    log.add(['✔️ Treshold type edited', data], 1);
    log.add([`${this.constructor.name}.${Utils.method(this.stepTresholdTypeEdited)}`], 2, DEBUG_END);
  }

  stepEditHour(id) {
    log.add([`${this.constructor.name}.${Utils.method(this.stepEditHour)}`, id], 2, DEBUG_START);
    this.step = EDIT_HOUR;
    tracking = Tracking.get(id);
    this.trackingId = id;
    this.messageId = Telegram.editMessage(this.messageId, `${this.print(tracking)}\n\n${I18N.get('editHour')}`,
      Telegram.inlineKeyboard([], { back: true })
    );
    log.add(['✍️ Hour edition'], 1);
    log.add([`${this.constructor.name}.${Utils.method(this.stepEditHour)}`], 2, DEBUG_END);
  }

  stepHourEdited(data) {
    log.add([`${this.constructor.name}.${Utils.method(this.stepHourEdited)}`, data], 2, DEBUG_START);
    tracking = Tracking.get(this.trackingId);
    const hour = Utils.validateHour(data);
    if (hour == -1) {
      log.add(['⚠️ Not valid hour', data], 1);
      Telegram.editMessage(this.messageId, `⚠️ <b>${I18N.get('hourWrong')}: </b> ${data}\n\n` +
        `${this.print(tracking)}\n\n<i>${I18N.get('editHour')}</i>`,
        Telegram.inlineKeyboard([], { cancel: true, back: true })
      );
    } else {
      tracking.hour = hour.split(':')[0];
      tracking.min = hour.split(':')[1];
      tracking.setNext();
      this.stepTracking(this.trackingId, tracking);
      log.add(['✔️ Hour edited', data], 1);
    }
    log.add([`${this.constructor.name}.${Utils.method(this.stepHourEdited)}`], 2, DEBUG_END);
  }

  stepEditStart(id) {
    log.add([`${this.constructor.name}.${Utils.method(this.stepEditStart)}`, id], 2, DEBUG_START);
    this.step = EDIT_START;
    tracking = Tracking.get(id);
    this.trackingId = id;
    this.messageId = Telegram.editMessage(this.messageId, `${this.print(tracking)}\n\n<i>${I18N.get('editStart')}</i>`,
      DatePicker.inlineKeyboard(new Date(tracking.start), EDIT_START, { back: true })
    );
    log.add(['✍️ Start date edition'], 1);
    log.add([`${this.constructor.name}.${Utils.method(this.stepEditStart)}`], 2, DEBUG_END);
  }

  stepStartEdited(start) {
    log.add([`${this.constructor.name}.${Utils.method(this.stepStartEdited)}`, start], 2, DEBUG_START);
    tracking = Tracking.get(this.trackingId);
    const endDate = new Date(tracking.end);
    const startDate = new Date(start);
    if (endDate < startDate) {
      log.add(['⚠️ Not valid period', startDate, endDate], 1);
      Telegram.editMessage(this.messageId,
        `⚠️ <b>${I18N.get('startAfterEnd')}: </b> ${Utils.formatDate(startDate)}\n\n` +
        `${this.print(tracking)}\n\n<i>${I18N.get('editStart')}</i>`,
        DatePicker.inlineKeyboard(new Date(tracking.start), EDIT_START, { back: true })
      );
    } else {
      tracking.start = startDate;
      tracking.setNext();
      this.stepTracking(this.trackingId, tracking);
      log.add(['✔️ Start date edited', start], 1);
    }
    log.add([`${this.constructor.name}.${Utils.method(this.stepStartEdited)}`], 2, DEBUG_END);
  }

  stepEditEnd(id) {
    log.add([`${this.constructor.name}.${Utils.method(this.stepEditEnd)}`, id], 2, DEBUG_START);
    this.step = EDIT_END;
    tracking = Tracking.get(id);
    this.trackingId = id;
    const date = (tracking.end !== NEVER_V) ? new Date(tracking.end) : new Date();
    this.messageId = Telegram.editMessage(this.messageId, `${this.print(tracking)}\n\n<i>${I18N.get('editEnd')}</i>`,
      DatePicker.inlineKeyboard(date, EDIT_END, { back: true, never: true })
    );
    log.add(['✍️ End date edition'], 1);
    log.add([`${this.constructor.name}.${Utils.method(this.stepEditEnd)}`], 2, DEBUG_END);
  }

  stepEndEdited(end) {
    log.add([`${this.constructor.name}.${Utils.method(this.stepEndEdited)}`, end], 2, DEBUG_START);
    tracking = Tracking.get(this.trackingId);
    if (end !== NEVER_V) {
      const endDate = new Date(end);
      const startDate = new Date(tracking.start);
      if (endDate < startDate) {
        log.add(['⚠️ Not valid period', startDate, endDate], 1);
        Telegram.editMessage(this.messageId,
          `⚠️ <b>${I18N.get('startAfterEnd')}: </b>${Utils.formatDate(endDate)}\n\n` +
          `${this.print(tracking)}\n\n<i>${I18N.get('editEnd')}</i>`,
          DatePicker.inlineKeyboard(new Date(tracking.start), EDIT_END, { back: true, never: true })
        );
        log.add([`${this.constructor.name}.${Utils.method(this.stepEndEdited)}`], 2, DEBUG_END);
        return;
      }
    }
    tracking.end = end;
    tracking.setNext();
    this.stepTracking(this.trackingId, tracking);
    log.add(['✔️ End date edited', end], 1);
    log.add([`${this.constructor.name}.${Utils.method(this.stepEndEdited)}`], 2, DEBUG_END);
  }

  stepEditFrequency(id) {
    log.add([`${this.constructor.name}.${Utils.method(this.stepEditFrequency)}`, id], 2, DEBUG_START);
    this.step = EDIT_FREQUENCY;
    tracking = Tracking.get(id);
    this.trackingId = id;
    this.messageId = Telegram.editMessage(this.messageId,
      `${this.print(tracking)}\n\n<i>${I18N.get('frequencyDef')}</i>`,
      Telegram.inlineKeyboard(I18N.get('frequencies'), { back: true, groupSize: 4 })
    );
    log.add(['✍️ Frequency edition'], 1);
    log.add([`${this.constructor.name}.${Utils.method(this.stepEditFrequency)}`], 2, DEBUG_END);
  }

  stepFrequencyEdited(data) {
    log.add([`${this.constructor.name}.${Utils.method(this.stepFrequencyEdited)}`, data], 2, DEBUG_START);
    tracking = Tracking.get(this.trackingId);
    const originalFrequency = tracking.frequency;
    this.frequency = data;
    this.daysMonths = '';
    tracking.frequency = data;
    switch (this.frequency) {
      case I18N.get('frequencies')[0]: /** Daily */
        tracking.daysMonths = '';
        tracking.setNext();
        this.stepTracking(this.trackingId, tracking);
        break;
      case I18N.get('frequencies')[1]: /** Weekly */
        this.step = EDIT_WEEKLY_DAYS;
        this.messageId = Telegram.editMessage(this.messageId,
          `${this.print(tracking)}\n\n<i>${I18N.get('weeklyDaysEdit')}</i>`,
          Telegram.inlineKeyboard(I18N.get('weekdays'), { back: true, save: true, groupSize: 7 })
        );
        tracking.frequency = originalFrequency;
        break;
      case I18N.get('frequencies')[2]: /** Monthly */
        this.step = EDIT_MONTHLY_DAYS;
        this.messageId = Telegram.editMessage(this.messageId,
          `${this.print(tracking)}\n\n<i>${I18N.get('monthlyDaysEdit')}</i>`,
          Telegram.inlineKeyboard(I18N.get('monthDays'), { back: true, save: true, groupSize: 4 })
        );
        tracking.frequency = originalFrequency;
        break;
      case I18N.get('frequencies')[3]: /** Yearly */
        this.step = EDIT_YEARLY_MONTHS;
        this.messageId = Telegram.editMessage(this.messageId,
          `${this.print(tracking)}\n\n<i>${I18N.get('yearlyMonthsEdit')}</i>`,
          Telegram.inlineKeyboard(I18N.get('months'), { back: true, save: true, groupSize: 4 })
        );
        tracking.frequency = originalFrequency;
        break;
      default:
        break;
    }
    log.add(['✔️ Frequency registered', this.frequency], 1);
    log.add([`${this.constructor.name}.${Utils.method(this.stepFrequencyEdited)}`], 2, DEBUG_END);
  }

  stepEditDaysMonths(id) {
    log.add([`${this.constructor.name}.${Utils.method(this.stepEditDaysMonths)}`, id], 2, DEBUG_START);
    tracking = Tracking.get(id);
    const originalFrequency = tracking.frequency;
    (this.frequency !== '') ? tracking.frequency = this.frequency : this.frequency = tracking.frequency;
    this.daysMonths = tracking.daysMonths;
    switch (tracking.frequency) {
      case I18N.get('frequencies')[1]: /** Weekly */
        this.step = EDIT_WEEKLY_DAYS;
        Telegram.editMessageWithSelection(this.messageId, `${this.print(tracking)}\n\n<i>${I18N.get('weeklyDaysEdit')}</i>`,
          I18N.get('weekdays'), this.daysMonths.split(', '), { back: true, save: true, groupSize: 7 }
        );
        break;
      case I18N.get('frequencies')[2]: /** Monthly */
        this.step = EDIT_MONTHLY_DAYS;
        Telegram.editMessageWithSelection(this.messageId, `${this.print(tracking)}\n\n<i>${I18N.get('monthlyDaysEdit')}</i>`,
          I18N.get('monthDays'), this.daysMonths.split(', '), { back: true, save: true, groupSize: 4 }
        );
        break;
      case I18N.get('frequencies')[3]: /** Yearly */
        this.step = EDIT_YEARLY_MONTHS;
        Telegram.editMessageWithSelection(this.messageId, `${this.print(tracking)}\n\n<i>${I18N.get('yearlyMonthsEdit')}</i>`,
          I18N.get('months'), this.daysMonths.split(', '), { back: true, save: true, groupSize: 4 }
        );
        break;
    }
    tracking.frequency = originalFrequency;
    log.add(['✍️ DaysMonths edition'], 1);
    log.add([`${this.constructor.name}.${Utils.method(this.stepEditDaysMonths)}`], 2, DEBUG_END);
  }

  stepDaysMonthsEdited(selectedOption, allOptions, groupSize, toastId) {
    log.add([`${this.constructor.name}.${Utils.method(this.stepDaysMonthsEdited)}`, selectedOption, allOptions, groupSize, toastId], 2, DEBUG_START);
    tracking = Tracking.get(this.trackingId);
    const daysMonths = this.daysMonths;
    if (selectedOption === `${BOT_ID}_${SAVE_KEY}`) {
      if (daysMonths.length > 0) {
        tracking.frequency = this.frequency;
        tracking.daysMonths = this.daysMonths;
        tracking.setNext();
        this.stepTracking(this.trackingId, tracking);
        log.add(['✔️ Days/Months edited', daysMonths], 1);
      } else {
        Telegram.sendToast(toastId, I18N.get('saveAlert'));
      }
    } else {
      Telegram.updateSelection(this.messageId, allOptions, this.updateDaysMonths(selectedOption), { groupSize: groupSize, save: true, back: true });
    }
    log.add([`${this.constructor.name}.${Utils.method(this.stepDaysMonthsEdited)}`], 2, DEBUG_END);
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

}
