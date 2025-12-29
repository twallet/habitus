import { useState, useEffect, useRef } from "react";
import { Frequency } from "../models/Tracking";
import { FrequencyBuilder, FrequencyPreset } from "../models/FrequencyBuilder";
import "./FrequencyInput.css";

interface FrequencyInputProps {
    value: Frequency;
    onChange: (frequency: Frequency) => void;
    disabled?: boolean;
    error?: string | null;
    onErrorChange?: (error: string | null) => void;
    hideFrequencySelector?: boolean;
    frequency?: FrequencyPreset;
    onFrequencyChange?: (frequency: FrequencyPreset) => void;
}

/**
 * Component for selecting/editing frequency patterns for reminder schedules.
 * Simplified UI starting with Daily/Weekly/Monthly/Yearly/One-time choice.
 * @param props - Component props
 * @param props.value - Current frequency value (required)
 * @param props.onChange - Callback when frequency changes
 * @param props.disabled - Whether the input is disabled
 * @param props.error - Error message to display
 * @param props.onErrorChange - Callback when error changes
 * @public
 */
export function FrequencyInput({
    value,
    onChange,
    disabled = false,
    error,
    onErrorChange,
    hideFrequencySelector = false,
    frequency,
    onFrequencyChange,
}: FrequencyInputProps) {
    const builderRef = useRef<FrequencyBuilder>(new FrequencyBuilder(value));
    // Track the last frequency we sent to parent to avoid re-initializing from our own updates
    const lastSentFrequencyRef = useRef<Frequency | null>(null);
    // Track if we're in the middle of a preset change to prevent effect from running
    const isPresetChangingRef = useRef<boolean>(false);
    // Use controlled frequency if provided, otherwise use internal state
    const internalPreset = builderRef.current.getPreset();
    const [preset, setPreset] = useState<FrequencyPreset>(
        frequency || internalPreset
    );

    // Sync with controlled frequency prop
    useEffect(() => {
        if (frequency) {
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
    const [oneTimeDate, setOneTimeDate] = useState<string>(
        builderRef.current.getOneTimeDate()
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
     * Update builder with current state and build frequency.
     * @internal
     */
    const buildFrequency = (): Frequency => {
        const builder = builderRef.current;
        builder.setPreset(preset);
        builder.setSelectedDays(selectedDays);
        builder.setMonthlyDay(monthlyDay);
        builder.setMonthlyType(monthlyType);
        builder.setWeekday(weekday);
        builder.setOrdinal(ordinal);
        builder.setYearlyMonth(yearlyMonth);
        builder.setYearlyDay(yearlyDay);
        builder.setOneTimeDate(oneTimeDate);

        try {
            const validationError = builder.validate();
            if (validationError) {
                if (onErrorChange) {
                    onErrorChange(validationError);
                }
                // Return a default frequency even on validation error
                return { type: "daily" };
            }
            if (onErrorChange) {
                onErrorChange(null);
            }
            return builder.buildFrequency();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Invalid frequency";
            if (onErrorChange) {
                onErrorChange(errorMessage);
            }
            // Return a default frequency even on error
            return { type: "daily" };
        }
    };

    /**
     * Handle preset change.
     * @internal
     */
    const handlePresetChange = (newPreset: FrequencyPreset) => {
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

        // Initialize one-time date if switching to one-time
        if (newPreset === "one-time" && !oneTimeDate) {
            // Use local time to get today's date in YYYY-MM-DD format
            const today = new Date();
            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
            setOneTimeDate(todayStr);
            builderRef.current.setOneTimeDate(todayStr);
        }

        // Update state
        setPreset(newPreset);
        if (updatedSelectedDays !== selectedDays) {
            setSelectedDays(updatedSelectedDays);
        }

        // Build frequency immediately using builder (not state) to prevent blinking
        const builder = builderRef.current;
        builder.setPreset(newPreset);
        builder.setSelectedDays(updatedSelectedDays);
        builder.setMonthlyDay(monthlyDay);
        builder.setMonthlyType(monthlyType);
        builder.setWeekday(weekday);
        builder.setOrdinal(ordinal);
        builder.setYearlyMonth(yearlyMonth);
        builder.setYearlyDay(yearlyDay);
        if (newPreset === "one-time") {
            builder.setOneTimeDate(oneTimeDate || new Date().toISOString().slice(0, 10));
        }

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
                const frequency = builder.buildFrequency();
                lastSentFrequencyRef.current = frequency;
                onChange(frequency);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Invalid frequency";
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
        builderRef.current.setOneTimeDate(date);
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
     * Update frequency when state changes.
     * @internal
     */
    useEffect(() => {
        // Skip if we're in the middle of a preset change (handled in handlePresetChange)
        if (isPresetChangingRef.current) {
            // Clear the flag after skipping, so subsequent changes work normally
            isPresetChangingRef.current = false;
            return;
        }

        const frequency = buildFrequency();
        // Track the frequency we're sending to avoid re-initializing from it
        lastSentFrequencyRef.current = frequency;
        // Call onChange with the frequency
        onChange(frequency);
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
        oneTimeDate,
    ]);

    /**
     * Initialize from value prop.
     * Only re-initialize if the value is different from what we last sent.
     * This prevents infinite loops when our onChange updates the parent's value.
     * @internal
     */
    useEffect(() => {
        // Check if the incoming value is the same as what we last sent
        // If so, don't re-initialize (it's our own update coming back)
        if (lastSentFrequencyRef.current) {
            const valueStr = JSON.stringify(value);
            const lastSentStr = JSON.stringify(lastSentFrequencyRef.current);
            if (valueStr === lastSentStr) {
                // This is our own update, ignore it
                return;
            }
        }

        // Value is different, re-initialize from it
        builderRef.current = new FrequencyBuilder(value);
        const detectedPreset = builderRef.current.getPreset();
        // Only update preset if not controlled by parent
        if (!frequency) {
            setPreset(detectedPreset);
        }
        setSelectedDays(builderRef.current.getSelectedDays());
        setMonthlyDay(builderRef.current.getMonthlyDay());
        setMonthlyType(builderRef.current.getMonthlyType());
        setWeekday(builderRef.current.getWeekday());
        setOrdinal(builderRef.current.getOrdinal());
        setYearlyMonth(builderRef.current.getYearlyMonth());
        setYearlyDay(builderRef.current.getYearlyDay());
        setOneTimeDate(builderRef.current.getOneTimeDate());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, frequency]);


    return (
        <div className="frequency-input">
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
                {!hideFrequencySelector && (
                    <select
                        id="frequency-preset"
                        value={preset}
                        onChange={(e) => handlePresetChange(e.target.value as FrequencyPreset)}
                        disabled={disabled}
                        className="frequency-preset-select"
                        required
                    >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                        <option value="one-time">One-time</option>
                    </select>
                )}

                {preset === "one-time" && (
                    <input
                        type="date"
                        id="one-time-date"
                        name="one-time-date"
                        value={oneTimeDate}
                        onChange={(e) => handleOneTimeDateChange(e.target.value)}
                        disabled={disabled}
                        required={preset === "one-time"}
                        min={(() => {
                            // Use local time to get today's date in YYYY-MM-DD format
                            const today = new Date();
                            return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
                        })()}
                        className="date-input-autofit"
                    />
                )}

                {preset === "weekly" && (
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

                {preset === "monthly" && (
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

                {preset === "yearly" && (() => {
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
                <div className="frequency-input-error">{error}</div>
            )}
        </div>
    );
}

