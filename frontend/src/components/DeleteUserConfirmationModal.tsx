import { useState, FormEvent, useEffect } from 'react';
import './DeleteUserConfirmationModal.css';

interface DeleteUserConfirmationModalProps {
    userName: string;
    onClose: () => void;
    onConfirm: () => Promise<void>;
}

/**
 * Modal component for confirming user deletion.
 * Requires typing "DELETE" to confirm deletion.
 * @param props - Component props
 * @param props.userName - The name of the user to delete
 * @param props.onClose - Callback when modal is closed
 * @param props.onConfirm - Callback when deletion is confirmed
 * @public
 */
export function DeleteUserConfirmationModal({
    userName,
    onClose,
    onConfirm,
}: DeleteUserConfirmationModalProps) {
    const [confirmationText, setConfirmationText] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
        setError(null);

        try {
            await onConfirm();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error deleting user');
        } finally {
            setIsDeleting(false);
        }
    };

    /**
     * Handle escape key to close modal.
     * @internal
     */
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('keydown', handleEscape);
        };
    }, [onClose]);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content delete-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Delete Account</h2>
                    <button
                        type="button"
                        className="modal-close"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="delete-confirmation-form">
                    <div className="delete-warning">
                        <p>
                            Are you sure you want to delete <strong>{userName}'s</strong> account?
                        </p>
                        <p>
                            All your data will be permanently deleted.
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
                                onClick={() => setError(null)}
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
                            {isDeleting ? 'Deleting...' : 'Delete Account'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

