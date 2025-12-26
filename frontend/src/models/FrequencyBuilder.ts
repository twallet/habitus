import { Frequency } from "./Tracking";

/**
 * Frequency preset type for simplified selection.
 * @public
 */
export type FrequencyPreset =
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "one-time";

/**
 * Builder class for creating and managing frequency patterns.
 * Handles pattern building, validation, and preset detection using OOP principles.
 * @public
 */
export class FrequencyBuilder {
  private preset: FrequencyPreset;
  private selectedDays: number[];
  private monthlyDay: number;
  private monthlyType: "day" | "last" | "weekday";
  private weekday: number;
  private ordinal: number;
  private yearlyMonth: number;
  private yearlyDay: number;
  private oneTimeDate: string;

  /**
   * Create a new FrequencyBuilder instance.
   * @param value - Optional existing frequency to initialize from
   * @public
   */
  constructor(value?: Frequency) {
    this.preset = value ? this.detectPresetFromFrequency(value) : "daily";
    this.selectedDays = value?.type === "weekly" ? value.days || [1] : [1]; // Default to Monday for weekly
    this.monthlyDay =
      value?.type === "monthly" && value.kind === "day_number"
        ? value.day_numbers?.[0] || 1
        : 1;
    this.monthlyType =
      value?.type === "monthly" && value.kind === "last_day"
        ? "last"
        : value?.type === "monthly" && value.kind === "weekday_ordinal"
        ? "weekday"
        : "day";
    this.weekday =
      value?.type === "monthly" || value?.type === "yearly"
        ? value.weekday || 1
        : 1; // Monday by default
    this.ordinal =
      value?.type === "monthly" || value?.type === "yearly"
        ? value.ordinal || 1
        : 1;
    this.yearlyMonth =
      value?.type === "yearly" && value.kind === "date" ? value.month || 1 : 1;
    this.yearlyDay =
      value?.type === "yearly" && value.kind === "date" ? value.day || 1 : 1;
    this.oneTimeDate =
      value?.type === "one-time"
        ? value.date
        : new Date().toISOString().split("T")[0];
  }

  /**
   * Get the current preset.
   * @returns Current frequency preset
   * @public
   */
  getPreset(): FrequencyPreset {
    return this.preset;
  }

  /**
   * Set the frequency preset.
   * @param preset - The preset to set
   * @public
   */
  setPreset(preset: FrequencyPreset): void {
    this.preset = preset;
    // Set default values when switching presets
    if (preset === "weekly" && this.selectedDays.length === 0) {
      this.selectedDays = [1]; // Default to Monday
    }
    if (preset === "one-time" && !this.oneTimeDate) {
      this.oneTimeDate = new Date().toISOString().split("T")[0];
    }
  }

  /**
   * Get selected days of week.
   * @returns Array of selected day numbers (0-6)
   * @public
   */
  getSelectedDays(): number[] {
    return [...this.selectedDays];
  }

  /**
   * Set selected days of week.
   * @param days - Array of day numbers (0-6)
   * @public
   */
  setSelectedDays(days: number[]): void {
    this.selectedDays = [...days];
  }

  /**
   * Toggle a day of week in selection.
   * @param dayValue - Day value to toggle (0-6)
   * @public
   */
  toggleDay(dayValue: number): void {
    if (this.selectedDays.includes(dayValue)) {
      this.selectedDays = this.selectedDays.filter((d) => d !== dayValue);
    } else {
      this.selectedDays = [...this.selectedDays, dayValue];
    }
  }

  /**
   * Get monthly day.
   * @returns Current monthly day number
   * @public
   */
  getMonthlyDay(): number {
    return this.monthlyDay;
  }

  /**
   * Set monthly day.
   * @param day - Day number to set
   * @public
   */
  setMonthlyDay(day: number): void {
    this.monthlyDay = day;
  }

  /**
   * Get monthly type.
   * @returns Current monthly type
   * @public
   */
  getMonthlyType(): "day" | "last" | "weekday" {
    return this.monthlyType;
  }

  /**
   * Set monthly type.
   * @param type - Monthly type to set
   * @public
   */
  setMonthlyType(type: "day" | "last" | "weekday"): void {
    this.monthlyType = type;
  }

  /**
   * Get weekday.
   * @returns Current weekday (0-6)
   * @public
   */
  getWeekday(): number {
    return this.weekday;
  }

  /**
   * Set weekday.
   * @param weekday - Weekday to set (0-6)
   * @public
   */
  setWeekday(weekday: number): void {
    this.weekday = weekday;
  }

  /**
   * Get ordinal.
   * @returns Current ordinal (1-5)
   * @public
   */
  getOrdinal(): number {
    return this.ordinal;
  }

  /**
   * Set ordinal.
   * @param ordinal - Ordinal to set (1-5)
   * @public
   */
  setOrdinal(ordinal: number): void {
    this.ordinal = ordinal;
  }

  /**
   * Get yearly month.
   * @returns Current yearly month (1-12)
   * @public
   */
  getYearlyMonth(): number {
    return this.yearlyMonth;
  }

  /**
   * Set yearly month.
   * @param month - Month to set (1-12)
   * @public
   */
  setYearlyMonth(month: number): void {
    this.yearlyMonth = month;
    // Adjust day if it's invalid for the new month
    const maxDays = this.getMaxDaysInMonth(month);
    if (this.yearlyDay > maxDays) {
      this.yearlyDay = maxDays;
    }
  }

  /**
   * Get yearly day.
   * @returns Current yearly day (1-31)
   * @public
   */
  getYearlyDay(): number {
    return this.yearlyDay;
  }

  /**
   * Set yearly day.
   * @param day - Day to set (1-31)
   * @public
   */
  setYearlyDay(day: number): void {
    const maxDays = this.getMaxDaysInMonth(this.yearlyMonth);
    // Clamp day to valid range for the current month
    this.yearlyDay = Math.min(Math.max(day, 1), maxDays);
  }

  /**
   * Get one-time date.
   * @returns Current one-time date (YYYY-MM-DD format)
   * @public
   */
  getOneTimeDate(): string {
    return this.oneTimeDate;
  }

  /**
   * Set one-time date.
   * @param date - Date to set (YYYY-MM-DD format)
   * @public
   */
  setOneTimeDate(date: string): void {
    this.oneTimeDate = date;
  }

  /**
   * Get the maximum number of days in a given month.
   * @param month - Month number (1-12)
   * @returns Maximum number of days in the month
   * @private
   */
  private getMaxDaysInMonth(month: number): number {
    // Months with 31 days: January, March, May, July, August, October, December
    if ([1, 3, 5, 7, 8, 10, 12].includes(month)) {
      return 31;
    }
    // Months with 30 days: April, June, September, November
    if ([4, 6, 9, 11].includes(month)) {
      return 30;
    }
    // February: 28 days (not handling leap years for simplicity)
    return 28;
  }

  /**
   * Detect preset from a frequency.
   * @param frequency - Frequency to analyze
   * @returns Detected preset type
   * @public
   */
  detectPresetFromFrequency(frequency: Frequency): FrequencyPreset {
    if (frequency.type === "daily") {
      return "daily";
    }

    if (frequency.type === "weekly") {
      return "weekly";
    }

    if (frequency.type === "monthly") {
      return "monthly";
    }

    if (frequency.type === "yearly") {
      return "yearly";
    }

    if (frequency.type === "one-time") {
      return "one-time";
    }

    // Default to daily
    return "daily";
  }

  /**
   * Build frequency from current builder state.
   * Always returns a frequency (mandatory field).
   * @returns Built frequency
   * @throws Error if validation fails
   * @public
   */
  buildFrequency(): Frequency {
    if (this.preset === "daily") {
      return { type: "daily" };
    }

    if (this.preset === "weekly") {
      if (this.selectedDays.length === 0) {
        throw new Error("Please select at least one day of the week");
      }
      return {
        type: "weekly",
        days: [...this.selectedDays].sort((a, b) => a - b),
      };
    }

    if (this.preset === "monthly") {
      if (this.monthlyType === "day") {
        return {
          type: "monthly",
          kind: "day_number",
          day_numbers: [this.monthlyDay],
        };
      }
      if (this.monthlyType === "last") {
        return {
          type: "monthly",
          kind: "last_day",
        };
      }
      if (this.monthlyType === "weekday") {
        return {
          type: "monthly",
          kind: "weekday_ordinal",
          weekday: this.weekday,
          ordinal: this.ordinal,
        };
      }
    }

    if (this.preset === "yearly") {
      return {
        type: "yearly",
        kind: "date",
        month: this.yearlyMonth,
        day: this.yearlyDay,
      };
    }

    if (this.preset === "one-time") {
      if (!this.oneTimeDate) {
        throw new Error("One-time date is required");
      }
      return {
        type: "one-time",
        date: this.oneTimeDate,
      };
    }

    // Fallback to daily
    return { type: "daily" };
  }

  /**
   * Validate current builder state.
   * @returns Error message if validation fails, null otherwise
   * @public
   */
  validate(): string | null {
    try {
      // Validate yearly day/month combination
      if (this.preset === "yearly") {
        const maxDays = this.getMaxDaysInMonth(this.yearlyMonth);
        if (this.yearlyDay > maxDays || this.yearlyDay < 1) {
          return `Day ${this.yearlyDay} is not valid for the selected month`;
        }
      }
      // Validate one-time date
      if (this.preset === "one-time") {
        if (!this.oneTimeDate) {
          return "One-time date is required";
        }
        const datePattern = /^\d{4}-\d{2}-\d{2}$/;
        if (!datePattern.test(this.oneTimeDate)) {
          return "Date must be in YYYY-MM-DD format";
        }
        const dateObj = new Date(this.oneTimeDate + "T00:00:00");
        if (isNaN(dateObj.getTime())) {
          return "Invalid date";
        }
        const now = new Date();
        const today = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        );
        const selectedDateOnly = new Date(
          dateObj.getFullYear(),
          dateObj.getMonth(),
          dateObj.getDate()
        );
        if (selectedDateOnly < today) {
          return "Date must be today or in the future";
        }
      }
      this.buildFrequency();
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Invalid frequency";
    }
  }
}
