import { useState, FormEvent, useEffect } from "react";
import { TrackingData, TrackingType } from "../models/Tracking";
import "./EditTrackingModal.css";

interface EditTrackingModalProps {
    tracking: TrackingData;
    onClose: () => void;
    onSave: (
        trackingId: number,
        question?: string,
        type?: TrackingType,
        startTrackingDate?: string,
        notes?: string
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
    const [startTrackingDate, setStartTrackingDate] = useState(() => {
        // Convert ISO date to datetime-local format
        if (tracking.start_tracking_date) {
            const date = new Date(tracking.start_tracking_date);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const day = String(date.getDate()).padStart(2, "0");
            const hours = String(date.getHours()).padStart(2, "0");
            const minutes = String(date.getMinutes()).padStart(2, "0");
            return `${year}-${month}-${day}T${hours}:${minutes}`;
        }
        return "";
    });
    const [notes, setNotes] = useState(tracking.notes || "");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

    /**
     * Handle form submission.
     * @param e - Form submission event
     * @internal
     */
    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
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
                startTrackingDate || undefined,
                notes.trim() !== (tracking.notes || "") ? notes.trim() || undefined : undefined
            );
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error updating tracking");
        } finally {
            setIsSubmitting(false);
        }
    };

    /**
     * Handle delete confirmation.
     * @internal
     */
    const handleDelete = async () => {
        setIsDeleting(true);
        setError(null);

        try {
            await onDelete(tracking.id);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error deleting tracking");
            setIsDeleting(false);
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
                } else {
                    onClose();
                }
            }
        };

        document.addEventListener("keydown", handleEscape);
        return () => {
            document.removeEventListener("keydown", handleEscape);
        };
    }, [onClose, showDeleteConfirmation]);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Edit Tracking</h2>
                    <button
                        type="button"
                        className="modal-close"
                        onClick={onClose}
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
                                onClick={() => setError(null)}
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
                        <label htmlFor="edit-tracking-type">Type *</label>
                        <select
                            id="edit-tracking-type"
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
                        <label htmlFor="edit-tracking-start-date">
                            Start Tracking Date
                        </label>
                        <input
                            type="datetime-local"
                            id="edit-tracking-start-date"
                            name="startTrackingDate"
                            value={startTrackingDate}
                            onChange={(e) => setStartTrackingDate(e.target.value)}
                            disabled={isSubmitting}
                        />
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
                                onClick={onClose}
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

