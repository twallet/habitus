import { describe, it, expect, beforeEach } from "vitest";
import { DaysPatternBuilder, FrequencyPreset } from "../DaysPatternBuilder";
import { DaysPattern, DaysPatternType } from "../Tracking";

describe("DaysPatternBuilder", () => {
  let builder: DaysPatternBuilder;

  beforeEach(() => {
    builder = new DaysPatternBuilder();
  });

  describe("constructor", () => {
    it("should initialize with default values when no pattern provided", () => {
      const newBuilder = new DaysPatternBuilder();
      expect(newBuilder.getPreset()).toBe("daily");
      expect(newBuilder.getSelectedDays()).toEqual([1]); // Default to Monday for weekly
    });

    it("should initialize from existing daily pattern", () => {
      const pattern: DaysPattern = {
        pattern_type: DaysPatternType.INTERVAL,
        interval_value: 1,
        interval_unit: "days",
      };
      const newBuilder = new DaysPatternBuilder(pattern);
      expect(newBuilder.getPreset()).toBe("daily");
    });

    it("should detect weekly preset from day-of-week pattern", () => {
      const pattern: DaysPattern = {
        pattern_type: DaysPatternType.DAY_OF_WEEK,
        days: [1, 2, 3, 4, 5], // Monday to Friday
      };
      const newBuilder = new DaysPatternBuilder(pattern);
      expect(newBuilder.getPreset()).toBe("weekly");
    });

    it("should detect weekly preset from pattern", () => {
      const pattern: DaysPattern = {
        pattern_type: DaysPatternType.DAY_OF_WEEK,
        days: [1, 3, 5], // Monday, Wednesday, Friday
      };
      const newBuilder = new DaysPatternBuilder(pattern);
      expect(newBuilder.getPreset()).toBe("weekly");
    });

    it("should detect monthly preset from pattern", () => {
      const pattern: DaysPattern = {
        pattern_type: DaysPatternType.DAY_OF_MONTH,
        type: "day_number",
        day_numbers: [15],
      };
      const newBuilder = new DaysPatternBuilder(pattern);
      expect(newBuilder.getPreset()).toBe("monthly");
    });

    it("should detect yearly preset from pattern", () => {
      const pattern: DaysPattern = {
        pattern_type: DaysPatternType.DAY_OF_YEAR,
        type: "date",
        month: 3,
        day: 15,
      };
      const newBuilder = new DaysPatternBuilder(pattern);
      expect(newBuilder.getPreset()).toBe("yearly");
    });
  });

  describe("preset management", () => {
    it("should get and set preset", () => {
      builder.setPreset("weekly");
      expect(builder.getPreset()).toBe("weekly");
    });
  });

  describe("weekly pattern", () => {
    it("should get and set selected days", () => {
      builder.setSelectedDays([1, 3, 5]);
      expect(builder.getSelectedDays()).toEqual([1, 3, 5]);
    });

    it("should toggle day", () => {
      builder.setSelectedDays([1, 3]);
      builder.toggleDay(5);
      expect(builder.getSelectedDays()).toEqual([1, 3, 5]);
      builder.toggleDay(1);
      expect(builder.getSelectedDays()).toEqual([3, 5]);
    });

    it("should build weekly pattern", () => {
      builder.setPreset("weekly");
      builder.setSelectedDays([1, 3, 5]);
      const pattern = builder.buildPattern();
      expect(pattern).toEqual({
        pattern_type: DaysPatternType.DAY_OF_WEEK,
        days: [1, 3, 5],
      });
    });

    it("should throw error when no days selected", () => {
      builder.setPreset("weekly");
      builder.setSelectedDays([]);
      expect(() => builder.buildPattern()).toThrow(
        "Please select at least one day of the week"
      );
    });
  });

  describe("monthly pattern", () => {
    it("should get and set monthly day", () => {
      builder.setMonthlyDay(15);
      expect(builder.getMonthlyDay()).toBe(15);
    });

    it("should get and set monthly type", () => {
      builder.setMonthlyType("last");
      expect(builder.getMonthlyType()).toBe("last");
    });

    it("should build monthly pattern with day number", () => {
      builder.setPreset("monthly");
      builder.setMonthlyType("day");
      builder.setMonthlyDay(15);
      const pattern = builder.buildPattern();
      expect(pattern).toEqual({
        pattern_type: DaysPatternType.DAY_OF_MONTH,
        type: "day_number",
        day_numbers: [15],
      });
    });

    it("should build monthly pattern with last day", () => {
      builder.setPreset("monthly");
      builder.setMonthlyType("last");
      const pattern = builder.buildPattern();
      expect(pattern).toEqual({
        pattern_type: DaysPatternType.DAY_OF_MONTH,
        type: "last_day",
      });
    });

    it("should build monthly pattern with weekday ordinal", () => {
      builder.setPreset("monthly");
      builder.setMonthlyType("weekday");
      builder.setWeekday(1); // Monday
      builder.setOrdinal(1); // First
      const pattern = builder.buildPattern();
      expect(pattern).toEqual({
        pattern_type: DaysPatternType.DAY_OF_MONTH,
        type: "weekday_ordinal",
        weekday: 1,
        ordinal: 1,
      });
    });
  });

  describe("yearly pattern", () => {
    it("should get and set yearly month", () => {
      builder.setYearlyMonth(3);
      expect(builder.getYearlyMonth()).toBe(3);
    });

    it("should get and set yearly day", () => {
      builder.setYearlyDay(15);
      expect(builder.getYearlyDay()).toBe(15);
    });

    it("should build yearly pattern", () => {
      builder.setPreset("yearly");
      builder.setYearlyMonth(3);
      builder.setYearlyDay(15);
      const pattern = builder.buildPattern();
      expect(pattern).toEqual({
        pattern_type: DaysPatternType.DAY_OF_YEAR,
        type: "date",
        month: 3,
        day: 15,
      });
    });
  });

  describe("daily pattern", () => {
    it("should return daily interval pattern for daily preset", () => {
      builder.setPreset("daily");
      const pattern = builder.buildPattern();
      expect(pattern).toEqual({
        pattern_type: DaysPatternType.INTERVAL,
        interval_value: 1,
        interval_unit: "days",
      });
    });
  });

  describe("validation", () => {
    it("should return null for valid pattern", () => {
      builder.setPreset("daily");
      expect(builder.validate()).toBeNull();
    });

    it("should return error message for invalid pattern", () => {
      builder.setPreset("weekly");
      builder.setSelectedDays([]);
      expect(builder.validate()).toBe(
        "Please select at least one day of the week"
      );
    });

    it("should return error message for weekly pattern without days", () => {
      builder.setPreset("weekly");
      builder.setSelectedDays([]);
      expect(builder.validate()).toBe(
        "Please select at least one day of the week"
      );
    });
  });

  describe("detectPresetFromPattern", () => {
    it("should detect daily from interval pattern with 1 day", () => {
      const pattern: DaysPattern = {
        pattern_type: DaysPatternType.INTERVAL,
        interval_value: 1,
        interval_unit: "days",
      };
      const detected = builder.detectPresetFromPattern(pattern);
      expect(detected).toBe("daily");
    });

    it("should detect daily from any interval pattern (simplified UI)", () => {
      const pattern: DaysPattern = {
        pattern_type: DaysPatternType.INTERVAL,
        interval_value: 3,
        interval_unit: "weeks",
      };
      const detected = builder.detectPresetFromPattern(pattern);
      // Simplified UI maps all intervals to daily
      expect(detected).toBe("daily");
    });

    it("should detect weekly from day-of-week pattern", () => {
      const pattern: DaysPattern = {
        pattern_type: DaysPatternType.DAY_OF_WEEK,
        days: [1, 2, 3, 4, 5],
      };
      const detected = builder.detectPresetFromPattern(pattern);
      expect(detected).toBe("weekly");
    });

    it("should detect weekly from other day-of-week patterns", () => {
      const pattern: DaysPattern = {
        pattern_type: DaysPatternType.DAY_OF_WEEK,
        days: [0, 6], // Sunday and Saturday
      };
      const detected = builder.detectPresetFromPattern(pattern);
      expect(detected).toBe("weekly");
    });

    it("should detect monthly from day-of-month pattern", () => {
      const pattern: DaysPattern = {
        pattern_type: DaysPatternType.DAY_OF_MONTH,
        type: "day_number",
        day_numbers: [1, 15, 30], // Multiple days
      };
      const detected = builder.detectPresetFromPattern(pattern);
      expect(detected).toBe("monthly");
    });
  });
});
