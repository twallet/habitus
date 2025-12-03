import { useState, FormEvent, useEffect, useRef } from 'react';
import { TrackingData } from '../models/Tracking';
import './DeleteTrackingConfirmationModal.css';

interface DeleteTrackingConfirmationModalProps {
    tracking: TrackingData;
    onClose: () => void;
    onConfirm: () => Promise<void>;
}

/**
 * Modal component for confirming tracking deletion.
 * Requires typing "DELETE" to confirm deletion.
 * @param props - Component props
 * @param props.tracking - The tracking to delete
 * @param props.onClose - Callback when modal is closed
 * @param props.onConfirm - Callback when deletion is confirmed
 * @public
 */
export function DeleteTrackingConfirmationModal({
    tracking,
    onClose,
    onConfirm,
}: DeleteTrackingConfirmationModalProps) {
    const [confirmationText, setConfirmationText] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const isDeletingRef = useRef(isDeleting);
    const errorRef = useRef(error);

    // Sync refs with state to ensure they're always up to date
    useEffect(() => {
        isDeletingRef.current = isDeleting;
    }, [isDeleting]);

    useEffect(() => {
        errorRef.current = error;
    }, [error]);

    const isConfirmEnabled = confirmationText === 'DELETE';

    /**
     * Handle form submission.
     * @param e - Form submission event
     * @internal
     */
    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (!isConfirmEnabled) {
            return;
        }

        setIsDeleting(true);
        isDeletingRef.current = true;
        setError(null);
        errorRef.current = null;

        try {
            await onConfirm();
            onClose();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Error deleting tracking';
            setError(errorMessage);
            errorRef.current = errorMessage;
        } finally {
            setIsDeleting(false);
            isDeletingRef.current = false;
        }
    };

    /**
     * Handle escape key to close modal.
     * Uses refs to always check the latest state values.
     * @internal
     */
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isDeletingRef.current && !errorRef.current) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('keydown', handleEscape);
        };
    }, [onClose]);

    const handleOverlayClick = () => {
        if (!isDeletingRef.current && !errorRef.current) {
            onClose();
        }
    };

    return (
        <div className="modal-overlay" onClick={handleOverlayClick}>
            <div className="modal-content delete-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Delete Tracking</h2>
                    <button
                        type="button"
                        className="modal-close"
                        onClick={onClose}
                        aria-label="Close"
                        disabled={isDeleting}
                    >
                        ×
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="delete-confirmation-form">
                    <div className="delete-warning">
                        <p>
                            Are you sure you want to delete the tracking <strong>"{tracking.question}"</strong>?
                        </p>
                        <p>
                            This tracking will be permanently deleted and cannot be recovered.
                        </p>
                        <p>
                            This action cannot be undone.
                        </p>
                    </div>

                    <div className="form-group">
                        <label htmlFor="delete-confirmation">
                            Type <strong>DELETE</strong> to confirm:
                        </label>
                        <input
                            type="text"
                            id="delete-confirmation"
                            name="confirmation"
                            placeholder="DELETE"
                            value={confirmationText}
                            onChange={(e) => setConfirmationText(e.target.value)}
                            disabled={isDeleting}
                            autoFocus
                        />
                    </div>

                    {error && (
                        <div className="message error show">
                            <span className="message-text">{error}</span>
                            <button
                                type="button"
                                className="message-close"
                                onClick={() => {
                                    setError(null);
                                    errorRef.current = null;
                                }}
                                aria-label="Close"
                            >
                                ×
                            </button>
                        </div>
                    )}

                    <div className="modal-actions">
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={onClose}
                            disabled={isDeleting}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn-danger"
                            disabled={!isConfirmEnabled || isDeleting}
                        >
                            {isDeleting ? 'Deleting...' : 'Delete Tracking'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

