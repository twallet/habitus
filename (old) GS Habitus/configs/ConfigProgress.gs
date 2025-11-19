class ConfigProgress {

  static get() {
    log.add([`${this.name}.${Utils.method(this.get)}`], 2, DEBUG_START);
    const gotConfig = db.getConfig(user);
    log.add([`${this.name}.${Utils.method(this.get)}`, gotConfig], 2, DEBUG_RETURN);
    return gotConfig;
  }

  constructor(user, step, messageId, trackingId, question, reportStart, reportEnd) {
    log.add([`new ${this.constructor.name}(user, step, messageId, trackingId, question, reportStart, reportEnd)`, user, step, messageId, trackingId, question, reportStart, reportEnd], 2, DEBUG_NEW);
    this.user = user;
    this.step = step;
    this.messageId = messageId;
    this.trackingId = trackingId;
    this.question = question;
    this.reportStart = reportStart;
    this.reportEnd = reportEnd;
    log.add([`new ${this.constructor.name}(user, step, messageId, trackingId, question, reportStart, reportEnd)`, this], 2, DEBUG_RETURN);
  }

  back() {
    log.add([`${this.constructor.name}.${Utils.method(this.back)}`, this.user.command, this.step], 2, DEBUG_START);
    log.add(['⬅️ Back', this.user.command, this.step], 1);
    switch (this.step) {
      case PROGRESS_ARCHIVED:
        Telegram.deleteMessage(this.messageId);
        config = new ConfigProgress(user, '', this.messageId, '', '', '', '');
        config.stepProgress();
        break;
      case PROGRESS_TRACKING:
        Telegram.deleteMessage(this.messageId);
        config = new ConfigProgress(user, '', this.messageId, '', '', '', '');
        config.stepProgress();
        break;
      case PROGRESS_CUSTOM:
        this.stepTracking(this.trackingId);
        break;
      case PROGRESS_CUSTOM_END:
        this.reportStart = '';
        this.stepCustomPeriod();
        break;
      default:
        break;
    }
    log.add([`${this.constructor.name}.${Utils.method(this.back)}`, this.user.command, this.step], 2, DEBUG_END);
  }

  print() {
    log.add([`${this.constructor.name}.${Utils.method(this.print)}`], 2, DEBUG_START);
    var print = `📊 <b>${I18N.get('progressHeader')}</b>\n\n`;
    print += `✔️ ${I18N.get('tracking')}: ${this.question}`;
    print += (this.reportStart) ? `\n✔️ ${I18N.get('startMonitoring')}: ${Utils.formatDate(this.reportStart)}` : '';
    print += (this.reportEnd) ? `\n✔️ ${I18N.get('endMonitoring')}: ${Utils.formatDate(this.reportEnd)}` : '';
    log.add([`${this.constructor.name}.${Utils.method(this.print)}`, print], 2, DEBUG_RETURN);
    return print;
  }

  stepProgress() {
    log.add([`${this.constructor.name}.${Utils.method(this.stepProgress)}`], 2, DEBUG_START);
    log.add(['📊 Progress started'], 1);
    this.step = PROGRESS;
    let activeTrackings, activeTrackingsQuestions;
    activeTrackings = user.getTrackings({ onlyActive: true });
    activeTrackingsQuestions = activeTrackings.map(element => `${element[1]} (🔥${element[2]})`);
    const activeTrackingsCB = activeTrackings.map(pair => `${BOT_ID}_${TRACKING_KEY}_${pair[0]}`);
    activeTrackingsCB.push(`${BOT_ID}_${ARCHIVED_KEY}`);
    activeTrackingsQuestions.push(`🗂️ ${I18N.get('archivedTrackings')}`);
    const keyboard = Telegram.inlineKeyboard(activeTrackingsQuestions, { cancel: true, callbacks: activeTrackingsCB })
    this.messageId = Telegram.sendMessage(`${I18N.get('pickProgressText')}`, keyboard);
    log.add([`${this.constructor.name}.${Utils.method(this.stepProgress)}`], 2, DEBUG_END);
  }

  stepArchived() {
    log.add([`${this.constructor.name}.${Utils.method(this.stepArchived)}`], 2, DEBUG_START);
    this.step = PROGRESS_ARCHIVED;
    this.trackingId = '';
    let archivedTrackings;
    archivedTrackings = user.getTrackings({ onlyArchived: true });
    const archivedTrackingsCB = archivedTrackings.map(pair => `${BOT_ID}_${TRACKING_KEY}_${pair[0]}`);
    const archivedTrackingsQuestions = archivedTrackings.map(pair => pair[1]);
    const keyboard = Telegram.inlineKeyboard(archivedTrackingsQuestions, { cancel: true, back: true, callbacks: archivedTrackingsCB });
    log.add(['🗂️ Showing archived trackings'], 1);
    this.messageId = Telegram.editMessage(this.messageId, I18N.get('pickProgressText'), keyboard);
    log.add([`${this.constructor.name}.${Utils.method(this.stepArchived)}`], 2, DEBUG_END);
  }

  stepTracking(id) {
    log.add([`${this.constructor.name}.${Utils.method(this.stepTracking)}`, id], 2, DEBUG_START);
    this.step = PROGRESS_TRACKING;
    this.trackingId = id;
    log.add(['👍 Tracking selected for progress'], 1);
    tracking = Tracking.get(id);
    this.question = tracking.question;
    const text = `${this.print()}\n\n<i>${I18N.get('periodChoice')}</i>`;
    const keyboard = this.periodsKeyboard();
    this.messageId = Telegram.editMessage(this.messageId, text, keyboard);
    log.add([`${this.constructor.name}.${Utils.method(this.stepTracking)}`], 2, DEBUG_END);
  }

  periodsKeyboard() {
    log.add([`${this.constructor.name}.${Utils.method(this.periodsKeyboard)}`], 2, DEBUG_START);
    const periods = Object.keys(I18N.get('periods'));
    const callbacks = periods.map(value => `${BOT_ID}_${PERIOD_KEY}_${value}`);
    periods.push(I18N.get('custom'));
    callbacks.push(`${BOT_ID}_${CUSTOM_KEY}`);
    const keyboard = Telegram.inlineKeyboard(periods, { cancel: true, back: true, groupSize: 4, callbacks: callbacks });
    log.add([`${this.constructor.name}.${Utils.method(this.periodsKeyboard)}`, keyboard], 2, DEBUG_RETURN);
    return keyboard;
  }

  stepCustomPeriod() {
    log.add([`${this.constructor.name}.${Utils.method(this.stepCustomPeriod)}`], 2, DEBUG_START);
    this.step = PROGRESS_CUSTOM;
    log.add(['📆 Custom period definition'], 1);
    const text = `${this.print()}\n\n<i>${I18N.get('periodStart')}</i>`;
    const keyboard = DatePicker.inlineKeyboard(new Date(), PERIOD_START_KEY, { cancel: true, back: true })
    this.messageId = Telegram.editMessage(this.messageId, text, keyboard);
    log.add([`${this.constructor.name}.${Utils.method(this.stepCustomPeriod)}`], 2, DEBUG_END);
  }

  stepCustomStartEdited(date) {
    log.add([`${this.constructor.name}.${Utils.method(this.stepCustomStartEdited)}`, date], 2, DEBUG_START);
    this.step = PROGRESS_CUSTOM_END;
    this.reportStart = new Date(date);
    this.reportStart.setHours(0, 0, 0, 0);
    const newDate = new Date(date);
    newDate.setMonth(newDate.getMonth() + 1);
    log.add(['📆 Custom period start defined', Utils.formatDate(this.reportStart)], 1);
    const text = `${this.print()}\n\n<i>${I18N.get('periodEnd')}</i>`;
    const keyboard = DatePicker.inlineKeyboard(newDate, PERIOD_END_KEY, { cancel: true, back: true })
    this.messageId = Telegram.editMessage(this.messageId, text, keyboard);
    log.add([`${this.constructor.name}.${Utils.method(this.stepCustomStartEdited)}`], 3, DEBUG_END);
  }

  stepGenerateReport(period = null) {
    log.add([`${this.constructor.name}.${Utils.method(this.stepGenerateReport)}`, period], 2, DEBUG_START);
    log.add(['📆 Period selected', (period !== null) ? period : `${Utils.formatDate(this.reportStart)} - ${Utils.formatDate(this.reportEnd)}`], 1);
    if (period !== null) {
      const date = new Date();
      date.setHours(23, 59, 59, 999);
      this.reportEnd = date;
      if (I18N.get('periods')[period] == 0) {
        this.reportStart = new Date(Tracking.getFirstResponseDate(this.trackingId));
      } else {
        this.reportStart = new Date(this.reportEnd.getTime() - (I18N.get('periods')[period] * 24 * 60 * 60 * 1000));
      }
    }
    tracking = Tracking.get(this.trackingId);
    const allResponses = tracking.getAllResponses();
    const streakText = `${I18N.get('streak')}: ${tracking.getLastValues(allResponses)} (🔥${tracking.getCurrentStreak(allResponses)} 💪${tracking.getMaxStreak(allResponses)})`;
    const periodResponses = tracking.getPeriodResponses(this.reportStart, this.reportEnd);
    const text = `📊 <b>${I18N.get('progressHeader')}</b>\n\n${tracking.print()}\n\n${streakText}\n\n📆 <b>${I18N.get('period')}</b>: ${Utils.formatDate(this.reportStart)} ${I18N.get('to')} ${Utils.formatDate(this.reportEnd)}${(period !== null) ? ` (${period})` : ''}\n` +
      `${this.printStats(tracking, periodResponses)}\n\n` +
      `👁️ <b>${I18N.get('data')}</b>\n${this.printData(periodResponses)}`;
    Telegram.editMessage(this.messageId, text);
    user.cancel();
    log.add([`${this.constructor.name}.${Utils.method(this.stepGenerateReport)}`], 2, DEBUG_END);
  }

  printData(periodResponses) {
    log.add([`${this.constructor.name}.${Utils.method(this.printData)}`, periodResponses], 2, DEBUG_START);
    var print = '';
    if (periodResponses.length > 0) {
      periodResponses.forEach(value => print += `▪️ ${Utils.formatDate(new Date(value[0]))}: ${value[1]}\n`);
    } else {
      print = `‼️<i>${I18N.get('noData')}</i>`;
    }
    log.add([`${this.constructor.name}.${Utils.method(this.printData)}`, print], 2, DEBUG_RETURN);
    return print;
  }

  printStats(tracking, periodResponses) {
    log.add([`${this.constructor.name}.${Utils.method(this.printStats)}`, tracking, periodResponses], 2, DEBUG_START);
    const values = periodResponses.map(item => item[1]);
    const registers = values.length;
    var print = `‼️<i>${I18N.get('noData')}</i>`;
    if (registers > 0) {
      const empty = values.filter(item => item == '').length;
      print = `✍️ ${registers} ${I18N.get('register')}${(registers > 1) ? 's' : ''}\n`;
      switch (tracking.type) {
        case I18N.get('types')[0]: // '🔘 Sí/No'
          const yes = values.filter(item => item == YES_V).length;
          print += `${YES_V} ${yes} ${I18N.get('register')}${(yes > 1) ? 's' : ''} (${(100 * yes / registers).toFixed(2)}%)\n`;
          const no = values.filter(item => item == NO_V).length;
          print += `${NO_V} ${no} ${I18N.get('register')}${(no > 1) ? 's' : ''} (${(100 * no / registers).toFixed(2)}%)\n`;
          break;
        case I18N.get('types')[1]: // '6️⃣ Número'
          if (tracking.tresholdType === I18N.get('tresholdTypes')[0]) { //'🔼 Superior a'
            const greater = values.filter(item => item !== '' && item.toFixed(4) >= tracking.treshold.toFixed(4)).length;
            print += `✔️ ${greater} ${I18N.get('register')}${(greater > 1) ? 's' : ''} ${tracking.tresholdType} ${I18N.get('to')} ${tracking.treshold} (${(100 * greater / registers).toFixed(2)}%)\n`;
            print += `✖️ ${registers - greater} ${I18N.get('register')}${(registers - greater > 1) ? 's' : ''} ${I18N.get('tresholdTypes')[1]} ${I18N.get('to')} ${tracking.treshold}) (${(100 * (registers - greater) / registers).toFixed(2)}%)\n`;
          } else { //'🔽 Inferior a'
            const lower = values.filter(item => item !== '' && item.toFixed(4) <= tracking.treshold.toFixed(4)).length;
            print += `✔️ ${lower} ${I18N.get('register')}${(lower > 1) ? 's' : ''} ${tracking.tresholdType} ${I18N.get('to')} ${tracking.treshold} (${(100 * lower / registers).toFixed(2)}%)\n`;
            print += `✖️ ${registers - lower} ${I18N.get('register')}${(registers - lower > 1) ? 's' : ''} ${I18N.get('tresholdTypes')[0]} ${I18N.get('to')} ${tracking.treshold} (${(100 * (registers - lower) / registers).toFixed(2)}%)\n`;
          }
          break;
        case I18N.get('types')[2]: // '🖊️ Texto'
          print += `🖊️ ${registers - empty} ${I18N.get('register')}${((registers - empty) > 1) ? 's' : ''} ${I18N.get('textAnswer')} (${(100 * (registers - empty) / registers).toFixed(2)}%)\n`;
          break;
        default:
          break;
      }
      print += `🚫 ${empty} ${I18N.get('register')}${(empty > 1) ? 's' : ''} ${I18N.get('noAnswer')} (${(100 * empty / registers).toFixed(2)}%)`;
    }
    log.add([`${this.constructor.name}.${Utils.method(this.printStats)}`, print], 2, DEBUG_RETURN);
    return print;
  }
}
