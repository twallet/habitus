import { useState, FormEvent } from "react";
import { DaysPattern, DaysPatternType } from "../models/Tracking";
import { ApiClient } from "../config/api";
import { DaysPatternInput } from "./DaysPatternInput";
import "./TrackingForm.css";

interface TrackingFormProps {
    onSubmit: (
        question: string,
        notes: string | undefined,
        icon: string | undefined,
        schedules: Array<{ hour: number; minutes: number }>,
        days: DaysPattern | undefined,
        oneTimeDate?: string
    ) => Promise<void>;
    onCancel?: () => void;
    isSubmitting?: boolean;
}

/**
 * Form component for creating a new tracking.
 * @param props - Component props
 * @param props.onSubmit - Callback when form is submitted
 * @param props.onCancel - Optional callback when form is cancelled
 * @param props.isSubmitting - Whether form is currently submitting
 * @public
 */
export function TrackingForm({
    onSubmit,
    onCancel,
    isSubmitting = false,
}: TrackingFormProps) {
    const [question, setQuestion] = useState("");
    const [notes, setNotes] = useState("");
    const [icon, setIcon] = useState("");
    const [schedules, setSchedules] = useState<
        Array<{ hour: number; minutes: number }>
    >([]);
    const [scheduleTime, setScheduleTime] = useState<string>("09:00");
    const [isRecurring, setIsRecurring] = useState<boolean>(true);
    const [oneTimeDate, setOneTimeDate] = useState<string>("");
    const [days, setDays] = useState<DaysPattern>({
        pattern_type: DaysPatternType.INTERVAL,
        interval_value: 1,
        interval_unit: "days",
    });
    const [daysError, setDaysError] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isSuggestingEmoji, setIsSuggestingEmoji] = useState(false);
    const [apiClient] = useState(() => {
        const client = new ApiClient();
        const token = localStorage.getItem("habitus_token");
        if (token) {
            client.setToken(token);
        }
        return client;
    });

    /**
     * Handle emoji suggestion.
     * @internal
     */
    const handleSuggestEmoji = async () => {
        if (!question.trim()) {
            setError("Please enter a question first");
            return;
        }

        setIsSuggestingEmoji(true);
        setError(null);

        try {
            const suggestedEmoji = await apiClient.suggestEmoji(question.trim());
            setIcon(suggestedEmoji);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error suggesting emoji");
        } finally {
            setIsSuggestingEmoji(false);
        }
    };

    /**
     * Add or update a schedule.
     * @internal
     */
    const handleAddOrUpdateSchedule = () => {
        setError(null);

        // Parse time string (format: "HH:MM")
        const [hourStr, minutesStr] = scheduleTime.split(":");
        const hour = parseInt(hourStr, 10);
        const minutes = parseInt(minutesStr, 10);

        // Validate hour and minutes
        if (
            isNaN(hour) ||
            isNaN(minutes) ||
            hour < 0 ||
            hour > 23 ||
            minutes < 0 ||
            minutes > 59
        ) {
            setError("Invalid time format. Please use HH:MM format (e.g., 09:00)");
            return;
        }

        const newSchedule = { hour, minutes };

        // Check for duplicates
        const isDuplicate = schedules.some(
            (s) =>
                s.hour === newSchedule.hour &&
                s.minutes === newSchedule.minutes
        );

        if (isDuplicate) {
            setError(
                `Time ${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")} already exists`
            );
            return;
        }

        // Add new schedule
        if (schedules.length >= 5) {
            setError("Maximum 5 times allowed");
            return;
        }
        setSchedules([...schedules, newSchedule]);

        // Reset input
        setScheduleTime("09:00");
    };

    /**
     * Delete a schedule.
     * @param index - Index of schedule to delete
     * @internal
     */
    const handleDeleteSchedule = (index: number) => {
        const updatedSchedules = schedules.filter((_, i) => i !== index);
        setSchedules(updatedSchedules);
        setError(null);
    };

    /**
     * Sort schedules by hour and minutes.
     * @param schedules - Array of schedules to sort
     * @returns Sorted array of schedules
     * @internal
     */
    const sortSchedules = (
        schedules: Array<{ hour: number; minutes: number }>
    ): Array<{ hour: number; minutes: number }> => {
        return [...schedules].sort((a, b) => {
            if (a.hour !== b.hour) {
                return a.hour - b.hour;
            }
            return a.minutes - b.minutes;
        });
    };

    /**
     * Handle form submission.
     * @param e - Form submission event
     * @internal
     */
    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);

        if (!question.trim()) {
            setError("Question is required");
            return;
        }

        if (question.trim().length > 100) {
            setError("Question must not exceed 100 characters");
            return;
        }

        if (notes.trim().length > 500) {
            setError("Notes must not exceed 500 characters");
            return;
        }

        if (isRecurring) {
            if (schedules.length === 0) {
                setError("At least one time is required");
                return;
            }

            if (daysError) {
                setError(daysError);
                return;
            }
        } else {
            if (!oneTimeDate) {
                setError("Date and time are required for one-time tracking");
                return;
            }

            // Validate that the date is in the future
            const selectedDate = new Date(oneTimeDate);
            const now = new Date();
            if (selectedDate <= now) {
                setError("Date and time must be in the future");
                return;
            }
        }

        try {
            await onSubmit(
                question.trim(),
                notes.trim() || undefined,
                icon.trim() || undefined,
                sortSchedules(schedules),
                isRecurring ? days : undefined,
                isRecurring ? undefined : oneTimeDate
            );
            // Reset form on success
            setQuestion("");
            setNotes("");
            setIcon("");
            setSchedules([]);
            setScheduleTime("09:00");
            setIsRecurring(true);
            setOneTimeDate("");
            setDays({
                pattern_type: DaysPatternType.INTERVAL,
                interval_value: 1,
                interval_unit: "days",
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error creating tracking");
        }
    };

    return (
        <form onSubmit={handleSubmit} className="tracking-form">
            {error && (
                <div className="message error show">
                    <span className="message-text">{error}</span>
                    <button
                        type="button"
                        className="message-close"
                        onClick={() => setError(null)}
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>
            )}

            <div className="form-group">
                <div className="form-label-row">
                    <label htmlFor="tracking-question">
                        Question <span className="required-asterisk">*</span>{" "}
                        <button
                            type="button"
                            className="field-help"
                            aria-label="Question help"
                            title="Main nanohabit question you want to track, for example 'Did I drink 8 glasses of water today?'"
                        >
                            ?
                        </button>
                    </label>
                </div>
                <div className="question-field-wrapper">
                    <textarea
                        id="tracking-question"
                        name="question"
                        placeholder="e.g., Did I drink 8 glasses of water today?"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        required
                        disabled={isSubmitting}
                        maxLength={100}
                        rows={1}
                    />
                </div>

                <div className="icon-type-row">
                    <div className="icon-field-wrapper">
                        <div className="form-label-row">
                            <label htmlFor="tracking-icon">
                                Icon{" "}
                                <button
                                    type="button"
                                    className="field-help"
                                    aria-label="Icon help"
                                    title="Optional emoji or icon to visually identify this tracking."
                                >
                                    ?
                                </button>
                            </label>
                        </div>
                        <div className="icon-input-row">
                            <input
                                type="text"
                                id="tracking-icon"
                                name="icon"
                                placeholder="e.g., 💪🏼"
                                value={icon}
                                onChange={(e) => setIcon(e.target.value)}
                                disabled={isSubmitting}
                                maxLength={30}
                            />
                            <button
                                type="button"
                                className="icon-suggest-button"
                                onClick={handleSuggestEmoji}
                                disabled={isSubmitting || isSuggestingEmoji || !question.trim()}
                                aria-label="Suggest emoji based on question"
                                title="Suggest an emoji based on the question text"
                            >
                                <span className="icon-suggest-text">{isSuggestingEmoji ? "..." : "✨"}</span>
                                <span className="sr-only">Suggest emoji</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="form-group">
                <div className="form-label-row">
                    <label htmlFor="tracking-schedules">
                        Times <span className="required-asterisk">*</span>{" "}
                        <button
                            type="button"
                            className="field-help"
                            aria-label="Times help"
                            title="Define up to 5 times (hour and minutes) when reminders will be sent for this tracking. At least one time is required."
                        >
                            ?
                        </button>
                    </label>
                </div>
                <div className="schedule-input-row">
                    <div className="schedule-time-inputs">
                        <input
                            type="time"
                            id="schedule-time"
                            name="schedule-time"
                            value={scheduleTime}
                            onChange={(e) => setScheduleTime(e.target.value)}
                            disabled={isSubmitting || schedules.length >= 5}
                        />
                    </div>
                    <button
                        type="button"
                        className="btn-primary schedule-add-button"
                        onClick={handleAddOrUpdateSchedule}
                        disabled={
                            isSubmitting || schedules.length >= 5
                        }
                    >
                        Add
                    </button>
                    {schedules.length > 0 && (
                        <div className="schedules-list">
                            {sortSchedules(schedules).map((schedule) => {
                                const originalIndex = schedules.findIndex(
                                    (s) =>
                                        s.hour === schedule.hour &&
                                        s.minutes === schedule.minutes
                                );
                                return (
                                    <div
                                        key={`${schedule.hour}-${schedule.minutes}-${originalIndex}`}
                                        className="schedule-item"
                                    >
                                        <span className="schedule-time">
                                            {String(schedule.hour).padStart(2, "0")}:
                                            {String(schedule.minutes).padStart(2, "0")}
                                        </span>
                                        <button
                                            type="button"
                                            className="btn-icon"
                                            onClick={() =>
                                                handleDeleteSchedule(originalIndex)
                                            }
                                            disabled={isSubmitting}
                                            aria-label="Delete schedule"
                                        >
                                            ×
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            <div className="form-group">
                <div className="form-label-row">
                    <label>
                        Type{" "}
                        <button
                            type="button"
                            className="field-help"
                            aria-label="Type help"
                            title="Choose whether this tracking should repeat regularly or happen only once"
                        >
                            ?
                        </button>
                    </label>
                </div>
                <div className="recurring-toggle-row">
                    <button
                        type="button"
                        className={`recurring-toggle-button ${isRecurring ? "active" : ""}`}
                        onClick={() => setIsRecurring(true)}
                        disabled={isSubmitting}
                    >
                        Recurring
                    </button>
                    <button
                        type="button"
                        className={`recurring-toggle-button ${!isRecurring ? "active" : ""}`}
                        onClick={() => setIsRecurring(false)}
                        disabled={isSubmitting}
                    >
                        One-time
                    </button>
                </div>
            </div>

            {isRecurring ? (
                <div className="form-group">
                    <DaysPatternInput
                        value={days}
                        onChange={setDays}
                        disabled={isSubmitting}
                        error={daysError}
                        onErrorChange={setDaysError}
                    />
                </div>
            ) : (
                <div className="form-group">
                    <div className="form-label-row">
                        <label htmlFor="one-time-date">
                            Date & Time <span className="required-asterisk">*</span>{" "}
                            <button
                                type="button"
                                className="field-help"
                                aria-label="Date and time help"
                                title="Select the date and time when you want to be reminded for this one-time tracking"
                            >
                                ?
                            </button>
                        </label>
                    </div>
                    <input
                        type="datetime-local"
                        id="one-time-date"
                        name="one-time-date"
                        value={oneTimeDate}
                        onChange={(e) => setOneTimeDate(e.target.value)}
                        disabled={isSubmitting}
                        required={!isRecurring}
                        min={new Date().toISOString().slice(0, 16)}
                    />
                </div>
            )}

            <div className="form-group">
                <div className="form-label-row">
                    <label htmlFor="tracking-notes">
                        Notes{" "}
                        <button
                            type="button"
                            className="field-help"
                            aria-label="Notes help"
                            title="Add any extra context or details you want to remember about this tracking."
                        >
                            ?
                        </button>
                    </label>
                </div>
                <textarea
                    id="tracking-notes"
                    name="notes"
                    placeholder="Add any additional notes or context..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={isSubmitting}
                    maxLength={500}
                    rows={2}
                />
            </div>

            <div className="form-actions">
                {onCancel && (
                    <button
                        type="button"
                        className="btn-secondary"
                        onClick={onCancel}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                )}
                <button
                    type="submit"
                    className="btn-primary create-tracking-button"
                    disabled={
                        isSubmitting ||
                        !question.trim() ||
                        (isRecurring && schedules.length === 0) ||
                        (!isRecurring && !oneTimeDate)
                    }
                >
                    {isSubmitting ? "Creating..." : "Create"}
                </button>
            </div>
        </form>
    );
}

