import { DaysPattern, DaysPatternType } from "./Tracking";

/**
 * Frequency preset type for simplified selection.
 * @public
 */
export type FrequencyPreset = "daily" | "weekly" | "monthly" | "yearly";

/**
 * Builder class for creating and managing days patterns.
 * Handles pattern building, validation, and preset detection using OOP principles.
 * @public
 */
export class DaysPatternBuilder {
  private preset: FrequencyPreset;
  private selectedDays: number[];
  private monthlyDay: number;
  private monthlyType: "day" | "last" | "weekday";
  private weekday: number;
  private ordinal: number;
  private yearlyMonth: number;
  private yearlyDay: number;

  /**
   * Create a new DaysPatternBuilder instance.
   * @param value - Optional existing pattern to initialize from
   * @public
   */
  constructor(value?: DaysPattern) {
    this.preset = value ? this.detectPresetFromPattern(value) : "daily";
    this.selectedDays = value?.days || [1]; // Default to Monday for weekly
    this.monthlyDay = value?.day_numbers?.[0] || 1;
    this.monthlyType =
      value?.type === "last_day"
        ? "last"
        : value?.type === "weekday_ordinal"
        ? "weekday"
        : "day";
    this.weekday = value?.weekday || 1; // Monday by default
    this.ordinal = value?.ordinal || 1;
    this.yearlyMonth = value?.month || 1;
    this.yearlyDay = value?.day || 1;
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
   * Detect preset from a pattern.
   * @param pattern - Pattern to analyze
   * @returns Detected preset type
   * @public
   */
  detectPresetFromPattern(pattern: DaysPattern): FrequencyPreset {
    if (pattern.pattern_type === DaysPatternType.INTERVAL) {
      // Interval patterns map to daily (every X days)
      return "daily";
    }

    if (pattern.pattern_type === DaysPatternType.DAY_OF_WEEK) {
      return "weekly";
    }

    if (pattern.pattern_type === DaysPatternType.DAY_OF_MONTH) {
      return "monthly";
    }

    if (pattern.pattern_type === DaysPatternType.DAY_OF_YEAR) {
      return "yearly";
    }

    // Default to daily
    return "daily";
  }

  /**
   * Build pattern from current builder state.
   * Always returns a pattern (mandatory field).
   * @returns Built pattern
   * @throws Error if validation fails
   * @public
   */
  buildPattern(): DaysPattern {
    if (this.preset === "daily") {
      // Daily = every 1 day (interval pattern)
      return {
        pattern_type: DaysPatternType.INTERVAL,
        interval_value: 1,
        interval_unit: "days",
      };
    }

    if (this.preset === "weekly") {
      if (this.selectedDays.length === 0) {
        throw new Error("Please select at least one day of the week");
      }
      return {
        pattern_type: DaysPatternType.DAY_OF_WEEK,
        days: [...this.selectedDays].sort((a, b) => a - b),
      };
    }

    if (this.preset === "monthly") {
      if (this.monthlyType === "day") {
        return {
          pattern_type: DaysPatternType.DAY_OF_MONTH,
          type: "day_number",
          day_numbers: [this.monthlyDay],
        };
      }
      if (this.monthlyType === "last") {
        return {
          pattern_type: DaysPatternType.DAY_OF_MONTH,
          type: "last_day",
        };
      }
      if (this.monthlyType === "weekday") {
        return {
          pattern_type: DaysPatternType.DAY_OF_MONTH,
          type: "weekday_ordinal",
          weekday: this.weekday,
          ordinal: this.ordinal,
        };
      }
    }

    if (this.preset === "yearly") {
      return {
        pattern_type: DaysPatternType.DAY_OF_YEAR,
        type: "date",
        month: this.yearlyMonth,
        day: this.yearlyDay,
      };
    }

    // Fallback to daily
    return {
      pattern_type: DaysPatternType.INTERVAL,
      interval_value: 1,
      interval_unit: "days",
    };
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
      this.buildPattern();
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Invalid pattern";
    }
  }
}
