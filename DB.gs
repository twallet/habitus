const HABITUS_ID = 'XXX-MnRsngmHf08n79MtQ', REQUESTS_SHEET = 'Requests', USERS_SHEET = 'Users', CONFIGS_SHEET = 'Configs', TRACKINGS_SHEET = 'Trackings';
const TIMESTAMP = 'Timestamp', USER_ID = 'UserId', TRACKING_ID = 'TrackingId', TRACKING_QUESTION = 'TrackingQuestion', MESSAGE_ID = 'MessageId', REQUEST_RESPONSE = 'Response', USER_NAME = 'Name', USER_LANG = 'Lang', USER_COMMAND = 'Command', TRACKING_TYPE = 'Type', TRACKING_TRESHOLD = 'Treshold', TRACKING_TRESHOLD_TYPE = 'TresholdType', TRACKING_HOUR = 'Hour', TRACKING_MIN = 'Min', TRACKING_FREQUENCY = 'Frequency', TRACKING_DAYSMONTHS = 'DaysMonths', TRACKING_START = 'Start', TRACKING_END = 'End', TRACKING_NEXT = 'Next', TRACKING_STREAK = 'Streak', CONFIG_STEP = 'Step', REPORT_START = 'ReportStart', REPORT_END = 'ReportEnd';
var sheetsCache = {};

class DB {

  constructor() {
    this.dbSheet = SpreadsheetApp.openById(HABITUS_ID);
    this.userMap = { [USER_ID]: 0, [USER_NAME]: 1, [USER_LANG]: 2, [USER_COMMAND]: 3 };
    this.requestMap = { [TIMESTAMP]: 0, [USER_ID]: 1, [TRACKING_ID]: 2, [TRACKING_QUESTION]: 3, [MESSAGE_ID]: 4, [REQUEST_RESPONSE]: 5 };
    this.configMap = { [USER_ID]: 0, [CONFIG_STEP]: 1, [MESSAGE_ID]: 2, [TRACKING_QUESTION]: 3, [TRACKING_TYPE]: 4, [TRACKING_TRESHOLD]: 5, [TRACKING_TRESHOLD_TYPE]: 6, [TRACKING_HOUR]: 7, [TRACKING_MIN]: 8, [TRACKING_FREQUENCY]: 9, [TRACKING_DAYSMONTHS]: 10, [TRACKING_START]: 11, [TRACKING_END]: 12, [TRACKING_ID]: 13, [REPORT_START]: 14, [REPORT_END]: 15 };
    this.trackingMap = { [TRACKING_ID]: 0, [USER_ID]: 1, [TRACKING_QUESTION]: 2, [TRACKING_TYPE]: 3, [TRACKING_TRESHOLD]: 4, [TRACKING_TRESHOLD_TYPE]: 5, [TRACKING_HOUR]: 6, [TRACKING_MIN]: 7, [TRACKING_FREQUENCY]: 8, [TRACKING_DAYSMONTHS]: 9, [TRACKING_START]: 10, [TRACKING_END]: 11, [TRACKING_NEXT]: 12, [TRACKING_STREAK]: 13 };
  }

  getSheet(name) {
    try {
      if (!sheetsCache[name]) sheetsCache[name] = this.dbSheet.getSheetByName(name);
      return sheetsCache[name];
    } catch (error) {
      throw new Error(`[DB.getSheet(name=${name})] No se pudo obtener la hoja: ${error.message}`);
    }
  }

  /** USER */
  userExists(userId) {
    log.add([`${this.constructor.name}.${Utils.method(this.userExists)}`, userId], 4, DEBUG_START);
    const usersSheet = this.getSheet(USERS_SHEET);
    const dataSet = new Set(usersSheet.getRange(1, this.userMap[USER_ID] + 1, usersSheet.getLastRow(), 1).getValues().flat());
    const userExists = dataSet.has(userId);
    log.add([`${this.constructor.name}.${Utils.method(this.userExists)}`, userExists], 4, DEBUG_RETURN);
    return userExists;
  }

  getUser(userId) {
    log.add([`${this.constructor.name}.${Utils.method(this.getUser)}`, userId], 4, DEBUG_START);
    const data = this.getSheet(USERS_SHEET).getDataRange().getValues()
      .filter(row => (row[this.userMap[USER_ID]] == userId)).flat();
    var gotUser;
    if (data.length > 0) {
      gotUser = new User(data[this.userMap[USER_ID]], data[this.userMap[USER_NAME]], data[this.userMap[USER_LANG]], data[this.userMap[USER_COMMAND]]);
    } else {
      gotUser = null;
    }
    log.add([`${this.constructor.name}.${Utils.method(this.getUser)}`, gotUser], 4, DEBUG_RETURN);
    return gotUser;
  }

  saveUser(user) {
    log.add([`${this.constructor.name}.${Utils.method(this.saveUser)}`, user], 4, DEBUG_START);
    const sheet = this.getSheet(USERS_SHEET);
    const line = sheet.getRange(1, this.userMap[USER_ID] + 1, sheet.getLastRow()).getValues().flat().map(value => String(value)).indexOf(String(user.id)) + 1;
    if (line !== 0) {
      sheet.getRange(line, 1, 1, sheet.getLastColumn()).setValues([[user.id, user.name, user.lang, user.command]]);
    } else {
      sheet.appendRow([user.id, user.name, user.lang, user.command]);
    }
    log.add([`${this.constructor.name}.${Utils.method(this.saveUser)}`], 4, DEBUG_END);
  }

  /** REQUEST */
  addRequest(tracking, messageId) {
    log.add([`${this.constructor.name}.${Utils.method(this.addRequest)}`, tracking, messageId], 4, DEBUG_START);
    this.getSheet(REQUESTS_SHEET).appendRow([new Date(), tracking.user.id, tracking.id, tracking.question, messageId]);
    log.add([`${this.constructor.name}.${Utils.method(this.addRequest)}`], 4, DEBUG_END);
  }

  getRequest(messageId) {
    log.add([`${this.constructor.name}.${Utils.method(this.getRequest)}`, messageId], 4, DEBUG_START);
    const data = this.getSheet(REQUESTS_SHEET).getDataRange().getValues()
      .filter(row => (row[this.requestMap[MESSAGE_ID]] == messageId && row[this.requestMap[USER_ID]] == user.id)).flat();
    var newRequest;
    if (data.length > 0) {
      tracking = this.getTracking(data[this.requestMap[TRACKING_ID]]);
      newRequest = new Request(data[this.requestMap[TIMESTAMP]], data[this.requestMap[MESSAGE_ID]], data[this.requestMap[REQUEST_RESPONSE]]);
    } else {
      newRequest = null;
    }
    log.add([`${this.constructor.name}.${Utils.method(this.getRequest)}`, newRequest], 4, DEBUG_RETURN);
    return newRequest;
  }

  getPeriodResponses(tracking, start, end) {
    log.add([`${this.constructor.name}.${Utils.method(this.getPeriodResponses)}`, tracking, start, end], 4, DEBUG_START);
    const data = this.getSheet(REQUESTS_SHEET).getDataRange().getValues()
      .filter(row => (row[this.requestMap[TRACKING_ID]] == tracking.id
        && new Date(row[this.requestMap[TIMESTAMP]]).getTime() >= new Date(start).getTime()
        && new Date(row[this.requestMap[TIMESTAMP]]).getTime() <= new Date(end).getTime()));
    const responsesList = data.map(line => [line[this.requestMap[TIMESTAMP]], line[this.requestMap[REQUEST_RESPONSE]]]);
    log.add([`${this.constructor.name}.${Utils.method(this.getPeriodResponses)}`, responsesList], 4, DEBUG_RETURN);
    return responsesList;
  }

  getAllResponses(tracking) {
    log.add([`${this.constructor.name}.${Utils.method(this.getAllResponses)}`, tracking], 4, DEBUG_START);
    const data = this.getSheet(REQUESTS_SHEET).getDataRange().getValues()
      .filter(row => (row[this.requestMap[TRACKING_ID]] == tracking.id));
    const responsesList = data.map(line => [line[this.requestMap[TIMESTAMP]], line[this.requestMap[MESSAGE_ID]], line[this.requestMap[REQUEST_RESPONSE]]]);
    log.add([`${this.constructor.name}.${Utils.method(this.getAllResponses)}`, responsesList.length], 4, DEBUG_RETURN);
    return responsesList;
  }

  saveRequest(request) {
    log.add([`${this.constructor.name}.${Utils.method(this.saveRequest)}`, request], 4, DEBUG_START);
    const sheet = this.getSheet(REQUESTS_SHEET);
    const line = sheet.getRange(1, this.requestMap[MESSAGE_ID] + 1, sheet.getLastRow()).getValues().flat().map(value => String(value)).indexOf(String(request.messageId)) + 1;
    if (line !== 0) {
      sheet.getRange(line, 1, 1, sheet.getLastColumn()).setValues([[request.timestamp,
      request.tracking.user.id, request.tracking.id, request.tracking.question, request.messageId, request.response]]);
    }
    log.add([`${this.constructor.name}.${Utils.method(this.saveRequest)}`], 4, DEBUG_END);
  }

  deleteRequest(request) {
    log.add([`${this.constructor.name}.${Utils.method(this.deleteRequest)}`, request], 4, DEBUG_START);
    const sheet = this.getSheet(REQUESTS_SHEET);
    const line = sheet.getRange(1, this.requestMap[MESSAGE_ID] + 1, sheet.getLastRow()).getValues().flat().map(value => String(value)).indexOf(String(request.messageId)) + 1;
    if (line !== 0) sheet.deleteRow(line);
    log.add([`${this.constructor.name}.${Utils.method(this.deleteRequest)}`], 4, DEBUG_END);
  }

  /** TRACKING */
  getTrackings(user, options = null) { /** options = { onlyActive: Boolean, onlyArchived: Boolean } */
    log.add([`${this.constructor.name}.${Utils.method(this.getTrackings)}`, user, options], 4, DEBUG_START);
    const data = this.getSheet(TRACKINGS_SHEET).getDataRange().getValues().filter(row => (row[this.trackingMap[USER_ID]] == user.id));
    let trackings;
    if (options.onlyActive) {
      trackings = data.filter(row => user.id && row[this.trackingMap[TRACKING_NEXT]] !== '').map(line => [line[this.trackingMap[TRACKING_ID]], line[this.trackingMap[TRACKING_QUESTION]], line[this.trackingMap[TRACKING_STREAK]]]);
    } else if (options.onlyArchived) {
      trackings = data.filter(row => user.id && row[this.trackingMap[TRACKING_NEXT]] == '').map(line => [line[this.trackingMap[TRACKING_ID]], line[this.trackingMap[TRACKING_QUESTION]], line[this.trackingMap[TRACKING_STREAK]]]);
    }
    log.add([`${this.constructor.name}.${Utils.method(this.getTrackings)}`, trackings], 4, DEBUG_RETURN);
    return trackings;
  }

  // Obsoleto
  listActiveTrackings(user) {
    log.add([`${this.constructor.name}.${Utils.method(this.listActiveTrackings)}`, user], 4, DEBUG_START);
    const data = this.getSheet(TRACKINGS_SHEET).getDataRange().getValues()
      .filter(row => (row[this.trackingMap[USER_ID]] == user.id && row[this.trackingMap[TRACKING_NEXT]] !== ''));
    const activeTrackingsList = data.map(line => [line[this.trackingMap[TRACKING_ID]], line[this.trackingMap[TRACKING_QUESTION]]]);
    log.add([`${this.constructor.name}.${Utils.method(this.listActiveTrackings)}`, activeTrackingsList], 4, DEBUG_RETURN);
    return activeTrackingsList;
  }

  // Obsoleto
  listArchivedTrackings(user) {
    log.add([`${this.constructor.name}.${Utils.method(this.listArchivedTrackings)}`, user], 4, DEBUG_START);
    const data = this.getSheet(TRACKINGS_SHEET).getDataRange().getValues()
      .filter(row => (row[this.trackingMap[USER_ID]] == user.id && row[this.trackingMap[TRACKING_NEXT]] == ''));
    const archivedTrackingsList = data.map(line => [line[this.trackingMap[TRACKING_ID]], line[this.trackingMap[TRACKING_QUESTION]]]);
    log.add([`${this.constructor.name}.${Utils.method(this.listArchivedTrackings)}`, archivedTrackingsList], 4, DEBUG_RETURN);
    return archivedTrackingsList;
  }

  getTrackingsLength(user) {
    log.add([`${this.constructor.name}.${Utils.method(this.getTrackingsLength)}`, user], 4, DEBUG_START);
    const trackingsLength = this.getSheet(TRACKINGS_SHEET).getDataRange().getValues()
      .filter(row => (row[this.trackingMap[USER_ID]] == user.id)).length;
    log.add([`${this.constructor.name}.${Utils.method(this.getTrackingsLength)}`, trackingsLength], 4, DEBUG_RETURN);
    return trackingsLength;
  }

  getBatchTracking(trackingId) {
    log.add([`${this.constructor.name}.${Utils.method(this.getBatchTracking)}`, trackingId], 4, DEBUG_START);
    const data = this.getSheet(TRACKINGS_SHEET).getDataRange().getValues()
      .filter(row => (row[this.trackingMap[TRACKING_ID]] == trackingId)).flat();
    var batchTracking;
    if (data.length > 0) {
      const batchUser = this.getUser(data[this.trackingMap[USER_ID]]);
      batchTracking = new Tracking(trackingId, data[this.trackingMap[TRACKING_QUESTION]], data[this.trackingMap[TRACKING_TYPE]], data[this.trackingMap[TRACKING_TRESHOLD]], data[this.trackingMap[TRACKING_TRESHOLD_TYPE]], data[this.trackingMap[TRACKING_HOUR]], data[this.trackingMap[TRACKING_MIN]], data[this.trackingMap[TRACKING_FREQUENCY]], data[this.trackingMap[TRACKING_DAYSMONTHS]], data[this.trackingMap[TRACKING_START]], data[this.trackingMap[TRACKING_END]], data[this.trackingMap[TRACKING_NEXT]], data[this.trackingMap[TRACKING_STREAK]], batchUser);
    } else {
      batchTracking = null;
    }
    log.add([`${this.constructor.name}.${Utils.method(this.getBatchTracking)}`, batchTracking], 4, DEBUG_RETURN);
    return batchTracking;
  }

  getTracking(trackingId) {
    log.add([`${this.constructor.name}.${Utils.method(this.getTracking)}`, trackingId], 4, DEBUG_START);
    const data = this.getSheet(TRACKINGS_SHEET).getDataRange().getValues()
      .filter(row => (row[this.trackingMap[TRACKING_ID]] == trackingId)).flat();
    var newTracking;
    if (data.length > 0) {
      newTracking = new Tracking(trackingId, data[this.trackingMap[TRACKING_QUESTION]], data[this.trackingMap[TRACKING_TYPE]], data[this.trackingMap[TRACKING_TRESHOLD]], data[this.trackingMap[TRACKING_TRESHOLD_TYPE]], data[this.trackingMap[TRACKING_HOUR]], data[this.trackingMap[TRACKING_MIN]], data[this.trackingMap[TRACKING_FREQUENCY]], data[this.trackingMap[TRACKING_DAYSMONTHS]], data[this.trackingMap[TRACKING_START]], data[this.trackingMap[TRACKING_END]], data[this.trackingMap[TRACKING_NEXT]], data[this.trackingMap[TRACKING_STREAK]]);
    } else {
      newTracking = null;
    }
    log.add([`${this.constructor.name}.${Utils.method(this.getTracking)}`, newTracking], 4, DEBUG_RETURN);
    return newTracking;
  }

  saveTracking(tracking) {
    log.add([`${this.constructor.name}.${Utils.method(this.saveTracking)}`, tracking], 4, DEBUG_START);
    const sheet = this.getSheet(TRACKINGS_SHEET);
    const line = sheet.getRange(1, this.trackingMap[TRACKING_ID] + 1, sheet.getLastRow()).getValues().flat().map(value => String(value)).indexOf(String(tracking.id)) + 1;
    if (line !== 0) {
      sheet.getRange(line, 1, 1, sheet.getLastColumn()).setValues([[tracking.id, tracking.user.id, tracking.question, tracking.type, tracking.treshold, tracking.tresholdType, tracking.hour, tracking.min, tracking.frequency, tracking.daysMonths, tracking.start, tracking.end, tracking.next, tracking.streakRegisters]]);
    } else {
      sheet.appendRow([tracking.id, tracking.user.id, tracking.question, tracking.type, tracking.treshold, tracking.tresholdType, tracking.hour, tracking.min, tracking.frequency, tracking.daysMonths, tracking.start, tracking.end, tracking.next, tracking.streakRegisters]);
    }
    log.add([`${this.constructor.name}.${Utils.method(this.saveTracking)}`], 4, DEBUG_END);
  }

  duplicatedQuestion(user, question) {
    log.add([`${this.constructor.name}.${Utils.method(this.duplicatedQuestion)}`, user, question], 4, DEBUG_START);
    const data = this.getSheet(TRACKINGS_SHEET).getDataRange().getValues()
      .filter(row => (row[this.trackingMap[USER_ID]] == user.id && row[this.trackingMap[TRACKING_QUESTION]] == question));
    log.add([`${this.constructor.name}.${Utils.method(this.duplicatedQuestion)}`, data.length > 0], 4, DEBUG_RETURN);
    return (data.length > 0);
  }

  pendingTrackings() {
    log.add([`${this.constructor.name}.${Utils.method(this.pendingTrackings)}`], 4, DEBUG_START);
    const now = new Date();
    const pendingTrackings = this.getSheet(TRACKINGS_SHEET).getDataRange().getValues()
      .filter(line => new Date(line[this.trackingMap[TRACKING_NEXT]]) < now)
      .map(line => this.getBatchTracking(line[this.trackingMap[TRACKING_ID]]));
    log.add([`${this.constructor.name}.${Utils.method(this.pendingTrackings)}`, pendingTrackings], 4, DEBUG_RETURN);
    return pendingTrackings;
  }

  getFirstResponseDate(trackingId) {
    log.add([`${this.constructor.name}.${Utils.method(this.getFirstResponseDate)}`, trackingId], 4, DEBUG_START);
    const responses = this.getSheet(REQUESTS_SHEET).getDataRange().getValues().filter(line => line[this.requestMap[TRACKING_ID]] == trackingId);
    const firstDate = (responses.length > 0) ? responses[0][this.requestMap[TIMESTAMP]] : new Date();
    log.add([`${this.constructor.name}.${Utils.method(this.getFirstResponseDate)}`, firstDate], 4, DEBUG_RETURN);
    return firstDate;

  }

  /** CONFIG */
  getConfig(user) {
    log.add([`${this.constructor.name}.${Utils.method(this.getConfig)}`, user], 4, DEBUG_START);
    const sheet = this.getSheet(CONFIGS_SHEET);
    const line = sheet.getRange(1, this.configMap[USER_ID] + 1, sheet.getLastRow()).getValues().flat().map(value => String(value)).indexOf(String(user.id)) + 1;
    let gotConfig;
    if (line !== 0) {
      const values = sheet.getRange(line, 1, 1, sheet.getLastColumn()).getValues()[0];
      if (user.command == COMMANDS[0]) {
        gotConfig = new ConfigNew(user, values[this.configMap[CONFIG_STEP]], values[this.configMap[MESSAGE_ID]], values[this.configMap[TRACKING_QUESTION]],
          values[this.configMap[TRACKING_TYPE]], values[this.configMap[TRACKING_TRESHOLD]], values[this.configMap[TRACKING_TRESHOLD_TYPE]], values[this.configMap[TRACKING_HOUR]],
          values[this.configMap[TRACKING_MIN]], values[this.configMap[TRACKING_FREQUENCY]], values[this.configMap[TRACKING_DAYSMONTHS]], values[this.configMap[TRACKING_START]],
          values[this.configMap[TRACKING_END]]);
      } else if (user.command == COMMANDS[1]) {
        gotConfig = new ConfigEdit(user, values[this.configMap[CONFIG_STEP]], values[this.configMap[MESSAGE_ID]], values[this.configMap[TRACKING_ID]], values[this.configMap[TRACKING_FREQUENCY]], values[this.configMap[TRACKING_DAYSMONTHS]]);
      } else if (user.command == COMMANDS[2]) {
        gotConfig = new ConfigProgress(user, values[this.configMap[CONFIG_STEP]], values[this.configMap[MESSAGE_ID]], values[this.configMap[TRACKING_ID]], values[this.configMap[TRACKING_QUESTION]], values[this.configMap[REPORT_START]], values[this.configMap[REPORT_END]]);
      }
      else {
        gotConfig = null;
      }
      log.add([`${this.constructor.name}.${Utils.method(this.getConfig)}`, gotConfig], 4, DEBUG_RETURN);
      return gotConfig;
    }
  }

  saveConfig(config) {
    log.add([`${this.constructor.name}.${Utils.method(this.saveConfig)}`, config], 4, DEBUG_START);
    const sheet = this.getSheet(CONFIGS_SHEET);
    const line = sheet.getRange(1, this.configMap[USER_ID] + 1, sheet.getLastRow()).getValues().flat().map(value => String(value)).indexOf(String(config.user.id)) + 1;
    if (line !== 0) {
      sheet.getRange(line, 1, 1, sheet.getLastColumn()).setValues([[config.user.id, config.step, config.messageId, config.question, config.type, config.treshold, config.tresholdType, config.hour, config.min, config.frequency, config.daysMonths, config.start, config.end, config.trackingId, config.reportStart, config.reportEnd]]);
    } else {
      sheet.appendRow([config.user.id, config.step, config.messageId, config.question, config.type, config.treshold, config.tresholdType, config.hour, config.min, config.frequency, config.daysMonths, config.start, config.end, config.trackingId, config.reportStart, config.reportEnd]);
    }
    log.add([`${this.constructor.name}.${Utils.method(this.saveConfig)}`], 4, DEBUG_END);
  }
}
