/**
 * Centralized date/time utilities that respect user locale and timezone.
 * Follows OOP principles by organizing related formatting methods in a class.
 * @public
 */
export class DateUtils {
  /**
   * Format date/time using user's locale and timezone.
   * @param dateTime - ISO datetime string (UTC)
   * @param locale - User locale (default: 'es-AR')
   * @param timezone - User timezone (optional, uses system default if not provided)
   * @param options - Intl.DateTimeFormatOptions
   * @returns Formatted date/time string
   * @public
   */
  static formatDateTime(
    dateTime: string,
    locale: string = "es-AR",
    timezone?: string,
    options?: Intl.DateTimeFormatOptions
  ): string {
    const date = new Date(dateTime);
    if (isNaN(date.getTime())) {
      return dateTime; // Return original if invalid
    }

    const formatOptions: Intl.DateTimeFormatOptions = {
      ...options,
    };

    if (timezone) {
      formatOptions.timeZone = timezone;
    }

    return date.toLocaleString(locale, formatOptions);
  }

  /**
   * Format date only using user's locale.
   * @param dateTime - ISO datetime string (UTC)
   * @param locale - User locale (default: 'es-AR')
   * @param timezone - User timezone (optional)
   * @param options - Intl.DateTimeFormatOptions
   * @returns Formatted date string
   * @public
   */
  static formatDate(
    dateTime: string,
    locale: string = "es-AR",
    timezone?: string,
    options?: Intl.DateTimeFormatOptions
  ): string {
    return this.formatDateTime(dateTime, locale, timezone, {
      year: "numeric",
      month: "short",
      day: "numeric",
      ...options,
    });
  }

  /**
   * Format time only using user's locale.
   * @param dateTime - ISO datetime string (UTC)
   * @param locale - User locale (default: 'es-AR')
   * @param timezone - User timezone (optional)
   * @param options - Intl.DateTimeFormatOptions
   * @returns Formatted time string
   * @public
   */
  static formatTime(
    dateTime: string,
    locale: string = "es-AR",
    timezone?: string,
    options?: Intl.DateTimeFormatOptions
  ): string {
    return this.formatDateTime(dateTime, locale, timezone, {
      hour: "2-digit",
      minute: "2-digit",
      ...options,
    });
  }

  /**
   * Create UTC datetime from date string and time in user's timezone.
   * Used for one-time tracking creation.
   * @param dateStr - YYYY-MM-DD format
   * @param hour - Hour (0-23)
   * @param minutes - Minutes (0-59)
   * @param timezone - User timezone (default: UTC)
   * @returns ISO datetime string in UTC
   * @public
   */
  static createDateTimeInTimezone(
    dateStr: string,
    hour: number,
    minutes: number,
    timezone?: string
  ): string {
    // Parse date components
    const [year, month, day] = dateStr.split("-").map(Number);

    if (!timezone) {
      // If no timezone provided, create date in UTC
      const date = new Date(Date.UTC(year, month - 1, day, hour, minutes, 0));
      return date.toISOString();
    }

    // Strategy: We need to find what UTC time corresponds to the given
    // wall-clock time (year, month, day, hour, minutes) in the target timezone.
    //
    // Approach: Create a date at noon UTC on the target date, then see what
    // that is in the target timezone. Use that to calculate the offset.
    const noonUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

    // Get what noon UTC is in the target timezone
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const parts = formatter.formatToParts(noonUtc);
    const tzYear = parseInt(parts.find((p) => p.type === "year")!.value);
    const tzMonth = parseInt(parts.find((p) => p.type === "month")!.value);
    const tzDay = parseInt(parts.find((p) => p.type === "day")!.value);
    const tzHour = parseInt(parts.find((p) => p.type === "hour")!.value);
    const tzMinute = parseInt(parts.find((p) => p.type === "minute")!.value);

    // Calculate offset: difference between UTC noon and what it shows in target timezone
    const tzNoon = new Date(
      Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute, 0)
    );
    const offset = noonUtc.getTime() - tzNoon.getTime();

    // Now create the target date/time in UTC
    const targetUtc = new Date(
      Date.UTC(year, month - 1, day, hour, minutes, 0)
    );

    // Apply the offset to get the correct UTC time
    // If timezone is ahead of UTC (positive offset), we subtract to get correct UTC
    const result = new Date(targetUtc.getTime() - offset);
    return result.toISOString();
  }

  /**
   * Get user's default locale from browser/system.
   * @returns Default locale string (e.g., 'es-AR')
   * @public
   */
  static getDefaultLocale(): string {
    if (typeof navigator !== "undefined" && navigator.language) {
      return navigator.language;
    }
    return "es-AR";
  }

  /**
   * Get user's default timezone from browser/system.
   * @returns Default timezone string (e.g., 'America/New_York')
   * @public
   */
  static getDefaultTimezone(): string {
    if (typeof Intl !== "undefined" && Intl.DateTimeFormat) {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
    return "UTC";
  }
}
