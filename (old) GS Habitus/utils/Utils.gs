class Utils {

  static isValidFloat(value) {
    if (/^-?\d+(,\d+)?$/.test(value)) {
      return !isNaN(parseFloat(value));
    } else {
      return false;
    }
  }

  static method(text) {
    return text.toString().substring(0, text.toString().indexOf('{'));
  }

  static truncateString(inputString, max) {
    return (inputString.length > max) ? inputString.substring(0, max) : inputString;
  }

  static formatDate(date) {
    return (date !== null) ? `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`: '';
  }

  static formatDateToDDMMYYYYHHMM(date) {
    const day = ('0' + date.getDate()).slice(-2);
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const year = date.getFullYear();
    const hours = ('0' + date.getHours()).slice(-2);
    const minutes = ('0' + date.getMinutes()).slice(-2);
    return day + '/' + month + '/' + year + ' ' + hours + ':' + minutes;
  }

  static validateHour(timeString) {
    if (/^([01]\d|2[0-3]):([0-5]\d)$/.test(timeString)) {
      return timeString;
    }
    const parts = timeString.split(':');
    if (parts.length !== 2) {
      return -1;
    }
    let [hours, minutes] = parts;
    hours = parseInt(hours, 10);
    minutes = parseInt(minutes, 10);
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return -1;
    }
    const normalizedHours = hours.toString().padStart(2, '0');
    const normalizedMinutes = minutes.toString().padStart(2, '0');
    return `${normalizedHours}:${normalizedMinutes}`;
  }

  static sort(orderArray, arrayToSort) {
    const orderMap = new Map();
    orderArray.forEach((element, index) => {
      orderMap.set(element, index);
    });
    arrayToSort.sort((a, b) => {
      const indexA = orderMap.get(a);
      const indexB = orderMap.get(b);
      return (indexA !== undefined ? indexA : Infinity) - (indexB !== undefined ? indexB : Infinity);
    });
    return arrayToSort;
  }

  static htmlTagsBalanceCheck(text) {
    if (text) {
      var matches = text.match(/<b>/g);
      const openingBold = matches ? matches.length : 0;
      matches = text.match(/<\/b>/g);
      const closingBold = matches ? matches.length : 0;
      if (openingBold !== closingBold) {
        throw new Error(`Bold HTML tags unbalanced in: ${text}`);
      }
      var matches = text.match(/<i>/g);
      const openingItalic = matches ? matches.length : 0;
      matches = text.match(/<\/i>/g);
      const closingItalic = matches ? matches.length : 0;
      if (openingItalic !== closingItalic) {
        throw new Error(`Italic HTML tags unbalanced in: ${text}`);
      }
    }
  }
}
