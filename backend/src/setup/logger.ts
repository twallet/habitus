/**
 * Log levels supported by the application.
 * @public
 */
export enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    VERBOSE = 3,
    DEBUG = 4,
}

/**
 * Logger utility class for centralized logging with level filtering.
 * Follows object-oriented principles and provides methods for different log levels.
 * @public
 */
export class Logger {
    private static level: LogLevel = Logger.initializeLogLevel();

    /**
     * Initialize log level based on environment variables.
     * Default to INFO (2) in production and VERBOSE (3) in development.
     * Logic:
     * 1. Check LOG_LEVEL env var (numeric or string name)
     * 2. If VERBOSE_LOGGING=true, use VERBOSE
     * 3. Fallback to defaults based on NODE_ENV
     * @returns The resolved LogLevel
     * @private
     */
    private static initializeLogLevel(): LogLevel {
        const isProduction = process.env.NODE_ENV === "production";
        const envLevel = process.env.LOG_LEVEL;

        if (envLevel) {
            // Check if it's a numeric value
            const numericLevel = parseInt(envLevel, 10);
            if (!isNaN(numericLevel) && numericLevel >= 0 && numericLevel <= 4) {
                return numericLevel as LogLevel;
            }

            // Check if it's a string name
            const upperLevel = envLevel.toUpperCase();
            if (upperLevel in LogLevel) {
                return (LogLevel as any)[upperLevel];
            }
        }

        // Legacy support for VERBOSE_LOGGING
        if (process.env.VERBOSE_LOGGING === "true") {
            return LogLevel.VERBOSE;
        }

        return isProduction ? LogLevel.INFO : LogLevel.VERBOSE;
    }

    /**
     * Set log level at runtime.
     * @param level - The new LogLevel to set
     * @public
     */
    static setLevel(level: LogLevel): void {
        this.level = level;
    }

    /**
     * Get current log level.
     * @returns Current LogLevel
     * @public
     */
    static getLevel(): LogLevel {
        return this.level;
    }

    /**
     * Internal formatted log method.
     * @param level - Level of the log entry
     * @param message - Main log message
     * @param args - Additional data to log
     * @private
     */
    private static log(level: LogLevel, message: string, ...args: any[]): void {
        if (level <= this.level) {
            const timestamp = new Date().toISOString();
            const levelName = LogLevel[level].padEnd(7);
            const prefix = `[${timestamp}] ${levelName} |`;

            if (level === LogLevel.ERROR) {
                console.error(prefix, message, ...args);
            } else if (level === LogLevel.WARN) {
                console.warn(prefix, message, ...args);
            } else {
                console.log(prefix, message, ...args);
            }
        }
    }

    /**
     * Log an error message.
     * @param message - Error message
     * @param args - Additional context or Error object
     * @public
     */
    static error(message: string, ...args: any[]): void {
        this.log(LogLevel.ERROR, message, ...args);
    }

    /**
     * Log a warning message.
     * @param message - Warning message
     * @param args - Additional context
     * @public
     */
    static warn(message: string, ...args: any[]): void {
        this.log(LogLevel.WARN, message, ...args);
    }

    /**
     * Log an informational message.
     * @param message - Info message
     * @param args - Additional context
     * @public
     */
    static info(message: string, ...args: any[]): void {
        this.log(LogLevel.INFO, message, ...args);
    }

    /**
     * Log a verbose message (useful for tracing operations).
     * @param message - Verbose message
     * @param args - Additional context
     * @public
     */
    static verbose(message: string, ...args: any[]): void {
        this.log(LogLevel.VERBOSE, message, ...args);
    }

    /**
     * Log a debug message (high frequency, detailed data).
     * @param message - Debug message
     * @param args - Additional context
     * @public
     */
    static debug(message: string, ...args: any[]): void {
        this.log(LogLevel.DEBUG, message, ...args);
    }
}
