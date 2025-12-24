import { useState, FormEvent, useEffect, useRef } from "react";
import { TrackingData, DaysPattern, DaysPatternType } from "../models/Tracking";
import { ApiClient } from "../config/api";
import { DaysPatternInput } from "./DaysPatternInput";
import "./EditTrackingModal.css";
import "./TrackingForm.css";

interface EditTrackingModalProps {
    tracking: TrackingData;
    onClose: () => void;
    onSave: (
        trackingId: number,
        days: DaysPattern | undefined,
        question?: string,
        notes?: string,
        icon?: string,
        schedules?: Array<{ hour: number; minutes: number }>,
        oneTimeDate?: string
    ) => Promise<void>;
}

/**
 * Modal component for editing a tracking.
 * @param props - Component props
 * @param props.tracking - The tracking data to edit
 * @param props.onClose - Callback when modal is closed
 * @param props.onSave - Callback when tracking is saved
 * @public
 */
export function EditTrackingModal({
    tracking,
    onClose,
    onSave,
}: EditTrackingModalProps) {
    const [question, setQuestion] = useState(tracking.question);
    const [notes, setNotes] = useState(tracking.notes || "");
    const [icon, setIcon] = useState(tracking.icon || "");
    const [schedules, setSchedules] = useState<
        Array<{ hour: number; minutes: number }>
    >(
        tracking.schedules?.map((s) => ({
            hour: s.hour,
            minutes: s.minutes,
        })) || []
    );
    const [scheduleTime, setScheduleTime] = useState<string>("09:00");
    const isOneTime = !tracking.days;

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

    // For one-time trackings, try to extract date from first reminder if available
    // Otherwise default to tomorrow
    const [oneTimeDate, setOneTimeDate] = useState<string>(() => {
        if (isOneTime) {
            // TODO: Could extract from tracking.reminders if available in future
            // For now, default to tomorrow
            return getTomorrowDate();
        }
        return getTomorrowDate();
    });

    const [days, setDays] = useState<DaysPattern | undefined>(tracking.days);
    const [daysError, setDaysError] = useState<string | null>(null);
    const [currentFrequency, setCurrentFrequency] = useState<"daily" | "weekly" | "monthly" | "yearly" | "One-time">(
        isOneTime ? "One-time" : "daily"
    );
    const [isSubmitting, setIsSubmitting] = useState(false);
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
    const hasSaveErrorRef = useRef(false);
    const hasCalledOnCloseRef = useRef(false);
    const isSubmittingRef = useRef(false);

    // Reset refs on mount to prevent state pollution between tests
    useEffect(() => {
        hasSaveErrorRef.current = false;
        hasCalledOnCloseRef.current = false;
        isSubmittingRef.current = false;
    }, []);

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

        setIsSubmitting(true);
        isSubmittingRef.current = true;
        hasSaveErrorRef.current = false;
        setError(null);

        if (!question.trim()) {
            setError("Question is required");
            setIsSubmitting(false);
            return;
        }

        if (question.trim().length > 100) {
            setError("Question must not exceed 100 characters");
            setIsSubmitting(false);
            return;
        }

        if (notes.trim().length > 500) {
            setError("Notes must not exceed 500 characters");
            setIsSubmitting(false);
            return;
        }

        if (schedules.length === 0) {
            setError("At least one time is required");
            setIsSubmitting(false);
            return;
        }

        // For one-time trackings, validate oneTimeDate instead of days pattern
        if (currentFrequency === "One-time") {
            if (!oneTimeDate) {
                setError("Date is required for one-time tracking");
                setIsSubmitting(false);
                return;
            }
            // Validate date format and that it's today or in the future
            const datePattern = /^\d{4}-\d{2}-\d{2}$/;
            if (!datePattern.test(oneTimeDate)) {
                setError("Invalid date format. Expected YYYY-MM-DD");
                setIsSubmitting(false);
                return;
            }
            const oneTimeDateObj = new Date(oneTimeDate + "T00:00:00");
            if (isNaN(oneTimeDateObj.getTime())) {
                setError("Invalid date");
                setIsSubmitting(false);
                return;
            }
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const selectedDateOnly = new Date(
                oneTimeDateObj.getFullYear(),
                oneTimeDateObj.getMonth(),
                oneTimeDateObj.getDate()
            );
            if (selectedDateOnly < today) {
                setError("Date must be today or in the future");
                setIsSubmitting(false);
                return;
            }
        } else if (daysError) {
            setError(daysError);
            setIsSubmitting(false);
            return;
        }

        // Always send schedules to ensure they're preserved when other fields (like frequency) change
        const sortedNewSchedules = sortSchedules(schedules);

        try {
            // Check if icon has changed - need to handle empty string to clear icon
            const trimmedIcon = icon.trim();
            const originalIcon = tracking.icon || "";
            const iconChanged = trimmedIcon !== originalIcon;
            // When icon changed: pass empty string to clear, or the trimmed value; when unchanged: pass undefined to skip update
            const iconValue = iconChanged ? (trimmedIcon || "") : undefined;

            await onSave(
                tracking.id,
                currentFrequency === "One-time" ? undefined : days, // Pass undefined for one-time trackings
                question.trim() !== tracking.question ? question.trim() : undefined,
                notes.trim() !== (tracking.notes || "") ? notes.trim() || undefined : undefined,
                iconValue,
                sortedNewSchedules, // Always send schedules to preserve them when frequency changes
                currentFrequency === "One-time" ? oneTimeDate : undefined // Pass oneTimeDate for one-time trackings
            );
            if (!hasSaveErrorRef.current) {
                onClose();
            }
        } catch (err) {
            hasSaveErrorRef.current = true;
            setError(err instanceof Error ? err.message : "Error updating tracking");
        } finally {
            setIsSubmitting(false);
            isSubmittingRef.current = false;
        }
    };


    // Escape key and overlay click to close modal are disabled

    return (
        <div className="modal-overlay">
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Edit tracking</h2>
                    <button
                        type="button"
                        className="modal-close"
                        onClick={() => {
                            if (!hasCalledOnCloseRef.current) {
                                hasCalledOnCloseRef.current = true;
                                onClose();
                            }
                        }}
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="edit-tracking-form">
                    {error && (
                        <div className="message error show">
                            <span className="message-text">{error}</span>
                            <button
                                type="button"
                                className="message-close"
                                onClick={() => {
                                    setError(null);
                                    hasSaveErrorRef.current = false;
                                }}
                                aria-label="Close"
                            >
                                ×
                            </button>
                        </div>
                    )}

                    <div className="form-group">
                        <div className="form-label-row">
                            <label htmlFor="edit-tracking-question">
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
                                id="edit-tracking-question"
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
                                    <label htmlFor="edit-tracking-icon">
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
                                        id="edit-tracking-icon"
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
                            <label htmlFor="edit-tracking-schedules">
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
                                    id="edit-schedule-time"
                                    name="edit-schedule-time"
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
                        <DaysPatternInput
                            value={days}
                            onChange={(pattern) => setDays(pattern)}
                            disabled={isSubmitting}
                            error={daysError}
                            onErrorChange={setDaysError}
                            frequency={currentFrequency}
                            onFrequencyChange={(freq) => {
                                setCurrentFrequency(freq);
                                if (freq === "One-time") {
                                    setDays(undefined);
                                }
                            }}
                            oneTimeDate={currentFrequency === "One-time" ? oneTimeDate : undefined}
                            onOneTimeDateChange={(date) => setOneTimeDate(date)}
                        />
                    </div>

                    <div className="form-group">
                        <div className="form-label-row">
                            <label htmlFor="edit-tracking-notes">
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
                            id="edit-tracking-notes"
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
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => {
                                if (!hasCalledOnCloseRef.current) {
                                    hasCalledOnCloseRef.current = true;
                                    onClose();
                                }
                            }}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn-primary create-tracking-button"
                            disabled={
                                isSubmitting ||
                                !question.trim() ||
                                schedules.length === 0
                            }
                        >
                            {isSubmitting ? "Saving..." : "Save"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

