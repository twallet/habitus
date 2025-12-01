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
        icon?: string
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

        try {
            await onSave(
                tracking.id,
                question.trim() !== tracking.question ? question.trim() : undefined,
                type !== tracking.type ? type : undefined,
                notes.trim() !== (tracking.notes || "") ? notes.trim() || undefined : undefined,
                icon.trim() !== (tracking.icon || "") ? icon.trim() || undefined : undefined
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
                            disabled={isSubmitting || !question.trim()}
                        >
                            {isSubmitting ? "Saving..." : "Save Changes"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

