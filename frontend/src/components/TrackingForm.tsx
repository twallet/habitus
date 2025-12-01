import { useState, FormEvent } from "react";
import { TrackingType } from "../models/Tracking";
import { ApiClient } from "../config/api";
import "./TrackingForm.css";

interface TrackingFormProps {
    onSubmit: (
        question: string,
        type: TrackingType,
        notes?: string,
        icon?: string
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
    const [notes, setNotes] = useState("");
    const [icon, setIcon] = useState("");
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
                notes.trim() || undefined,
                icon.trim() || undefined
            );
            // Reset form on success
            setQuestion("");
            setType(TrackingType.TRUE_FALSE);
            setNotes("");
            setIcon("");
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
                        maxLength={500}
                        rows={3}
                    />
                    <span className="char-count">
                        {question.length}/500
                    </span>
                </div>

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

            <div className="form-group">
                <div className="form-label-row">
                    <label htmlFor="tracking-type">
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
                    id="tracking-type"
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
                    rows={4}
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
                    disabled={isSubmitting || !question.trim()}
                >
                    {isSubmitting ? "Creating..." : "Create Tracking"}
                </button>
            </div>
        </form>
    );
}

