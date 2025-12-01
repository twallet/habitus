import { DaysPattern, DaysPatternType } from "./Tracking";

/**
 * Frequency preset type for simplified selection.
 * @public
 */
export type FrequencyPreset =
  | "daily"
  | "weekdays"
  | "interval"
  | "weekly"
  | "monthly"
  | "yearly"
  | "custom";

/**
 * Builder class for creating and managing days patterns.
 * Handles pattern building, validation, and preset detection using OOP principles.
 * @public
 */
export class DaysPatternBuilder {
  private preset: FrequencyPreset;
  private intervalValue: number;
  private intervalUnit: "days" | "weeks" | "months" | "years";
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
    this.intervalValue = value?.interval_value || 1;
    this.intervalUnit = value?.interval_unit || "days";
    this.selectedDays = value?.days || [];
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
  }

  /**
   * Get interval value.
   * @returns Current interval value
   * @public
   */
  getIntervalValue(): number {
    return this.intervalValue;
  }

  /**
   * Set interval value.
   * @param value - Interval value to set
   * @public
   */
  setIntervalValue(value: number): void {
    this.intervalValue = value;
  }

  /**
   * Get interval unit.
   * @returns Current interval unit
   * @public
   */
  getIntervalUnit(): "days" | "weeks" | "months" | "years" {
    return this.intervalUnit;
  }

  /**
   * Set interval unit.
   * @param unit - Interval unit to set
   * @public
   */
  setIntervalUnit(unit: "days" | "weeks" | "months" | "years"): void {
    this.intervalUnit = unit;
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
    this.yearlyDay = day;
  }

  /**
   * Detect preset from a pattern.
   * @param pattern - Pattern to analyze
   * @returns Detected preset type
   * @public
   */
  detectPresetFromPattern(pattern: DaysPattern): FrequencyPreset {
    if (pattern.pattern_type === DaysPatternType.INTERVAL) {
      if (pattern.interval_value === 1 && pattern.interval_unit === "days") {
        return "daily";
      }
      return "interval";
    }

    if (pattern.pattern_type === DaysPatternType.DAY_OF_WEEK) {
      if (
        pattern.days &&
        pattern.days.length === 5 &&
        pattern.days.includes(1) &&
        pattern.days.includes(2) &&
        pattern.days.includes(3) &&
        pattern.days.includes(4) &&
        pattern.days.includes(5)
      ) {
        return "weekdays";
      }
      return "weekly";
    }

    if (pattern.pattern_type === DaysPatternType.DAY_OF_MONTH) {
      return "monthly";
    }

    if (pattern.pattern_type === DaysPatternType.DAY_OF_YEAR) {
      return "yearly";
    }

    return "custom";
  }

  /**
   * Build pattern from current builder state.
   * @param originalValue - Original pattern value for custom preset fallback
   * @returns Built pattern or undefined
   * @throws Error if validation fails
   * @public
   */
  buildPattern(originalValue?: DaysPattern): DaysPattern | undefined {
    if (this.preset === "daily") {
      return undefined; // Daily means no pattern (default)
    }

    if (this.preset === "weekdays") {
      return {
        pattern_type: DaysPatternType.DAY_OF_WEEK,
        days: [1, 2, 3, 4, 5], // Monday to Friday
      };
    }

    if (this.preset === "interval") {
      if (this.intervalValue < 1) {
        throw new Error("Interval value must be at least 1");
      }
      return {
        pattern_type: DaysPatternType.INTERVAL,
        interval_value: this.intervalValue,
        interval_unit: this.intervalUnit,
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

    // Custom preset - preserve existing pattern if available
    if (originalValue && this.preset === "custom") {
      return originalValue;
    }

    return undefined;
  }

  /**
   * Validate current builder state.
   * @returns Error message if validation fails, null otherwise
   * @public
   */
  validate(): string | null {
    try {
      this.buildPattern();
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Invalid pattern";
    }
  }
}
