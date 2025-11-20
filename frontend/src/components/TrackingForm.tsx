import { useState, FormEvent } from "react";
import { TrackingType } from "../models/Tracking";
import "./TrackingForm.css";

interface TrackingFormProps {
    onSubmit: (
        question: string,
        type: TrackingType,
        startTrackingDate?: string,
        notes?: string
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
    const [type, setType] = useState<TrackingType>(TrackingType.TRUE_FALSE);
    const [startTrackingDate, setStartTrackingDate] = useState("");
    const [notes, setNotes] = useState("");
    const [error, setError] = useState<string | null>(null);

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

        if (question.trim().length > 500) {
            setError("Question must not exceed 500 characters");
            return;
        }

        try {
            await onSubmit(
                question.trim(),
                type,
                startTrackingDate || undefined,
                notes.trim() || undefined
            );
            // Reset form on success
            setQuestion("");
            setType(TrackingType.TRUE_FALSE);
            setStartTrackingDate("");
            setNotes("");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error creating tracking");
        }
    };

    return (
        <form onSubmit={handleSubmit} className="tracking-form">
            <h2>Create New Tracking</h2>

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
                <label htmlFor="tracking-question">
                    Question * <span className="field-hint">(Check status of nanohabit)</span>
                </label>
                <textarea
                    id="tracking-question"
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

            <div className="form-group">
                <label htmlFor="tracking-type">Type *</label>
                <select
                    id="tracking-type"
                    name="type"
                    value={type}
                    onChange={(e) => setType(e.target.value as TrackingType)}
                    required
                    disabled={isSubmitting}
                >
                    <option value={TrackingType.TRUE_FALSE}>True/False</option>
                    <option value={TrackingType.REGISTER}>Register</option>
                </select>
            </div>

            <div className="form-group">
                <label htmlFor="tracking-start-date">
                    Start Tracking Date (Optional)
                </label>
                <input
                    type="datetime-local"
                    id="tracking-start-date"
                    name="startTrackingDate"
                    value={startTrackingDate}
                    onChange={(e) => setStartTrackingDate(e.target.value)}
                    disabled={isSubmitting}
                />
                <span className="field-hint">
                    Leave empty to start tracking now
                </span>
            </div>

            <div className="form-group">
                <label htmlFor="tracking-notes">Notes (Optional)</label>
                <textarea
                    id="tracking-notes"
                    name="notes"
                    placeholder="Add any additional notes or context..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={isSubmitting}
                    rows={4}
                />
                <span className="field-hint">
                    Rich text editor - supports HTML formatting
                </span>
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
                    className="btn-primary"
                    disabled={isSubmitting || !question.trim()}
                >
                    {isSubmitting ? "Creating..." : "Create Tracking"}
                </button>
            </div>
        </form>
    );
}

