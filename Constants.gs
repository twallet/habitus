const BOT_TOKEN = '7911112689:AAHOg9zV9zOEBJfmaBkN7ElvKy73nOn7TDs';
const TELEGRAM_URL = 'https://api.telegram.org/bot' + BOT_TOKEN;
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbw-N7K9T_mCZGskPyHq81R36zKIO6iPXIFe-A9KrU59Ysl7Traw3CLDwHOGxtlJjAcf/exec';
const MESSAGE_MAX_SIZE = 4096;
const TOAST_MAX_SIZE = 199;
const BOT_ID = 7911112689;
const EMAIL = 'twallet@gmail.com';
const LAST_VALUES_SIZE = 10;

/** I18N neutral values */
const YES_V = '🟢', NO_V = '🔘', NEVER_V = '♻️';

/** Options and commands */
const COMMANDS = ['/new', '/edit', '/progress'];
const CONFIG_MAP = { [COMMANDS[0]]: ConfigNew, [COMMANDS[1]]: ConfigEdit, [COMMANDS[2]]: ConfigProgress };
const SNOOZE_OPTIONS = ['Snooze15min', 'Snooze30min', 'Snooze1h', 'Snooze3h', 'Snooze24h', 'Snooze7d'];
const SNOOZE_TIMES = { 'Snooze15min': 900000, 'Snooze30min': 1800000,'Snooze1h': 3600000, 'Snooze3h': 10800000, 'Snooze24h': 86400000, 'Snooze7d': 604800000 };

/** Button Callback Data */
const BACK_KEY = 'back', CANCEL_KEY = 'cancel', FINISH_KEY = 'finish', SAVE_KEY = 'save', RESPONSE_KEY = 'resp', BOOLEAN_KEY = 'bool', SNOOZE_KEY = 'snooze', SNOOZED_KEY = 'snoozed', ARCHIVED_KEY = 'archive', TRACKING_KEY = 'tracking', EDIT_QUESTION_KEY = 'edQuest', EDIT_TRESHOLD_KEY = 'edTres', EDIT_TRESHOLD_TYPE_KEY = 'edTreTy', EDIT_HOUR_KEY = 'edHour', EDIT_FREQUENCY_KEY = 'edFreq', EDIT_DAYS_MONTHS_KEY = 'edDM', EDIT_START_KEY = 'edStart', EDIT_END_KEY = 'edEnd', EDIT_ARCHIVE_KEY = 'edArch', EDIT_RESTORE_KEY = 'edRest', PERIOD_KEY = 'period', CUSTOM_KEY = 'custom', PERIOD_START_KEY = 'cusStaK', PERIOD_END_KEY = 'cusEndK';

/** Steps */
const NEW = 'new:start', NEW_QUESTION = 'new:question', NEW_TYPE = 'new:type', NEW_TRESHOLD = 'new:treshold', NEW_TRESHOLD_TYPE = 'new:tresholdType', NEW_HOUR = 'new:hour', NEW_MONITOR_START = 'new:monitorStart', NEW_MONITOR_END = 'new:monitorEnd', NEW_FREQUENCY = 'new:frequency', NEW_WEEKLY_DAYS = 'new:weeklyDays', NEW_MONTHLY_DAYS = 'new:monthlyDays', NEW_YEARLY_MONTHS = 'new:yearlyMonths', NEW_CONFIRMATION = 'new:confirmation';

const EDIT = 'edit:start', EDIT_ARCHIVED = 'edit:archived', EDIT_TRACKING = 'edit:tracking', EDIT_QUESTION = 'edit:question', EDIT_HOUR = 'edit:hour', EDIT_START = 'edit:startDate', EDIT_END = 'edit:endDate', EDIT_FREQUENCY = 'edit:frequency', EDIT_TRESHOLD = 'edit:treshold', EDIT_TRESHOLD_TYPE = 'edit:tresholdType', EDIT_WEEKLY_DAYS = 'edit:weeklyDays', EDIT_MONTHLY_DAYS = 'edit:monthlyDays', EDIT_YEARLY_MONTHS = 'edit:yearlyMonths';

const PROGRESS = 'progress:start', PROGRESS_ARCHIVED = 'progress:archived', PROGRESS_TRACKING = 'progress:tracking', PROGRESS_CUSTOM = 'progress:custom', PROGRESS_CUSTOM_END = 'progress:customEnd';
