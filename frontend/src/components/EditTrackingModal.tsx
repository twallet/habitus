import { useState, FormEvent, useEffect, useRef } from "react";
import { TrackingData, TrackingType } from "../models/Tracking";
import { ApiClient } from "../config/api";
import "./EditTrackingModal.css";

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
    onDelete: (trackingId: number) => Promise<void>;
}

/**
 * Modal component for editing a tracking.
 * @param props - Component props
 * @param props.tracking - The tracking data to edit
 * @param props.onClose - Callback when modal is closed
 * @param props.onSave - Callback when tracking is saved
 * @param props.onDelete - Callback when tracking is deleted
 * @public
 */
export function EditTrackingModal({
    tracking,
    onClose,
    onSave,
    onDelete,
}: EditTrackingModalProps) {
    const [question, setQuestion] = useState(tracking.question);
    const [type, setType] = useState<TrackingType>(tracking.type);
    const [notes, setNotes] = useState(tracking.notes || "");
    const [icon, setIcon] = useState(tracking.icon || "");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
    const [isSuggestingEmoji, setIsSuggestingEmoji] = useState(false);
    const [apiClient] = useState(() => {
        const client = new ApiClient();
        const token = localStorage.getItem("habitus_token");
        if (token) {
            client.setToken(token);
        }
        return client;
    });
    const isDeletingRef = useRef(false);
    const hasDeleteErrorRef = useRef(false);
    const hasSaveErrorRef = useRef(false);
    const hasCalledOnCloseRef = useRef(false);
    const isSubmittingRef = useRef(false);

    // Reset refs on mount to prevent state pollution between tests
    useEffect(() => {
        isDeletingRef.current = false;
        hasDeleteErrorRef.current = false;
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

        // Prevent submission if currently deleting or delete confirmation is showing
        // Also check if the submitter is a delete button
        const submitter = (e.nativeEvent as SubmitEvent).submitter;
        if (isDeleting || isDeletingRef.current || showDeleteConfirmation ||
            (submitter && submitter.classList.contains('btn-delete'))) {
            return;
        }

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

        try {
            await onSave(
                tracking.id,
                question.trim() !== tracking.question ? question.trim() : undefined,
                type !== tracking.type ? type : undefined,
                notes.trim() !== (tracking.notes || "") ? notes.trim() || undefined : undefined,
                icon.trim() !== (tracking.icon || "") ? icon.trim() || undefined : undefined
            );
            onClose();
        } catch (err) {
            hasSaveErrorRef.current = true;
            setError(err instanceof Error ? err.message : "Error updating tracking");
        } finally {
            setIsSubmitting(false);
            isSubmittingRef.current = false;
        }
    };

    /**
     * Handle delete confirmation.
     * @internal
     */
    const handleDelete = async () => {
        isDeletingRef.current = true;
        hasDeleteErrorRef.current = false;
        setIsDeleting(true);
        setError(null);

        try {
            await onDelete(tracking.id);
            hasDeleteErrorRef.current = false;
            isDeletingRef.current = false;
            setIsDeleting(false);
            if (!hasCalledOnCloseRef.current) {
                hasCalledOnCloseRef.current = true;
                onClose();
            }
        } catch (err) {
            hasDeleteErrorRef.current = true;
            isDeletingRef.current = false;
            setIsDeleting(false);
            setError(err instanceof Error ? err.message : "Error deleting tracking");
            setShowDeleteConfirmation(false);
        }
    };

    /**
     * Handle escape key to close modal.
     * @internal
     */
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (showDeleteConfirmation) {
                    setShowDeleteConfirmation(false);
                } else if (!isDeleting && !isSubmitting && !isSubmittingRef.current && !error && !hasSaveErrorRef.current && !hasCalledOnCloseRef.current) {
                    hasCalledOnCloseRef.current = true;
                    onClose();
                }
            }
        };

        document.addEventListener("keydown", handleEscape);
        return () => {
            document.removeEventListener("keydown", handleEscape);
        };
    }, [onClose, showDeleteConfirmation, isDeleting, isSubmitting, error]);

    const handleOverlayClick = () => {
        if (!isDeleting && !isSubmitting && !isSubmittingRef.current && !error && !hasDeleteErrorRef.current && !hasSaveErrorRef.current && !hasCalledOnCloseRef.current) {
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
                                    hasDeleteErrorRef.current = false;
                                    hasSaveErrorRef.current = false;
                                }}
                                aria-label="Close"
                            >
                                ×
                            </button>
                        </div>
                    )}

                    <div className="form-group">
                        <label htmlFor="edit-tracking-question">
                            Question * <span className="field-hint">(Check status of nanohabit)</span>
                        </label>
                        <textarea
                            id="edit-tracking-question"
                            name="question"
                            placeholder="e.g., Did I drink 8 glasses of water today?"
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            disabled={isSubmitting}
                            rows={3}
                        />
                        <span className="char-count">
                            {question.length}/500
                        </span>
                    </div>

                    <div className="form-group">
                        <label htmlFor="edit-tracking-type">Type *</label>
                        <select
                            id="edit-tracking-type"
                            name="type"
                            value={type}
                            onChange={(e) => setType(e.target.value as TrackingType)}
                            disabled={isSubmitting}
                        >
                            <option value={TrackingType.TRUE_FALSE}>🔘 Yes/No</option>
                            <option value={TrackingType.REGISTER}>🖊️ Text</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label htmlFor="edit-tracking-icon">
                            Icon (Optional)
                        </label>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            <input
                                type="text"
                                id="edit-tracking-icon"
                                name="icon"
                                placeholder="e.g., 💉"
                                value={icon}
                                onChange={(e) => setIcon(e.target.value)}
                                disabled={isSubmitting}
                                maxLength={20}
                                style={{ flex: 1 }}
                            />
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={handleSuggestEmoji}
                                disabled={isSubmitting || isSuggestingEmoji || !question.trim()}
                                style={{ whiteSpace: "nowrap" }}
                            >
                                {isSuggestingEmoji ? "Suggesting..." : "Suggest Emoji"}
                            </button>
                        </div>
                        <span className="field-hint">
                            Enter an emoji or click "Suggest Emoji" to get an AI suggestion
                        </span>
                    </div>

                    <div className="form-group">
                        <label htmlFor="edit-tracking-notes">Notes (Optional)</label>
                        <textarea
                            id="edit-tracking-notes"
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

                    <div className="modal-actions">
                        <button
                            type="button"
                            className="btn-delete"
                            onClick={() => setShowDeleteConfirmation(true)}
                            disabled={isSubmitting || isDeleting}
                        >
                            Delete
                        </button>
                        <div className="modal-actions-right">
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => {
                                    if (!hasCalledOnCloseRef.current) {
                                        hasCalledOnCloseRef.current = true;
                                        onClose();
                                    }
                                }}
                                disabled={isSubmitting || isDeleting}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="btn-primary"
                                disabled={isSubmitting || isDeleting}
                            >
                                {isSubmitting ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </div>

                    {showDeleteConfirmation && (
                        <div className="delete-confirmation" onClick={(e) => e.stopPropagation()}>
                            <p>Are you sure you want to delete this tracking?</p>
                            <div className="delete-confirmation-actions">
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setShowDeleteConfirmation(false);
                                    }}
                                    disabled={isDeleting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="btn-delete"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleDelete();
                                    }}
                                    disabled={isDeleting}
                                >
                                    {isDeleting ? "Deleting..." : "Delete"}
                                </button>
                            </div>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}

