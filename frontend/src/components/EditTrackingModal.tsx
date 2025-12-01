import { useState, FormEvent, useEffect, useRef } from "react";
import { TrackingData, TrackingType } from "../models/Tracking";
import { ApiClient } from "../config/api";
import "./EditTrackingModal.css";
import "./TrackingForm.css";

interface EditTrackingModalProps {
    tracking: TrackingData;
    onClose: () => void;
    onSave: (
        trackingId: number,
        question?: string,
        type?: TrackingType,
        notes?: string,
        icon?: string,
        schedules?: Array<{ hour: number; minutes: number }>
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
    const [type, setType] = useState<TrackingType>(tracking.type);
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
    const [scheduleHour, setScheduleHour] = useState<number>(0);
    const [scheduleMinutes, setScheduleMinutes] = useState<number>(0);
    const [editingScheduleIndex, setEditingScheduleIndex] = useState<
        number | null
    >(null);
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

        // Validate hour and minutes
        if (
            scheduleHour < 0 ||
            scheduleHour > 23 ||
            scheduleMinutes < 0 ||
            scheduleMinutes > 59
        ) {
            setError("Hour must be 0-23 and minutes must be 0-59");
            return;
        }

        const newSchedule = { hour: scheduleHour, minutes: scheduleMinutes };

        // Check for duplicates
        const isDuplicate = schedules.some(
            (s, index) =>
                s.hour === newSchedule.hour &&
                s.minutes === newSchedule.minutes &&
                index !== editingScheduleIndex
        );

        if (isDuplicate) {
            setError(
                `Schedule ${String(scheduleHour).padStart(2, "0")}:${String(scheduleMinutes).padStart(2, "0")} already exists`
            );
            return;
        }

        if (editingScheduleIndex !== null) {
            // Update existing schedule
            const updatedSchedules = [...schedules];
            updatedSchedules[editingScheduleIndex] = newSchedule;
            setSchedules(updatedSchedules);
            setEditingScheduleIndex(null);
        } else {
            // Add new schedule
            if (schedules.length >= 5) {
                setError("Maximum 5 schedules allowed");
                return;
            }
            setSchedules([...schedules, newSchedule]);
        }

        // Reset inputs
        setScheduleHour(0);
        setScheduleMinutes(0);
    };

    /**
     * Start editing a schedule.
     * @param index - Index of schedule to edit
     * @internal
     */
    const handleEditSchedule = (index: number) => {
        const schedule = schedules[index];
        setScheduleHour(schedule.hour);
        setScheduleMinutes(schedule.minutes);
        setEditingScheduleIndex(index);
        setError(null);
    };

    /**
     * Cancel editing schedule.
     * @internal
     */
    const handleCancelEditSchedule = () => {
        setEditingScheduleIndex(null);
        setScheduleHour(0);
        setScheduleMinutes(0);
        setError(null);
    };

    /**
     * Delete a schedule.
     * @param index - Index of schedule to delete
     * @internal
     */
    const handleDeleteSchedule = (index: number) => {
        const updatedSchedules = schedules.filter((_, i) => i !== index);
        setSchedules(updatedSchedules);
        if (editingScheduleIndex === index) {
            setEditingScheduleIndex(null);
            setScheduleHour(0);
            setScheduleMinutes(0);
        } else if (
            editingScheduleIndex !== null &&
            editingScheduleIndex > index
        ) {
            setEditingScheduleIndex(editingScheduleIndex - 1);
        }
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

        if (question.trim().length > 500) {
            setError("Question must not exceed 500 characters");
            setIsSubmitting(false);
            return;
        }

        if (notes.trim().length > 500) {
            setError("Notes must not exceed 500 characters");
            setIsSubmitting(false);
            return;
        }

        if (schedules.length === 0) {
            setError("At least one schedule is required");
            setIsSubmitting(false);
            return;
        }

        // Check if schedules changed
        const originalSchedules = tracking.schedules?.map((s) => ({
            hour: s.hour,
            minutes: s.minutes,
        })) || [];
        const sortedNewSchedules = sortSchedules(schedules);
        const sortedOriginalSchedules = sortSchedules(originalSchedules);
        const schedulesChanged =
            sortedNewSchedules.length !== sortedOriginalSchedules.length ||
            sortedNewSchedules.some(
                (s, i) =>
                    s.hour !== sortedOriginalSchedules[i]?.hour ||
                    s.minutes !== sortedOriginalSchedules[i]?.minutes
            );

        try {
            await onSave(
                tracking.id,
                question.trim() !== tracking.question ? question.trim() : undefined,
                type !== tracking.type ? type : undefined,
                notes.trim() !== (tracking.notes || "") ? notes.trim() || undefined : undefined,
                icon.trim() !== (tracking.icon || "") ? icon.trim() || undefined : undefined,
                schedulesChanged ? sortedNewSchedules : undefined
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


    /**
     * Handle escape key to close modal.
     * @internal
     */
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (!isSubmitting && !isSubmittingRef.current && !error && !hasSaveErrorRef.current && !hasCalledOnCloseRef.current) {
                    hasCalledOnCloseRef.current = true;
                    onClose();
                }
            }
        };

        document.addEventListener("keydown", handleEscape);
        return () => {
            document.removeEventListener("keydown", handleEscape);
        };
    }, [onClose, isSubmitting, error]);

    const handleOverlayClick = () => {
        if (!isSubmitting && !isSubmittingRef.current && !error && !hasSaveErrorRef.current && !hasCalledOnCloseRef.current) {
            hasCalledOnCloseRef.current = true;
            onClose();
        }
    };

    return (
        <div className="modal-overlay" onClick={handleOverlayClick}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Edit Tracking</h2>
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
                                maxLength={500}
                                rows={3}
                            />
                            <span className="char-count">
                                {question.length}/500
                            </span>
                        </div>

                        <div className="icon-type-row">
                            <div className="type-field-wrapper">
                                <div className="form-label-row">
                                    <label htmlFor="edit-tracking-type">
                                        Type <span className="required-asterisk">*</span>{" "}
                                        <button
                                            type="button"
                                            className="field-help"
                                            aria-label="Type help"
                                            title="Choose whether you want a simple Yes/No tracking or a free text register."
                                        >
                                            ?
                                        </button>
                                    </label>
                                </div>
                                <select
                                    id="edit-tracking-type"
                                    name="type"
                                    value={type}
                                    onChange={(e) => setType(e.target.value as TrackingType)}
                                    required
                                    disabled={isSubmitting}
                                >
                                    <option value={TrackingType.TRUE_FALSE}>🔘 Yes/No</option>
                                    <option value={TrackingType.REGISTER}>🖊️ Text</option>
                                </select>
                            </div>
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
                            rows={4}
                        />
                        <span className="char-count">
                            {notes.length}/500
                        </span>
                    </div>

                    <div className="form-group">
                        <div className="form-label-row">
                            <label htmlFor="edit-tracking-schedules">
                                Schedules <span className="required-asterisk">*</span>{" "}
                                <button
                                    type="button"
                                    className="field-help"
                                    aria-label="Schedules help"
                                    title="Define up to 5 schedules (hour and minutes) for this tracking. At least one schedule is required."
                                >
                                    ?
                                </button>
                            </label>
                            <span className="schedule-count">
                                {schedules.length}/5 schedules
                            </span>
                        </div>
                        <div className="schedule-input-row">
                            <div className="schedule-time-inputs">
                                <label htmlFor="edit-schedule-hour">Hour</label>
                                <input
                                    type="number"
                                    id="edit-schedule-hour"
                                    name="edit-schedule-hour"
                                    min="0"
                                    max="23"
                                    value={scheduleHour}
                                    onChange={(e) =>
                                        setScheduleHour(parseInt(e.target.value) || 0)
                                    }
                                    disabled={isSubmitting}
                                />
                                <label htmlFor="edit-schedule-minutes">Minutes</label>
                                <input
                                    type="number"
                                    id="edit-schedule-minutes"
                                    name="edit-schedule-minutes"
                                    min="0"
                                    max="59"
                                    value={scheduleMinutes}
                                    onChange={(e) =>
                                        setScheduleMinutes(parseInt(e.target.value) || 0)
                                    }
                                    disabled={isSubmitting}
                                />
                            </div>
                            {editingScheduleIndex !== null ? (
                                <div className="schedule-edit-actions">
                                    <button
                                        type="button"
                                        className="btn-secondary btn-small"
                                        onClick={handleAddOrUpdateSchedule}
                                        disabled={isSubmitting}
                                    >
                                        Save
                                    </button>
                                    <button
                                        type="button"
                                        className="btn-secondary btn-small"
                                        onClick={handleCancelEditSchedule}
                                        disabled={isSubmitting}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    className="btn-secondary btn-small"
                                    onClick={handleAddOrUpdateSchedule}
                                    disabled={
                                        isSubmitting || schedules.length >= 5
                                    }
                                >
                                    Add Schedule
                                </button>
                            )}
                        </div>
                        {schedules.length > 0 && (
                            <div className="schedules-list">
                                {sortSchedules(schedules).map((schedule, index) => {
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
                                            <div className="schedule-item-actions">
                                                <button
                                                    type="button"
                                                    className="btn-icon"
                                                    onClick={() =>
                                                        handleEditSchedule(originalIndex)
                                                    }
                                                    disabled={
                                                        isSubmitting ||
                                                        editingScheduleIndex !== null
                                                    }
                                                    aria-label="Edit schedule"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn-icon"
                                                    onClick={() =>
                                                        handleDeleteSchedule(originalIndex)
                                                    }
                                                    disabled={
                                                        isSubmitting ||
                                                        editingScheduleIndex !== null
                                                    }
                                                    aria-label="Delete schedule"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
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
                            {isSubmitting ? "Saving..." : "Save Changes"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

