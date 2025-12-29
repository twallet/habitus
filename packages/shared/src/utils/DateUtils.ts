/**
 * Centralized date/time utilities that respect user locale and timezone.
 * Follows OOP principles by organizing related formatting methods in a class.
 * @public
 */
export class DateUtils {
  /**
   * Format date/time using user's locale and timezone.
   * @param dateTime - ISO datetime string (UTC)
   * @param locale - User locale (default: 'en-US')
   * @param timezone - User timezone (optional, uses system default if not provided)
   * @param options - Intl.DateTimeFormatOptions
   * @returns Formatted date/time string
   * @public
   */
  static formatDateTime(
    dateTime: string,
    locale: string = "en-US",
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
   * @param locale - User locale (default: 'en-US')
   * @param timezone - User timezone (optional)
   * @param options - Intl.DateTimeFormatOptions
   * @returns Formatted date string
   * @public
   */
  static formatDate(
    dateTime: string,
    locale: string = "en-US",
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
   * @param locale - User locale (default: 'en-US')
   * @param timezone - User timezone (optional)
   * @param options - Intl.DateTimeFormatOptions
   * @returns Formatted time string
   * @public
   */
  static formatTime(
    dateTime: string,
    locale: string = "en-US",
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

    // Create a date string representing the local time in the target timezone
    // We'll use a workaround: create a date in UTC that represents the same
    // wall-clock time, then adjust for the timezone offset
    const dateTimeString = `${year}-${String(month).padStart(2, "0")}-${String(
      day
    ).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(
      minutes
    ).padStart(2, "0")}:00`;

    // Create a temporary date to determine the timezone offset
    // We create it as if it's in UTC, then we'll adjust
    const tempDate = new Date(`${dateTimeString}Z`);

    // Get what this UTC time would be in the target timezone
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZoneName: "longOffset",
    });

    const parts = formatter.formatToParts(tempDate);
    const tzYear = parseInt(parts.find((p) => p.type === "year")!.value);
    const tzMonth = parseInt(parts.find((p) => p.type === "month")!.value);
    const tzDay = parseInt(parts.find((p) => p.type === "day")!.value);
    const tzHour = parseInt(parts.find((p) => p.type === "hour")!.value);
    const tzMinute = parseInt(parts.find((p) => p.type === "minute")!.value);

    // Calculate the offset: how much we need to adjust the UTC time
    // to get the desired local time in the target timezone
    const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minutes, 0));
    const tzDate = new Date(
      Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute, 0)
    );
    const offset = utcDate.getTime() - tzDate.getTime();

    // Apply the offset to get the correct UTC time
    const result = new Date(utcDate.getTime() - offset);
    return result.toISOString();
  }

  /**
   * Get user's default locale from browser/system.
   * @returns Default locale string (e.g., 'en-US')
   * @public
   */
  static getDefaultLocale(): string {
    if (typeof navigator !== "undefined" && navigator.language) {
      return navigator.language;
    }
    return "en-US";
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
