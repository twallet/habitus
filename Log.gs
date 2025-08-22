const LOG_LEVEL = 1, LOG_SHEET = 'Log', DEBUG_SYMBOL = '🐞', LOG = 'Log', DEBUG_START = '➡️', DEBUG_NEW = '🆕', DEBUG_RETURN = '📦', DEBUG_END = '⬅️', LOG_LIMIT = 50, START_SYMBOL = '🟩🟩🟩', END_SYMBOL = '⏹️⏹️⏹️';

class Log {

  constructor() {
    this.lines = [];
    this.indent = 1;
  }

  add(array, level, logType = null) {
    if (level <= LOG_LEVEL) {
      var symbols = '';
      if (logType !== null) {
        if (logType === DEBUG_END || logType === DEBUG_RETURN) this.indent--;
        symbols = `${DEBUG_SYMBOL}${logType.repeat(this.indent)}`;
        if (logType === DEBUG_START || logType === DEBUG_NEW) this.indent++;
      } else {
        symbols = (user == null) ? 'No User' : user.id;
      }
      const line = [new Date(), symbols, ...array].slice(0, LOG_LIMIT);
      var fillArray = [];
      if (line.length < LOG_LIMIT) fillArray = Array(LOG_LIMIT - line.length).fill('');
      this.lines.push([...line, ...fillArray]);
    }
  }

  write() {
    if (this.lines.length > 0) {
      const header = Array(LOG_LIMIT).fill(START_SYMBOL);
      header[0] = new Date();
      header[1] = `${START_SYMBOL} LOG STARTS`;
      const footer = Array(LOG_LIMIT).fill(END_SYMBOL);
      footer[0] = new Date();
      footer[1] = `${END_SYMBOL} LOG ENDS`;
      const dataToWrite = [footer];
      dataToWrite.push(...[...this.lines].reverse());
      dataToWrite.push(header);
      const logSheet = SpreadsheetApp.openById(HABITUS_ID).getSheetByName(LOG_SHEET);
      logSheet.insertRows(1, dataToWrite.length);
      logSheet.getRange(1, 1, dataToWrite.length, LOG_LIMIT).setValues(dataToWrite);
    }
  }
}
