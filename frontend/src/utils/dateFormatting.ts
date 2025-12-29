import { DateUtils } from "@habitus/shared/utils";
import { UserData } from "../models/User";

/**
 * Format date/time using user's preferences.
 * Falls back to browser defaults if user preferences not available.
 * @param dateTime - ISO datetime string
 * @param user - User data (optional, falls back to browser locale)
 * @returns Formatted date and time string
 * @public
 */
export function formatUserDateTime(
  dateTime: string,
  user?: UserData | null
): string {
  const locale = user?.locale || DateUtils.getDefaultLocale();
  const timezone = user?.timezone || DateUtils.getDefaultTimezone();

  const dateStr = DateUtils.formatDate(dateTime, locale, timezone);
  const timeStr = DateUtils.formatTime(dateTime, locale, timezone);
  return `${dateStr} ${timeStr}`;
}

/**
 * Format date only using user's preferences.
 * @param dateTime - ISO datetime string
 * @param user - User data (optional, falls back to browser locale)
 * @returns Formatted date string
 * @public
 */
export function formatUserDate(
  dateTime: string,
  user?: UserData | null
): string {
  const locale = user?.locale || DateUtils.getDefaultLocale();
  const timezone = user?.timezone || DateUtils.getDefaultTimezone();
  return DateUtils.formatDate(dateTime, locale, timezone);
}

/**
 * Format time only using user's preferences.
 * @param dateTime - ISO datetime string
 * @param user - User data (optional, falls back to browser locale)
 * @returns Formatted time string
 * @public
 */
export function formatUserTime(
  dateTime: string,
  user?: UserData | null
): string {
  const locale = user?.locale || DateUtils.getDefaultLocale();
  const timezone = user?.timezone || DateUtils.getDefaultTimezone();
  return DateUtils.formatTime(dateTime, locale, timezone);
}
