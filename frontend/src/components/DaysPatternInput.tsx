import { useState, useEffect } from "react";
import { DaysPattern, DaysPatternType } from "../models/Tracking";
import "./DaysPatternInput.css";

interface DaysPatternInputProps {
    value?: DaysPattern;
    onChange: (pattern: DaysPattern | undefined) => void;
    disabled?: boolean;
    error?: string | null;
    onErrorChange?: (error: string | null) => void;
}

/**
 * Frequency preset type for simplified selection.
 * @internal
 */
type FrequencyPreset =
    | "daily"
    | "weekdays"
    | "interval"
    | "weekly"
    | "monthly"
    | "yearly"
    | "custom";

/**
 * Component for selecting/editing days patterns for reminder frequency.
 * Uses progressive disclosure with simple presets and natural language.
 * @param props - Component props
 * @param props.value - Current days pattern value
 * @param props.onChange - Callback when pattern changes
 * @param props.disabled - Whether the input is disabled
 * @param props.error - Error message to display
 * @param props.onErrorChange - Callback when error changes
 * @public
 */
export function DaysPatternInput({
    value,
    onChange,
    disabled = false,
    error,
    onErrorChange,
}: DaysPatternInputProps) {
    const [preset, setPreset] = useState<FrequencyPreset>("daily");
    const [intervalValue, setIntervalValue] = useState<number>(
        value?.interval_value || 1
    );
    const [intervalUnit, setIntervalUnit] = useState<
        "days" | "weeks" | "months" | "years"
    >(value?.interval_unit || "days");
    const [selectedDays, setSelectedDays] = useState<number[]>(
        value?.days || []
    );
    const [monthlyDay, setMonthlyDay] = useState<number>(
        value?.day_numbers?.[0] || 1
    );
    const [monthlyType, setMonthlyType] = useState<"day" | "last" | "weekday">(
        value?.type === "last_day" ? "last" :
            value?.type === "weekday_ordinal" ? "weekday" : "day"
    );
    const [weekday, setWeekday] = useState<number>(value?.weekday || 1); // Monday by default
    const [ordinal, setOrdinal] = useState<number>(value?.ordinal || 1);
    const [yearlyMonth, setYearlyMonth] = useState<number>(value?.month || 1);
    const [yearlyDay, setYearlyDay] = useState<number>(value?.day || 1);

    const weekdays = [
        { value: 1, label: "Monday", short: "Mon" },
        { value: 2, label: "Tuesday", short: "Tue" },
        { value: 3, label: "Wednesday", short: "Wed" },
        { value: 4, label: "Thursday", short: "Thu" },
        { value: 5, label: "Friday", short: "Fri" },
        { value: 6, label: "Saturday", short: "Sat" },
        { value: 0, label: "Sunday", short: "Sun" },
    ];

    const ordinalLabels = [
        { value: 1, label: "First" },
        { value: 2, label: "Second" },
        { value: 3, label: "Third" },
        { value: 4, label: "Fourth" },
        { value: 5, label: "Fifth" },
    ];

    const months = [
        { value: 1, label: "January" },
        { value: 2, label: "February" },
        { value: 3, label: "March" },
        { value: 4, label: "April" },
        { value: 5, label: "May" },
        { value: 6, label: "June" },
        { value: 7, label: "July" },
        { value: 8, label: "August" },
        { value: 9, label: "September" },
        { value: 10, label: "October" },
        { value: 11, label: "November" },
        { value: 12, label: "December" },
    ];

    /**
     * Determine preset from current value.
     * @internal
     */
    const getPresetFromValue = (): FrequencyPreset => {
        if (!value) return "daily";

        if (value.pattern_type === DaysPatternType.INTERVAL) {
            if (value.interval_value === 1 && value.interval_unit === "days") {
                return "daily";
            }
            return "interval";
        }

        if (value.pattern_type === DaysPatternType.DAY_OF_WEEK) {
            if (value.days && value.days.length === 5 &&
                value.days.includes(1) && value.days.includes(2) &&
                value.days.includes(3) && value.days.includes(4) &&
                value.days.includes(5)) {
                return "weekdays";
            }
            return "weekly";
        }

        if (value.pattern_type === DaysPatternType.DAY_OF_MONTH) {
            return "monthly";
        }

        if (value.pattern_type === DaysPatternType.DAY_OF_YEAR) {
            return "yearly";
        }

        return "custom";
    };

    /**
     * Build pattern from current preset and state.
     * @internal
     */
    const buildPattern = (): DaysPattern | undefined => {
        if (preset === "daily") {
            return undefined; // Daily means no pattern (default)
        }

        if (preset === "weekdays") {
            return {
                pattern_type: DaysPatternType.DAY_OF_WEEK,
                days: [1, 2, 3, 4, 5], // Monday to Friday
            };
        }

        if (preset === "interval") {
            if (intervalValue < 1) {
                if (onErrorChange) {
                    onErrorChange("Interval value must be at least 1");
                }
                return undefined;
            }
            return {
                pattern_type: DaysPatternType.INTERVAL,
                interval_value: intervalValue,
                interval_unit: intervalUnit,
            };
        }

        if (preset === "weekly") {
            if (selectedDays.length === 0) {
                if (onErrorChange) {
                    onErrorChange("Please select at least one day of the week");
                }
                return undefined;
            }
            return {
                pattern_type: DaysPatternType.DAY_OF_WEEK,
                days: [...selectedDays].sort((a, b) => a - b),
            };
        }

        if (preset === "monthly") {
            if (monthlyType === "day") {
                return {
                    pattern_type: DaysPatternType.DAY_OF_MONTH,
                    type: "day_number",
                    day_numbers: [monthlyDay],
                };
            }
            if (monthlyType === "last") {
                return {
                    pattern_type: DaysPatternType.DAY_OF_MONTH,
                    type: "last_day",
                };
            }
            if (monthlyType === "weekday") {
                return {
                    pattern_type: DaysPatternType.DAY_OF_MONTH,
                    type: "weekday_ordinal",
                    weekday: weekday,
                    ordinal: ordinal,
                };
            }
        }

        if (preset === "yearly") {
            return {
                pattern_type: DaysPatternType.DAY_OF_YEAR,
                type: "date",
                month: yearlyMonth,
                day: yearlyDay,
            };
        }

        // Custom preset - preserve existing pattern if available
        // This handles patterns that don't match our simplified presets
        if (value && preset === "custom") {
            return value;
        }

        return undefined;
    };

    /**
     * Handle preset change.
     * @internal
     */
    const handlePresetChange = (newPreset: FrequencyPreset) => {
        setPreset(newPreset);
        if (onErrorChange) {
            onErrorChange(null);
        }
    };

    /**
     * Handle day of week toggle.
     * @param dayValue - Day value (0-6, where 0=Sunday)
     * @internal
     */
    const handleDayToggle = (dayValue: number) => {
        const newDays = selectedDays.includes(dayValue)
            ? selectedDays.filter((d) => d !== dayValue)
            : [...selectedDays, dayValue];
        setSelectedDays(newDays);
    };

    /**
     * Update pattern when state changes.
     * @internal
     */
    useEffect(() => {
        const pattern = buildPattern();
        onChange(pattern);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        preset,
        intervalValue,
        intervalUnit,
        selectedDays,
        monthlyDay,
        monthlyType,
        weekday,
        ordinal,
        yearlyMonth,
        yearlyDay,
    ]);

    /**
     * Initialize from value prop.
     * @internal
     */
    useEffect(() => {
        if (value) {
            const detectedPreset = getPresetFromValue();
            setPreset(detectedPreset);

            if (value.interval_value !== undefined) {
                setIntervalValue(value.interval_value);
            }
            if (value.interval_unit) {
                setIntervalUnit(value.interval_unit);
            }
            if (value.days) {
                setSelectedDays(value.days);
            }
            if (value.day_numbers && value.day_numbers.length > 0) {
                setMonthlyDay(value.day_numbers[0]);
            }
            if (value.type === "last_day") {
                setMonthlyType("last");
            } else if (value.type === "weekday_ordinal") {
                setMonthlyType("weekday");
            }
            if (value.weekday !== undefined) {
                setWeekday(value.weekday);
            }
            if (value.ordinal !== undefined) {
                setOrdinal(value.ordinal);
            }
            if (value.month !== undefined) {
                setYearlyMonth(value.month);
            }
            if (value.day !== undefined) {
                setYearlyDay(value.day);
            }
        } else {
            setPreset("daily");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="days-pattern-input">
            <div className="form-label-row">
                <label htmlFor="frequency-preset">
                    Frequency{" "}
                    <button
                        type="button"
                        className="field-help"
                        aria-label="Frequency help"
                        title="Define how often reminders should be sent"
                    >
                        ?
                    </button>
                </label>
            </div>

            <select
                id="frequency-preset"
                value={preset}
                onChange={(e) => handlePresetChange(e.target.value as FrequencyPreset)}
                disabled={disabled}
                className="frequency-preset-select"
            >
                <option value="daily">Daily</option>
                <option value="weekdays">Every weekday (Mon-Fri)</option>
                <option value="interval">Every X days/weeks/months/years</option>
                <option value="weekly">Weekly on specific days</option>
                <option value="monthly">Monthly on specific day</option>
                <option value="yearly">Yearly on specific date</option>
            </select>

            {preset === "interval" && (
                <div className="frequency-options">
                    <div className="interval-inputs">
                        <label htmlFor="interval-value">Every</label>
                        <input
                            id="interval-value"
                            type="number"
                            min="1"
                            value={intervalValue}
                            onChange={(e) =>
                                setIntervalValue(parseInt(e.target.value, 10) || 1)
                            }
                            disabled={disabled}
                            className="interval-value-input"
                        />
                        <select
                            value={intervalUnit}
                            onChange={(e) =>
                                setIntervalUnit(
                                    e.target.value as "days" | "weeks" | "months" | "years"
                                )
                            }
                            disabled={disabled}
                        >
                            <option value="days">day(s)</option>
                            <option value="weeks">week(s)</option>
                            <option value="months">month(s)</option>
                            <option value="years">year(s)</option>
                        </select>
                    </div>
                </div>
            )}

            {preset === "weekly" && (
                <div className="frequency-options">
                    <div className="days-of-week-selector">
                        <label>Select days:</label>
                        <div className="weekday-buttons">
                            {weekdays.map((wd) => (
                                <button
                                    key={wd.value}
                                    type="button"
                                    className={`weekday-button ${selectedDays.includes(wd.value) ? "selected" : ""}`}
                                    onClick={() => handleDayToggle(wd.value)}
                                    disabled={disabled}
                                    aria-pressed={selectedDays.includes(wd.value)}
                                >
                                    {wd.short}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {preset === "monthly" && (
                <div className="frequency-options">
                    <div className="monthly-options">
                        <select
                            value={monthlyType}
                            onChange={(e) =>
                                setMonthlyType(e.target.value as "day" | "last" | "weekday")
                            }
                            disabled={disabled}
                        >
                            <option value="day">On day</option>
                            <option value="last">On last day</option>
                            <option value="weekday">On weekday</option>
                        </select>

                        {monthlyType === "day" && (
                            <input
                                type="number"
                                min="1"
                                max="31"
                                value={monthlyDay}
                                onChange={(e) =>
                                    setMonthlyDay(parseInt(e.target.value, 10) || 1)
                                }
                                disabled={disabled}
                                className="day-input"
                            />
                        )}

                        {monthlyType === "weekday" && (
                            <div className="weekday-ordinal-inputs">
                                <select
                                    value={ordinal}
                                    onChange={(e) =>
                                        setOrdinal(parseInt(e.target.value, 10))
                                    }
                                    disabled={disabled}
                                >
                                    {ordinalLabels.map((ord) => (
                                        <option key={ord.value} value={ord.value}>
                                            {ord.label}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    value={weekday}
                                    onChange={(e) =>
                                        setWeekday(parseInt(e.target.value, 10))
                                    }
                                    disabled={disabled}
                                >
                                    {weekdays.map((wd) => (
                                        <option key={wd.value} value={wd.value}>
                                            {wd.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {preset === "yearly" && (
                <div className="frequency-options">
                    <div className="yearly-options">
                        <select
                            value={yearlyMonth}
                            onChange={(e) =>
                                setYearlyMonth(parseInt(e.target.value, 10))
                            }
                            disabled={disabled}
                        >
                            {months.map((m) => (
                                <option key={m.value} value={m.value}>
                                    {m.label}
                                </option>
                            ))}
                        </select>
                        <input
                            type="number"
                            min="1"
                            max="31"
                            value={yearlyDay}
                            onChange={(e) =>
                                setYearlyDay(parseInt(e.target.value, 10) || 1)
                            }
                            disabled={disabled}
                            className="day-input"
                        />
                    </div>
                </div>
            )}

            {error && (
                <div className="days-pattern-error">{error}</div>
            )}
        </div>
    );
}
