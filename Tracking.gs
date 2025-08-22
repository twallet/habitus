class Tracking {

  static checkDuplicatedQuestion(question) {
    log.add([`${this.name}.${Utils.method(this.checkDuplicatedQuestion)}`, question], 2, DEBUG_START);
    const duplicatedQuestion = db.duplicatedQuestion(user, question);
    if (duplicatedQuestion) log.add(['⚠️ Duplicated question', question], 1);
    log.add([`${this.name}.${Utils.method(this.checkDuplicatedQuestion)}`, duplicatedQuestion], 2, DEBUG_RETURN);
    return duplicatedQuestion;
  }

  static pendingTrackings() {
    log.add([`${this.name}.${Utils.method(this.pendingTrackings)}`], 2, DEBUG_START);
    const pendingTrackings = db.pendingTrackings();
    log.add([`${this.name}.${Utils.method(this.pendingTrackings)}`, pendingTrackings], 2, DEBUG_RETURN);
    return pendingTrackings;
  }

  static get(id) {
    log.add([`${this.name}.${Utils.method(this.get)}`, id], 2, DEBUG_START);
    const gotTracking = db.getTracking(id);
    log.add([`${this.name}.${Utils.method(this.get)}`, gotTracking.id, gotTracking.user.id, gotTracking.question, gotTracking.type, gotTracking.treshold, gotTracking.tresholdType, gotTracking.hour, gotTracking.min, gotTracking.frequency, gotTracking.daysMonths, gotTracking.start, gotTracking.end, gotTracking.next], 2, DEBUG_RETURN);
    return gotTracking;
  }

  static newId(user) {
    log.add([`${this.name}.${Utils.method(this.newId)}`], 2, DEBUG_START);
    const next = +db.getTrackingsLength(user) + 1;
    const newId = `${+user.id}.${next}`;
    log.add([`${this.name}.${Utils.method(this.newId)}`, newId], 2, DEBUG_RETURN);
    return newId;
  }

  static getFirstResponseDate(trackingId) {
    log.add([`${this.name}.${Utils.method(this.getFirstResponseDate)}`, trackingId], 2, DEBUG_START);
    const firstDate = db.getFirstResponseDate(trackingId);
    log.add([`${this.name}.${Utils.method(this.getFirstResponseDate)}`, firstDate], 2, DEBUG_RETURN);
    return firstDate;
  }

  constructor(trackingId, question, type, treshold, tresholdType, hour, min, frequency, daysMonths, start, end, next, streakRegisters, batchUser = null) {
    log.add([`new ${this.constructor.name}(trackingId, question, type, treshold, tresholdType, hour, min, frequency, daysMonths, start, end, next, streakRegisters, batchUser = null)`, trackingId, question, type, treshold, tresholdType, hour, min, frequency, daysMonths, start, end, next, streakRegisters, batchUser], 2, DEBUG_NEW);
    this.id = trackingId;
    (user == null) ? this.user = batchUser : this.user = user;
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
    this.next = next;
    this.streakRegisters = streakRegisters;
    log.add([`new ${this.constructor.name}(trackingId, question, type, treshold, tresholdType, hour, min, frequency, daysMonths, start, end, next, streakRegisters)`, this.id, this.question, this.type, this.treshold, this.tresholdType, this.hour, this.min, this.frequency, this.daysMonths, this.start, this.end, this.next, this.streakRegisters], 2, DEBUG_RETURN);
  }

  sendRequest() {
    log.add([`${this.constructor.name}.${Utils.method(this.sendRequest)}`], 2, DEBUG_START);
    user = this.user;
    const replytext = (this.type === I18N.get('types')[0]) ? '' : I18N.get('reply');
    const messageId = Telegram.sendMessage(`<i>${this.question}</i>\n${replytext}`, this.requestInlineKeyboard());
    this.setNext();
    requestsAdded.push([this, messageId]);
    modifiedTrackings.push(this);
    log.add([`${this.constructor.name}.${Utils.method(this.sendRequest)}`], 2, DEBUG_END);
  }

  setNext() {
    log.add([`${this.constructor.name}.${Utils.method(this.setNext)}`], 2, DEBUG_START);
    const now = new Date();
    const startDate = (new Date(this.start) > now) ? new Date(this.start) : now;
    const frequencies = I18N.get('frequencies');
    switch (this.frequency) {
      case frequencies[0]:
        this.next = this.getNextDaily(now, startDate);
        break;
      case frequencies[1]:
        this.next = this.getNextWeekly(startDate);
        break;
      case frequencies[2]:
        this.next = this.getNextMonthly(startDate);
        break;
      case frequencies[3]:
        this.next = this.getNextAnnualy(startDate);
        break;
      default:
        this.next = '';
        this.streakRegisters = 0;
        break;
    }
    if ((this.end !== NEVER_V) && (this.next > this.end)) {
      this.next = '';
      this.streakRegisters = 0;
    }
    log.add([`${this.constructor.name}.${Utils.method(this.setNext)}`], 2, DEBUG_END);
  }

  getPeriodResponses(start, end) {
    log.add([`${this.constructor.name}.${Utils.method(this.getPeriodResponses)}`, start, end], 2, DEBUG_START);
    const periodResponses = db.getPeriodResponses(this, start, end);
    log.add([`${this.constructor.name}.${Utils.method(this.getPeriodResponses)}`, periodResponses], 2, DEBUG_RETURN);
    return periodResponses;
  }

  requestInlineKeyboard() {
    log.add([`${this.constructor.name}.${Utils.method(this.requestInlineKeyboard)}`], 2, DEBUG_START);
    user = this.user;
    const requestResponses = I18N.get('booleanResponses');
    var values = [], callbacks = [];
    if (this.type === I18N.get('types')[0]) {
      values = [requestResponses[0], requestResponses[1]];
      callbacks = [`${BOT_ID}_${RESPONSE_KEY}_${BOOLEAN_KEY}_${requestResponses[0]}`, `${BOT_ID}_${RESPONSE_KEY}_${BOOLEAN_KEY}_${requestResponses[1]}`];
    }
    values.push(requestResponses[2]);
    callbacks.push(`${BOT_ID}_${RESPONSE_KEY}_${SNOOZE_KEY}`);
    const keyboard = Telegram.inlineKeyboard(values, { groupSize: values.length, callbacks: callbacks });
    log.add([`${this.constructor.name}.${Utils.method(this.requestInlineKeyboard)}`, keyboard], 2, DEBUG_RETURN);
    return keyboard;
  }

  snooze(time) {
    log.add([`${this.constructor.name}.${Utils.method(this.snooze)}`, time], 2, DEBUG_START);
    const newNext = new Date();
    this.next = new Date(newNext.getTime() + parseInt(time, 10));
    log.add([`${this.constructor.name}.${Utils.method(this.snooze)}`], 2, DEBUG_END);
  }

  getNextDaily(now, startDate) {
    log.add([`${this.constructor.name}.${Utils.method(this.getNextDaily)}`, now, startDate], 2, DEBUG_START);
    const nextDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), this.hour, this.min);
    if (nextDate <= now) {
      nextDate.setHours(nextDate.getHours() + 24);
    }
    log.add([`${this.constructor.name}.${Utils.method(this.getNextDaily)}`, nextDate], 2, DEBUG_RETURN);
    return nextDate;
  }

  getNextWeekly(startDate) {
    log.add([`${this.constructor.name}.${Utils.method(this.getNextWeekly)}`, startDate], 2, DEBUG_START);
    const selectedDaysArray = this.daysMonths.split(', ');
    const nextDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), this.hour, this.min);
    let found = false;
    if (selectedDaysArray.includes(I18N.get('weekdays')[nextDate.getDay()]) && nextDate > startDate) {
      found = true;
    }
    while (!found) {
      nextDate.setDate(nextDate.getDate() + 1);
      if (selectedDaysArray.includes(I18N.get('weekdays')[nextDate.getDay()])) {
        found = true;
      }
    }
    log.add([`${this.constructor.name}.${Utils.method(this.getNextWeekly)}`, nextDate], 2, DEBUG_RETURN);
    return nextDate;
  }

  getNextMonthly(startDate) {
    log.add([`${this.constructor.name}.${Utils.method(this.getNextMonthly)}`, startDate], 2, DEBUG_START);
    const selectedDayNumbers = this.daysMonths.split(', ').map(day => parseInt(day.replace(`${I18N.get('day')} `, ''), 10));
    const nextDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), this.hour, this.min);
    let found = false;
    if (selectedDayNumbers.includes(nextDate.getDate()) && nextDate > startDate) {
      found = true;
    }
    while (!found) {
      if (nextDate.getDate() > 28) {
        nextDate.setMonth(nextDate.getMonth() + 1);
        nextDate.setDate(1);
      } else {
        nextDate.setDate(nextDate.getDate() + 1);
      }
      if (selectedDayNumbers.includes(nextDate.getDate())) {
        found = true;
      }
    }
    log.add([`${this.constructor.name}.${Utils.method(this.getNextMonthly)}`, nextDate], 2, DEBUG_RETURN);
    return nextDate;
  }
  getNextAnnualy(startDate) {
    log.add([`${this.constructor.name}.${Utils.method(this.getNextAnnualy)}`, startDate], 2, DEBUG_START);
    const selectedMonthsArray = this.daysMonths.split(', ').map(month => I18N.get('months').map(value => String(value)).indexOf(String(month.trim())));
    let nextDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1, this.hour, this.min);
    let found = false;
    if (selectedMonthsArray.includes(startDate.getMonth()) && nextDate > startDate) {
      found = true;
    }
    while (!found) {
      if (nextDate.getMonth() === 11) {
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        nextDate.setMonth(0);
      } else {
        nextDate.setMonth(nextDate.getMonth() + 1);
      }
      if (selectedMonthsArray.includes(nextDate.getMonth())) {
        found = true;
      }
    }
    log.add([`${this.constructor.name}.${Utils.method(this.getNextAnnualy)}`, nextDate], 2, DEBUG_RETURN);
    return nextDate;
  }

  editKeyboard() {
    log.add([`${this.constructor.name}.${Utils.method(this.editKeyboard)}`], 2, DEBUG_START);
    const texts = [], callbacks = [];
    texts.push(I18N.get('question'));
    callbacks.push(`${BOT_ID}_${EDIT_QUESTION_KEY}_${this.id}`);
    if (this.type === I18N.get('types')[1]) {
      texts.push(I18N.get('treshold'));
      texts.push(I18N.get('tresholdType'));
      callbacks.push(`${BOT_ID}_${EDIT_TRESHOLD_KEY}_${this.id}`);
      callbacks.push(`${BOT_ID}_${EDIT_TRESHOLD_TYPE_KEY}_${this.id}`);
    }
    texts.push(I18N.get('hour'));
    callbacks.push(`${BOT_ID}_${EDIT_HOUR_KEY}_${this.id}`);
    texts.push(I18N.get('startMonitoring'));
    callbacks.push(`${BOT_ID}_${EDIT_START_KEY}_${this.id}`);
    texts.push(I18N.get('endMonitoring'));
    callbacks.push(`${BOT_ID}_${EDIT_END_KEY}_${this.id}`);
    texts.push(I18N.get('frequency'));
    callbacks.push(`${BOT_ID}_${EDIT_FREQUENCY_KEY}_${this.id}`);
    if (this.frequency !== I18N.get('frequencies')[0]) {
      const label = (this.frequency == I18N.get('frequencies')[3]) ? 'monthsLabel' : 'daysLabel';
      texts.push(I18N.get(label));
      callbacks.push(`${BOT_ID}_${EDIT_DAYS_MONTHS_KEY}_${this.id}`);
    }
    if (this.next === '') {
      texts.push(`🚀 ${I18N.get('restore')}`);
      callbacks.push(`${BOT_ID}_${EDIT_RESTORE_KEY}_${this.id}`);
    } else {
      texts.push(`🗂️ ${I18N.get('archive')}`);
      callbacks.push(`${BOT_ID}_${EDIT_ARCHIVE_KEY}_${this.id}`);
    }
    const keyboard = Telegram.inlineKeyboard(texts, { finish: true, back: true, groupSize: 3, callbacks: callbacks });
    log.add([`${this.constructor.name}.${Utils.method(this.editKeyboard)}`, keyboard], 2, DEBUG_RETURN);
    return keyboard;
  }

  print() {
    log.add([`${this.constructor.name}.${Utils.method(this.print)}`], 2, DEBUG_START);
    var print = `✔️ ${I18N.get('tracking')}: ${this.question}`;
    print += `\n✔️ ${I18N.get('type')}: ${this.type}`;
    if (this.type === I18N.get('types')[1]) {
      print += `\n✔️ ${I18N.get('treshold')}: ${this.treshold}`;
      print += `\n✔️ ${I18N.get('tresholdType')}: ${this.tresholdType}`;
    }
    print += `\n✔️ ${I18N.get('hour')}: ${this.hour}:${this.min.toString().padStart(2, '0')}`;
    print += `\n✔️ ${I18N.get('startMonitoring')}: ${Utils.formatDate(this.start)}`;
    print += `\n✔️ ${I18N.get('endMonitoring')}: ${(this.end !== NEVER_V) ? Utils.formatDate(this.end) : this.end}`;
    print += `\n✔️ ${I18N.get('frequency')}: ${this.frequency}`;
    if (this.frequency !== I18N.get('frequencies')[0]) print += `\n✔️ ${I18N.get((this.frequency === I18N.get('frequencies')[3]) ? 'monthsLabel' : 'daysLabel')}: ${this.daysMonths}`;
    print += `\n✔️ ${I18N.get('state')}: ${(this.next === '') ? I18N.get('archived') : I18N.get('activated')} ${(this.next === '') ? '🗂️' : '🚀'}`;
    if (this.next !== '') print += `\n✔️ ${I18N.get('nextText')}: ${Utils.formatDateToDDMMYYYYHHMM(this.next)}`;
    log.add([`${this.constructor.name}.${Utils.method(this.print)}`, print], 2, DEBUG_RETURN);
    return print;
  }

  getAllResponses(lastResponse = null) {
    log.add([`${this.constructor.name}.${Utils.method(this.getAllResponses)}`, lastResponse], 2, DEBUG_START);
    const allResponses = db.getAllResponses(this);
    let processedResponses = [];
    if (lastResponse !== null) {
      const requestIndex = allResponses.findIndex(innerArray => { return String(innerArray[1]) == String(lastResponse.messageId) });
      if (requestIndex !== -1) allResponses[requestIndex][2] = lastResponse.value;
    }
    if (allResponses.length > 0) {
      switch (this.type) {
        case I18N.get('types')[0]:  /** '🔘 Sí/No' */
          processedResponses = allResponses.map(item => [item[0], item[1], item[2], String(item[2]) === YES_V]);
          break;
        case I18N.get('types')[1]: /** '6️⃣ Número' */
          if (this.tresholdType == I18N.get('tresholdTypes')[0]) { /** '🔼 Superior a' */
            processedResponses = allResponses.map(item => [item[0], item[1], item[2], item[2] !== '' && Number(item[2]) >= Number(this.treshold)]);
          }
          else { /** '🔽 Inferior a' */
            processedResponses = allResponses.map(item => [item[0], item[1], item[2], item[2] !== '' && Number(item[2]) <= Number(this.treshold)]);
          }
          break;
        default: /** '🖊️ Texto' */
          processedResponses = allResponses.map(item => [item[0], item[1], item[2], item[2] !== '']);
          break;
      }
    }
    log.add([`${this.constructor.name}.${Utils.method(this.getAllResponses)}`, processedResponses.length], 2, DEBUG_RETURN);
    return processedResponses;
  }

  getLastValues(allResponses) {
    log.add([`${this.constructor.name}.${Utils.method(this.getLastValues)}`, allResponses], 2, DEBUG_START);
    const lastValuesArray = allResponses.slice(-LAST_VALUES_SIZE).map(item => item[3] ? YES_V : NO_V).join('');
    log.add([`${this.constructor.name}.${Utils.method(this.getLastValues)}`, lastValuesArray], 2, DEBUG_RETURN);
    return lastValuesArray;
  }

  getCurrentStreak(allResponses) {
    log.add([`${this.constructor.name}.${Utils.method(this.getCurrentStreak)}`, allResponses], 2, DEBUG_START);
    this.streakRegisters = allResponses.length - allResponses.map(item => item[3]).lastIndexOf(false) - 1;
    log.add([`${this.constructor.name}.${Utils.method(this.getCurrentStreak)}`, this.streakRegisters], 2, DEBUG_RETURN);
    return this.streakRegisters;
  }

  getMaxStreak(allResponses) {
    log.add([`${this.constructor.name}.${Utils.method(this.getMaxStreak)}`, allResponses], 2, DEBUG_START);
    const maxElements = allResponses.reduce((elements, current) => {
      if (current[3]) {
        elements.currentCount++;
        if (elements.currentCount > elements.maxCount) elements.maxCount = elements.currentCount;
      } else {
        elements.currentCount = 0;
      }
      return elements;
    }, { maxCount: 0, currentCount: 0 }).maxCount;
    log.add([`${this.constructor.name}.${Utils.method(this.getMaxStreak)}`, maxElements], 2, DEBUG_RETURN);
    return maxElements;
  }
}
