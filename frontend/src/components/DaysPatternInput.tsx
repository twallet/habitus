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
 * Component for selecting/editing days patterns for reminder frequency.
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
    const [patternType, setPatternType] = useState<DaysPatternType | "">(
        value?.pattern_type || ""
    );
    const [intervalValue, setIntervalValue] = useState<number>(
        value?.interval_value || 1
    );
    const [intervalUnit, setIntervalUnit] = useState<
        "days" | "weeks" | "months" | "years"
    >(value?.interval_unit || "days");
    const [selectedDays, setSelectedDays] = useState<number[]>(
        value?.days || []
    );
    const [dayOfMonthType, setDayOfMonthType] = useState<
        "day_number" | "last_day" | "weekday_ordinal"
    >(
        value?.pattern_type === DaysPatternType.DAY_OF_MONTH && value?.type
            ? (value.type as "day_number" | "last_day" | "weekday_ordinal")
            : "day_number"
    );
    const [dayNumbers, setDayNumbers] = useState<number[]>(
        value?.day_numbers || []
    );
    const [weekday, setWeekday] = useState<number>(value?.weekday || 0);
    const [ordinal, setOrdinal] = useState<number>(value?.ordinal || 1);
    const [dayOfYearType, setDayOfYearType] = useState<
        "date" | "weekday_ordinal"
    >(
        value?.pattern_type === DaysPatternType.DAY_OF_YEAR && value?.type
            ? (value.type as "date" | "weekday_ordinal")
            : "date"
    );
    const [month, setMonth] = useState<number>(value?.month || 1);
    const [day, setDay] = useState<number>(value?.day || 1);

    const weekdays = [
        { value: 0, label: "Sunday" },
        { value: 1, label: "Monday" },
        { value: 2, label: "Tuesday" },
        { value: 3, label: "Wednesday" },
        { value: 4, label: "Thursday" },
        { value: 5, label: "Friday" },
        { value: 6, label: "Saturday" },
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
     * Validate and build the pattern from current state.
     * @internal
     */
    const buildPattern = (): DaysPattern | undefined => {
        if (!patternType) {
            return undefined;
        }

        const pattern: DaysPattern = {
            pattern_type: patternType as DaysPatternType,
        };

        if (patternType === DaysPatternType.INTERVAL) {
            if (intervalValue < 1) {
                if (onErrorChange) {
                    onErrorChange("Interval value must be at least 1");
                }
                return undefined;
            }
            pattern.interval_value = intervalValue;
            pattern.interval_unit = intervalUnit;
        } else if (patternType === DaysPatternType.DAY_OF_WEEK) {
            if (selectedDays.length === 0) {
                if (onErrorChange) {
                    onErrorChange("Please select at least one day of the week");
                }
                return undefined;
            }
            pattern.days = [...selectedDays].sort((a, b) => a - b);
        } else if (patternType === DaysPatternType.DAY_OF_MONTH) {
            pattern.type = dayOfMonthType;
            if (dayOfMonthType === "day_number") {
                if (dayNumbers.length === 0) {
                    if (onErrorChange) {
                        onErrorChange("Please select at least one day number");
                    }
                    return undefined;
                }
                pattern.day_numbers = [...dayNumbers].sort((a, b) => a - b);
            } else if (dayOfMonthType === "weekday_ordinal") {
                pattern.weekday = weekday;
                pattern.ordinal = ordinal;
            }
        } else if (patternType === DaysPatternType.DAY_OF_YEAR) {
            pattern.type = dayOfYearType as any;
            if (dayOfYearType === "date") {
                pattern.month = month;
                pattern.day = day;
            } else if (dayOfYearType === "weekday_ordinal") {
                pattern.weekday = weekday;
                pattern.ordinal = ordinal;
            }
        }

        if (onErrorChange) {
            onErrorChange(null);
        }
        return pattern;
    };

    /**
     * Handle pattern type change.
     * @internal
     */
    const handlePatternTypeChange = (newType: DaysPatternType | "") => {
        setPatternType(newType);
        if (!newType) {
            onChange(undefined);
            return;
        }
        // Reset all fields when pattern type changes
        setIntervalValue(1);
        setIntervalUnit("days");
        setSelectedDays([]);
        setDayOfMonthType("day_number");
        setDayNumbers([]);
        setWeekday(0);
        setOrdinal(1);
        setDayOfYearType("date");
        setMonth(1);
        setDay(1);
    };

    /**
     * Handle day of week toggle.
     * @param dayValue - Day value (0-6)
     * @internal
     */
    const handleDayToggle = (dayValue: number) => {
        const newDays = selectedDays.includes(dayValue)
            ? selectedDays.filter((d) => d !== dayValue)
            : [...selectedDays, dayValue];
        setSelectedDays(newDays);
    };

    /**
     * Handle day number toggle.
     * @param dayNum - Day number (1-31)
     * @internal
     */
    const handleDayNumberToggle = (dayNum: number) => {
        const newDayNumbers = dayNumbers.includes(dayNum)
            ? dayNumbers.filter((d) => d !== dayNum)
            : [...dayNumbers, dayNum];
        setDayNumbers(newDayNumbers);
    };

    /**
     * Update pattern when state changes.
     * @internal
     */
    useEffect(() => {
        const pattern = buildPattern();
        if (pattern) {
            onChange(pattern);
        } else if (!patternType) {
            onChange(undefined);
        }
    }, [
        patternType,
        intervalValue,
        intervalUnit,
        selectedDays,
        dayOfMonthType,
        dayNumbers,
        weekday,
        ordinal,
        dayOfYearType,
        month,
        day,
    ]);

    /**
     * Initialize from value prop.
     * @internal
     */
    useEffect(() => {
        if (value) {
            setPatternType(value.pattern_type);
            if (value.interval_value !== undefined) {
                setIntervalValue(value.interval_value);
            }
            if (value.interval_unit) {
                setIntervalUnit(value.interval_unit);
            }
            if (value.days) {
                setSelectedDays(value.days);
            }
            if (value.pattern_type === DaysPatternType.DAY_OF_MONTH && value.type) {
                setDayOfMonthType(value.type as "day_number" | "last_day" | "weekday_ordinal");
            }
            if (value.pattern_type === DaysPatternType.DAY_OF_YEAR && value.type) {
                setDayOfYearType(value.type as "date" | "weekday_ordinal");
            }
            if (value.day_numbers) {
                setDayNumbers(value.day_numbers);
            }
            if (value.weekday !== undefined) {
                setWeekday(value.weekday);
            }
            if (value.ordinal !== undefined) {
                setOrdinal(value.ordinal);
            }
            if (value.month !== undefined) {
                setMonth(value.month);
            }
            if (value.day !== undefined) {
                setDay(value.day);
            }
        }
    }, []);

    return (
        <div className="days-pattern-input">
            <div className="form-label-row">
                <label htmlFor="days-pattern-type">
                    Frequency{" "}
                    <button
                        type="button"
                        className="field-help"
                        aria-label="Frequency help"
                        title="Define how often reminders should be sent (e.g., every 3 days, every Monday, first of month, etc.)"
                    >
                        ?
                    </button>
                </label>
            </div>
            <select
                id="days-pattern-type"
                value={patternType}
                onChange={(e) =>
                    handlePatternTypeChange(
                        e.target.value as DaysPatternType | ""
                    )
                }
                disabled={disabled}
            >
                <option value="">None (daily)</option>
                <option value={DaysPatternType.INTERVAL}>
                    Every X days/weeks/months/years
                </option>
                <option value={DaysPatternType.DAY_OF_WEEK}>
                    Day of week (e.g., Monday, Thursday)
                </option>
                <option value={DaysPatternType.DAY_OF_MONTH}>
                    Day of month (e.g., 1st, last, first Monday)
                </option>
                <option value={DaysPatternType.DAY_OF_YEAR}>
                    Day of year (e.g., March 15th, first Monday)
                </option>
            </select>

            {patternType === DaysPatternType.INTERVAL && (
                <div className="pattern-input-group">
                    <div className="interval-inputs">
                        <input
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
                                    e.target.value as
                                    | "days"
                                    | "weeks"
                                    | "months"
                                    | "years"
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

            {patternType === DaysPatternType.DAY_OF_WEEK && (
                <div className="pattern-input-group">
                    <div className="days-of-week-selector">
                        {weekdays.map((wd) => (
                            <label key={wd.value} className="day-checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={selectedDays.includes(wd.value)}
                                    onChange={() => handleDayToggle(wd.value)}
                                    disabled={disabled}
                                />
                                <span>{wd.label}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}

            {patternType === DaysPatternType.DAY_OF_MONTH && (
                <div className="pattern-input-group">
                    <select
                        value={dayOfMonthType}
                        onChange={(e) =>
                            setDayOfMonthType(
                                e.target.value as
                                | "day_number"
                                | "last_day"
                                | "weekday_ordinal"
                            )
                        }
                        disabled={disabled}
                    >
                        <option value="day_number">Specific day(s)</option>
                        <option value="last_day">Last day of month</option>
                        <option value="weekday_ordinal">
                            Weekday ordinal (e.g., first Monday)
                        </option>
                    </select>

                    {dayOfMonthType === "day_number" && (
                        <div className="day-numbers-selector">
                            <div className="day-numbers-grid">
                                {Array.from({ length: 31 }, (_, i) => i + 1).map(
                                    (dayNum) => (
                                        <label
                                            key={dayNum}
                                            className="day-number-checkbox-label"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={dayNumbers.includes(dayNum)}
                                                onChange={() =>
                                                    handleDayNumberToggle(dayNum)
                                                }
                                                disabled={disabled}
                                            />
                                            <span>{dayNum}</span>
                                        </label>
                                    )
                                )}
                            </div>
                        </div>
                    )}

                    {dayOfMonthType === "weekday_ordinal" && (
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
            )}

            {patternType === DaysPatternType.DAY_OF_YEAR && (
                <div className="pattern-input-group">
                    <select
                        value={dayOfYearType}
                        onChange={(e) =>
                            setDayOfYearType(
                                e.target.value as "date" | "weekday_ordinal"
                            )
                        }
                        disabled={disabled}
                    >
                        <option value="date">Specific date</option>
                        <option value="weekday_ordinal">
                            Weekday ordinal (e.g., first Monday of year)
                        </option>
                    </select>

                    {dayOfYearType === "date" && (
                        <div className="date-inputs">
                            <select
                                value={month}
                                onChange={(e) =>
                                    setMonth(parseInt(e.target.value, 10))
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
                                value={day}
                                onChange={(e) =>
                                    setDay(parseInt(e.target.value, 10) || 1)
                                }
                                disabled={disabled}
                                className="day-input"
                            />
                        </div>
                    )}

                    {dayOfYearType === "weekday_ordinal" && (
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
            )}

            {error && (
                <div className="days-pattern-error">{error}</div>
            )}
        </div>
    );
}

