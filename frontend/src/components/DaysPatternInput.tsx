import { useState, useEffect, useRef } from "react";
import { DaysPattern } from "../models/Tracking";
import { DaysPatternBuilder, FrequencyPreset } from "../models/DaysPatternBuilder";
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
    const builderRef = useRef<DaysPatternBuilder>(new DaysPatternBuilder(value));
    const [preset, setPreset] = useState<FrequencyPreset>(
        builderRef.current.getPreset()
    );
    const [intervalValue, setIntervalValue] = useState<number>(
        builderRef.current.getIntervalValue()
    );
    const [intervalUnit, setIntervalUnit] = useState<
        "days" | "weeks" | "months" | "years"
    >(builderRef.current.getIntervalUnit());
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
     * Update builder with current state and build pattern.
     * @internal
     */
    const buildPattern = (): DaysPattern | undefined => {
        const builder = builderRef.current;
        builder.setPreset(preset);
        builder.setIntervalValue(intervalValue);
        builder.setIntervalUnit(intervalUnit);
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
                return undefined;
            }
            if (onErrorChange) {
                onErrorChange(null);
            }
            return builder.buildPattern(value);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Invalid pattern";
            if (onErrorChange) {
                onErrorChange(errorMessage);
            }
            return undefined;
        }
    };

    /**
     * Handle preset change.
     * @internal
     */
    const handlePresetChange = (newPreset: FrequencyPreset) => {
        setPreset(newPreset);
        builderRef.current.setPreset(newPreset);
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
        builderRef.current.toggleDay(dayValue);
        setSelectedDays(builderRef.current.getSelectedDays());
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
            builderRef.current = new DaysPatternBuilder(value);
            const detectedPreset = builderRef.current.getPreset();
            setPreset(detectedPreset);
            setIntervalValue(builderRef.current.getIntervalValue());
            setIntervalUnit(builderRef.current.getIntervalUnit());
            setSelectedDays(builderRef.current.getSelectedDays());
            setMonthlyDay(builderRef.current.getMonthlyDay());
            setMonthlyType(builderRef.current.getMonthlyType());
            setWeekday(builderRef.current.getWeekday());
            setOrdinal(builderRef.current.getOrdinal());
            setYearlyMonth(builderRef.current.getYearlyMonth());
            setYearlyDay(builderRef.current.getYearlyDay());
        } else {
            builderRef.current = new DaysPatternBuilder();
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
                            onChange={(e) => {
                                const val = parseInt(e.target.value, 10) || 1;
                                setIntervalValue(val);
                                builderRef.current.setIntervalValue(val);
                            }}
                            disabled={disabled}
                            className="interval-value-input"
                        />
                        <select
                            value={intervalUnit}
                            onChange={(e) => {
                                const unit = e.target.value as "days" | "weeks" | "months" | "years";
                                setIntervalUnit(unit);
                                builderRef.current.setIntervalUnit(unit);
                            }}
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
                            onChange={(e) => {
                                const type = e.target.value as "day" | "last" | "weekday";
                                setMonthlyType(type);
                                builderRef.current.setMonthlyType(type);
                            }}
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
                                onChange={(e) => {
                                    const day = parseInt(e.target.value, 10) || 1;
                                    setMonthlyDay(day);
                                    builderRef.current.setMonthlyDay(day);
                                }}
                                disabled={disabled}
                                className="day-input"
                            />
                        )}

                        {monthlyType === "weekday" && (
                            <div className="weekday-ordinal-inputs">
                                <select
                                    value={ordinal}
                                    onChange={(e) => {
                                        const ord = parseInt(e.target.value, 10);
                                        setOrdinal(ord);
                                        builderRef.current.setOrdinal(ord);
                                    }}
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
                                    onChange={(e) => {
                                        const wd = parseInt(e.target.value, 10);
                                        setWeekday(wd);
                                        builderRef.current.setWeekday(wd);
                                    }}
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
                            onChange={(e) => {
                                const month = parseInt(e.target.value, 10);
                                setYearlyMonth(month);
                                builderRef.current.setYearlyMonth(month);
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
                            max="31"
                            value={yearlyDay}
                            onChange={(e) => {
                                const day = parseInt(e.target.value, 10) || 1;
                                setYearlyDay(day);
                                builderRef.current.setYearlyDay(day);
                            }}
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
