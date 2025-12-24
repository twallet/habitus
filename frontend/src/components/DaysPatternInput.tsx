import { useState, useEffect, useRef } from "react";
import { DaysPattern, DaysPatternType } from "../models/Tracking";
import { DaysPatternBuilder, FrequencyPreset } from "../models/DaysPatternBuilder";
import "./DaysPatternInput.css";

type FrequencyWithOneTime = FrequencyPreset | "One-time";

interface DaysPatternInputProps {
    value?: DaysPattern;
    onChange: (pattern: DaysPattern | undefined) => void;
    disabled?: boolean;
    error?: string | null;
    onErrorChange?: (error: string | null) => void;
    hideFrequencySelector?: boolean;
    frequency?: FrequencyWithOneTime;
    onFrequencyChange?: (frequency: FrequencyWithOneTime) => void;
    oneTimeDate?: string;
    onOneTimeDateChange?: (date: string) => void;
}

/**
 * Component for selecting/editing days patterns for reminder frequency.
 * Simplified UI starting with Daily/Weekly/Monthly/Yearly choice.
 * @param props - Component props
 * @param props.value - Current days pattern value
 * @param props.onChange - Callback when pattern changes (always called with a pattern)
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
    hideFrequencySelector = false,
    frequency,
    onFrequencyChange,
    oneTimeDate: controlledOneTimeDate,
    onOneTimeDateChange,
}: DaysPatternInputProps) {
    const builderRef = useRef<DaysPatternBuilder>(new DaysPatternBuilder(value));
    // Track the last pattern we sent to parent to avoid re-initializing from our own updates
    const lastSentPatternRef = useRef<DaysPattern | null>(null);
    // Track if we're in the middle of a preset change to prevent effect from running
    const isPresetChangingRef = useRef<boolean>(false);
    // Use controlled frequency if provided, otherwise use internal state
    const internalPreset = builderRef.current.getPreset();
    const [preset, setPreset] = useState<FrequencyPreset>(
        frequency && frequency !== "One-time" ? frequency : internalPreset
    );

    /**
     * Get tomorrow's date as ISO string (YYYY-MM-DD).
     * @returns Tomorrow's date in YYYY-MM-DD format
     * @internal
     */
    const getTomorrowDate = (): string => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().slice(0, 10);
    };

    // Determine if we're in one-time mode
    // If frequency is explicitly "One-time", we're in one-time mode
    // Note: We don't check value === undefined because that's also true for new components
    const isOneTime = frequency === "One-time";
    const [oneTimeDate, setOneTimeDate] = useState<string>(
        controlledOneTimeDate || getTomorrowDate()
    );

    // Sync with controlled frequency prop
    useEffect(() => {
        if (frequency && frequency !== "One-time") {
            setPreset(frequency);
        }
    }, [frequency]);
    const [selectedDays, setSelectedDays] = useState<number[]>(
        builderRef.current.getSelectedDays()
    );
    const [monthlyDay, setMonthlyDay] = useState<number>(
        builderRef.current.getMonthlyDay()
    );
    const [monthlyType, setMonthlyType] = useState<"day" | "last" | "weekday">(
        builderRef.current.getMonthlyType()
    );
    const [weekday, setWeekday] = useState<number>(builderRef.current.getWeekday());
    const [ordinal, setOrdinal] = useState<number>(builderRef.current.getOrdinal());
    const [yearlyMonth, setYearlyMonth] = useState<number>(
        builderRef.current.getYearlyMonth()
    );
    const [yearlyDay, setYearlyDay] = useState<number>(
        builderRef.current.getYearlyDay()
    );

    const weekdays = [
        { value: 1, label: "Monday", short: "Mon", twoLetter: "Mo" },
        { value: 2, label: "Tuesday", short: "Tue", twoLetter: "Tu" },
        { value: 3, label: "Wednesday", short: "Wed", twoLetter: "We" },
        { value: 4, label: "Thursday", short: "Thu", twoLetter: "Th" },
        { value: 5, label: "Friday", short: "Fri", twoLetter: "Fr" },
        { value: 6, label: "Saturday", short: "Sat", twoLetter: "Sa" },
        { value: 0, label: "Sunday", short: "Sun", twoLetter: "Su" },
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
     * Get the maximum number of days in a given month.
     * @param month - Month number (1-12)
     * @returns Maximum number of days in the month
     * @internal
     */
    const getMaxDaysInMonth = (month: number): number => {
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
    };

    /**
     * Update builder with current state and build pattern.
     * @internal
     */
    const buildPattern = (): DaysPattern => {
        const builder = builderRef.current;
        builder.setPreset(preset);
        builder.setSelectedDays(selectedDays);
        builder.setMonthlyDay(monthlyDay);
        builder.setMonthlyType(monthlyType);
        builder.setWeekday(weekday);
        builder.setOrdinal(ordinal);
        builder.setYearlyMonth(yearlyMonth);
        builder.setYearlyDay(yearlyDay);

        try {
            const validationError = builder.validate();
            if (validationError) {
                if (onErrorChange) {
                    onErrorChange(validationError);
                }
                // Return a default pattern even on validation error
                return {
                    pattern_type: DaysPatternType.INTERVAL,
                    interval_value: 1,
                    interval_unit: "days",
                };
            }
            if (onErrorChange) {
                onErrorChange(null);
            }
            return builder.buildPattern();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Invalid pattern";
            if (onErrorChange) {
                onErrorChange(errorMessage);
            }
            // Return a default pattern even on error
            return {
                pattern_type: DaysPatternType.INTERVAL,
                interval_value: 1,
                interval_unit: "days",
            };
        }
    };

    /**
     * Handle preset change.
     * @internal
     */
    const handlePresetChange = (newPreset: FrequencyWithOneTime) => {
        if (newPreset === "One-time") {
            // When switching to one-time, call onChange with undefined and notify parent
            onChange(undefined);
            lastSentPatternRef.current = null;
            if (onFrequencyChange) {
                onFrequencyChange("One-time");
            }
            // Initialize one-time date if not already set
            if (!oneTimeDate) {
                const tomorrow = getTomorrowDate();
                setOneTimeDate(tomorrow);
                if (onOneTimeDateChange) {
                    onOneTimeDateChange(tomorrow);
                }
            }
            return;
        }

        // Set flag to prevent effect from running during preset change
        isPresetChangingRef.current = true;

        // Update builder first
        builderRef.current.setPreset(newPreset);

        // Update selectedDays if switching to weekly and it's empty
        let updatedSelectedDays = selectedDays;
        if (newPreset === "weekly" && selectedDays.length === 0) {
            updatedSelectedDays = [1]; // Default to Monday
            builderRef.current.setSelectedDays(updatedSelectedDays);
        }

        // Update state
        setPreset(newPreset);
        if (updatedSelectedDays !== selectedDays) {
            setSelectedDays(updatedSelectedDays);
        }

        // Build pattern immediately using builder (not state) to prevent blinking
        const builder = builderRef.current;
        builder.setPreset(newPreset);
        builder.setSelectedDays(updatedSelectedDays);
        builder.setMonthlyDay(monthlyDay);
        builder.setMonthlyType(monthlyType);
        builder.setWeekday(weekday);
        builder.setOrdinal(ordinal);
        builder.setYearlyMonth(yearlyMonth);
        builder.setYearlyDay(yearlyDay);

        try {
            const validationError = builder.validate();
            if (validationError) {
                if (onErrorChange) {
                    onErrorChange(validationError);
                }
            } else {
                if (onErrorChange) {
                    onErrorChange(null);
                }
                const pattern = builder.buildPattern();
                lastSentPatternRef.current = pattern;
                onChange(pattern);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Invalid pattern";
            if (onErrorChange) {
                onErrorChange(errorMessage);
            }
        }

        // Notify parent of frequency change
        if (onFrequencyChange) {
            onFrequencyChange(newPreset);
        }
    };


    /**
     * Handle one-time date change.
     * @param date - New date value (YYYY-MM-DD format)
     * @internal
     */
    const handleOneTimeDateChange = (date: string) => {
        setOneTimeDate(date);
        if (onOneTimeDateChange) {
            onOneTimeDateChange(date);
        }
    };

    /**
     * Handle day of week toggle.
     * @param dayValue - Day value (0-6, where 0=Sunday)
     * @internal
     */
    const handleDayToggle = (dayValue: number) => {
        builderRef.current.toggleDay(dayValue);
        setSelectedDays(builderRef.current.getSelectedDays());
    };

    /**
     * Update pattern when state changes.
     * Only provides a pattern for recurring frequencies, undefined for one-time.
     * @internal
     */
    useEffect(() => {
        // Don't call onChange if we're in one-time mode
        if (isOneTime) {
            return;
        }

        // Skip if we're in the middle of a preset change (handled in handlePresetChange)
        if (isPresetChangingRef.current) {
            // Clear the flag after skipping, so subsequent changes work normally
            isPresetChangingRef.current = false;
            return;
        }

        const pattern = buildPattern();
        // Track the pattern we're sending to avoid re-initializing from it
        lastSentPatternRef.current = pattern;
        // Call onChange with the pattern for recurring frequencies
        onChange(pattern);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        preset,
        selectedDays,
        monthlyDay,
        monthlyType,
        weekday,
        ordinal,
        yearlyMonth,
        yearlyDay,
        isOneTime,
    ]);

    /**
     * Initialize from value prop.
     * Only re-initialize if the value is different from what we last sent.
     * This prevents infinite loops when our onChange updates the parent's value.
     * @internal
     */
    useEffect(() => {
        // If value is undefined and we're not explicitly in one-time mode, 
        // treat it as one-time tracking
        if (!value) {
            // If frequency is explicitly set to "One-time", we're in one-time mode
            if (frequency === "One-time") {
                // Don't call onChange, we're already in one-time mode
                return;
            }
            // If no frequency is set and no value, default to daily pattern
            // (for new trackings that haven't selected frequency yet)
            if (!frequency) {
                builderRef.current = new DaysPatternBuilder();
                setPreset("daily");
                setSelectedDays([1]);
                // Immediately provide default pattern
                const defaultPattern = builderRef.current.buildPattern();
                lastSentPatternRef.current = defaultPattern;
                onChange(defaultPattern);
            }
            return;
        }

        // Check if the incoming value is the same as what we last sent
        // If so, don't re-initialize (it's our own update coming back)
        if (lastSentPatternRef.current) {
            const valueStr = JSON.stringify(value);
            const lastSentStr = JSON.stringify(lastSentPatternRef.current);
            if (valueStr === lastSentStr) {
                // This is our own update, ignore it
                return;
            }
        }

        // Value is different, re-initialize from it
        builderRef.current = new DaysPatternBuilder(value);
        const detectedPreset = builderRef.current.getPreset();
        // Only update preset if not controlled by parent
        if (!frequency || frequency === "One-time") {
            setPreset(detectedPreset);
        }
        setSelectedDays(builderRef.current.getSelectedDays());
        setMonthlyDay(builderRef.current.getMonthlyDay());
        setMonthlyType(builderRef.current.getMonthlyType());
        setWeekday(builderRef.current.getWeekday());
        setOrdinal(builderRef.current.getOrdinal());
        setYearlyMonth(builderRef.current.getYearlyMonth());
        setYearlyDay(builderRef.current.getYearlyDay());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, frequency]);

    /**
     * Sync one-time date with controlled prop.
     * @internal
     */
    useEffect(() => {
        if (controlledOneTimeDate !== undefined && controlledOneTimeDate !== oneTimeDate) {
            setOneTimeDate(controlledOneTimeDate);
        }
    }, [controlledOneTimeDate]);

    return (
        <div className="days-pattern-input">
            {!hideFrequencySelector && (
                <div className="form-label-row">
                    <label htmlFor="frequency-preset">
                        Frequency <span className="required-asterisk">*</span>{" "}
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
            )}

            <div className="frequency-field-row">
                {!hideFrequencySelector && (() => {
                    // Determine the select value
                    let selectValue: FrequencyWithOneTime;
                    if (isOneTime) {
                        selectValue = "One-time";
                    } else if (frequency && (frequency as FrequencyWithOneTime) !== "One-time") {
                        selectValue = frequency as FrequencyWithOneTime;
                    } else {
                        selectValue = preset as FrequencyWithOneTime;
                    }

                    return (
                        <select
                            id="frequency-preset"
                            value={selectValue}
                            onChange={(e) => handlePresetChange(e.target.value as FrequencyWithOneTime)}
                            disabled={disabled}
                            className="frequency-preset-select"
                            required
                        >
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="yearly">Yearly</option>
                            <option value="One-time">One-time</option>
                        </select>
                    );
                })()}

                {isOneTime && (
                    <input
                        type="date"
                        id="one-time-date"
                        name="one-time-date"
                        value={oneTimeDate}
                        onChange={(e) => handleOneTimeDateChange(e.target.value)}
                        disabled={disabled}
                        required={isOneTime}
                        min={new Date().toISOString().slice(0, 10)}
                        className="date-input-autofit"
                    />
                )}

                {!isOneTime && preset === "weekly" && (
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
                                {wd.twoLetter}
                            </button>
                        ))}
                    </div>
                )}

                {!isOneTime && preset === "monthly" && (
                    <>
                        <select
                            value={monthlyType}
                            onChange={(e) => {
                                const type = e.target.value as "day" | "last" | "weekday";
                                setMonthlyType(type);
                                builderRef.current.setMonthlyType(type);
                            }}
                            disabled={disabled}
                            className={monthlyType === "weekday" ? "monthly-weekday-select" : ""}
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
                                onChange={(e) => {
                                    const day = parseInt(e.target.value, 10) || 1;
                                    setMonthlyDay(day);
                                    builderRef.current.setMonthlyDay(day);
                                }}
                                disabled={disabled}
                                className="day-input"
                                placeholder="Day (1-31)"
                            />
                        )}

                        {monthlyType === "weekday" && (
                            <>
                                <select
                                    value={ordinal}
                                    onChange={(e) => {
                                        const ord = parseInt(e.target.value, 10);
                                        setOrdinal(ord);
                                        builderRef.current.setOrdinal(ord);
                                    }}
                                    disabled={disabled}
                                    className="monthly-weekday-select"
                                >
                                    {ordinalLabels.map((ord) => (
                                        <option key={ord.value} value={ord.value}>
                                            {ord.label}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    value={weekday}
                                    onChange={(e) => {
                                        const wd = parseInt(e.target.value, 10);
                                        setWeekday(wd);
                                        builderRef.current.setWeekday(wd);
                                    }}
                                    disabled={disabled}
                                    className="monthly-weekday-select"
                                >
                                    {weekdays.map((wd) => (
                                        <option key={wd.value} value={wd.value}>
                                            {wd.label}
                                        </option>
                                    ))}
                                </select>
                            </>
                        )}
                    </>
                )}

                {!isOneTime && preset === "yearly" && (() => {
                    const maxDays = getMaxDaysInMonth(yearlyMonth);
                    return (
                        <>
                            <select
                                value={yearlyMonth}
                                onChange={(e) => {
                                    const month = parseInt(e.target.value, 10);
                                    const maxDaysForMonth = getMaxDaysInMonth(month);
                                    // Adjust day if it's invalid for the new month
                                    const adjustedDay = yearlyDay > maxDaysForMonth ? maxDaysForMonth : yearlyDay;
                                    setYearlyMonth(month);
                                    setYearlyDay(adjustedDay);
                                    builderRef.current.setYearlyMonth(month);
                                    builderRef.current.setYearlyDay(adjustedDay);
                                }}
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
                                max={maxDays}
                                value={yearlyDay}
                                onChange={(e) => {
                                    const day = parseInt(e.target.value, 10) || 1;
                                    const clampedDay = Math.min(Math.max(day, 1), maxDays);
                                    setYearlyDay(clampedDay);
                                    builderRef.current.setYearlyDay(clampedDay);
                                }}
                                disabled={disabled}
                                className="day-input"
                                placeholder={`Day (1-${maxDays})`}
                            />
                        </>
                    );
                })()}
            </div>

            {error && (
                <div className="days-pattern-error">{error}</div>
            )}
        </div>
    );
}
