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
    // Approach: Use a reference UTC time (noon) on the target date to calculate
    // the offset between UTC and the target timezone at that specific date
    // (accounting for DST). Then apply that offset to convert the desired local time to UTC.
    const referenceUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

    // Get what noon UTC looks like in the target timezone
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const referenceParts = formatter.formatToParts(referenceUtc);
    const refLocalHour = parseInt(
      referenceParts.find((p) => p.type === "hour")!.value
    );
    const refLocalMin = parseInt(
      referenceParts.find((p) => p.type === "minute")!.value
    );

    // Calculate offset: if 12:00 UTC shows as refLocalHour:refLocalMin in timezone,
    // then the timezone offset is (12:00 - refLocalHour:refLocalMin)
    // This tells us how many hours the timezone is behind UTC
    const offsetHours = 12 - refLocalHour;
    const offsetMinutes = 0 - refLocalMin;
    const offsetMs = (offsetHours * 60 + offsetMinutes) * 60 * 1000;

    // Create the target date/time as if it were in UTC
    const targetAsUtc = new Date(
      Date.UTC(year, month - 1, day, hour, minutes, 0)
    );

    // Apply the offset: to convert FROM local time TO UTC, we ADD the offset
    // (if timezone is UTC-3, we add 3 hours to local time to get UTC)
    const result = new Date(targetAsUtc.getTime() + offsetMs);

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
