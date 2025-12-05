import { useState, FormEvent, useRef } from "react";
import { ReminderData } from "../models/Reminder";
import { TrackingData } from "../models/Tracking";
import { ReminderFormatter } from "./RemindersList";
import "./ReminderAnswerModal.css";
import "./EditTrackingModal.css";

interface ReminderAnswerModalProps {
    reminder: ReminderData;
    tracking: TrackingData | undefined;
    onClose: () => void;
    onSave: (reminderId: number, answer: string, notes: string) => Promise<void>;
}

/**
 * Modal component for answering/editing a reminder.
 * @param props - Component props
 * @param props.reminder - The reminder data to answer/edit
 * @param props.tracking - The tracking data (optional)
 * @param props.onClose - Callback when modal is closed
 * @param props.onSave - Callback when reminder is saved
 * @public
 */
export function ReminderAnswerModal({
    reminder,
    tracking,
    onClose,
    onSave,
}: ReminderAnswerModalProps) {
    const [answer, setAnswer] = useState("");
    const [notes, setNotes] = useState(reminder.notes || "");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const hasCalledOnCloseRef = useRef(false);

    /**
     * Handle form submission.
     * @param e - Form submission event
     * @internal
     */
    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        // Validate that answer is provided
        if (!answer.trim()) {
            setError("Answer is required");
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await onSave(reminder.id, answer.trim(), notes.trim());
            if (!hasCalledOnCloseRef.current) {
                hasCalledOnCloseRef.current = true;
                onClose();
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error saving reminder");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Escape key and overlay click to close modal are disabled

    return (
        <div className="modal-overlay">
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Answer reminder</h2>
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

                <form onSubmit={handleSubmit} className="reminder-answer-form">
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
                        <div className="form-field-readonly time-field">
                            Time: {ReminderFormatter.formatDateTime(reminder.scheduled_time)}
                        </div>
                    </div>

                    <div className="form-group">
                        <div className="form-field-readonly tracking-field">
                            Tracking: {tracking ? (
                                <>
                                    {tracking.icon && (
                                        <span className="tracking-icon">{tracking.icon}</span>
                                    )}
                                    {tracking.question}
                                </>
                            ) : (
                                "Unknown tracking"
                            )}
                        </div>
                    </div>

                    <div className="form-group">
                        <div className="form-label-row">
                            <label htmlFor="reminder-answer">
                                Answer <span className="required-asterisk">*</span>{" "}
                                <button
                                    type="button"
                                    className="field-help"
                                    aria-label="Answer help"
                                    title="Maximum length: 500 characters"
                                >
                                    ?
                                </button>
                            </label>
                        </div>
                        <textarea
                            id="reminder-answer"
                            name="answer"
                            placeholder="Enter your answer..."
                            value={answer}
                            onChange={(e) => setAnswer(e.target.value)}
                            disabled={isSubmitting}
                            rows={3}
                        />
                    </div>

                    <div className="form-group">
                        <div className="form-label-row">
                            <label htmlFor="reminder-notes">
                                Notes{" "}
                                <button
                                    type="button"
                                    className="field-help"
                                    aria-label="Notes help"
                                    title="Add any additional notes or context"
                                >
                                    ?
                                </button>
                            </label>
                        </div>
                        <textarea
                            id="reminder-notes"
                            name="notes"
                            placeholder="Add any additional notes..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            disabled={isSubmitting}
                            rows={3}
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
                            className="btn-primary"
                            disabled={isSubmitting || !answer.trim()}
                        >
                            {isSubmitting ? "Saving..." : "Save"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

