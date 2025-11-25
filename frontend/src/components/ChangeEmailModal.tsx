import { useState, FormEvent, useEffect } from 'react';
import { UserData } from '../models/User';
import './ChangeEmailModal.css';

interface ChangeEmailModalProps {
    user: UserData;
    onClose: () => void;
    onRequestEmailChange: (newEmail: string) => Promise<void>;
}

/**
 * Modal component for changing user email.
 * Shows current email and allows entering a new email address.
 * Sends a magic link to the new email for verification.
 * @param props - Component props
 * @param props.user - The current user's data
 * @param props.onClose - Callback when modal is closed
 * @param props.onRequestEmailChange - Callback when email change is requested
 * @public
 */
export function ChangeEmailModal({
    user,
    onClose,
    onRequestEmailChange,
}: ChangeEmailModalProps) {
    const [newEmail, setNewEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [emailSent, setEmailSent] = useState(false);

    /**
     * Handle form submission.
     * @param e - Form submission event
     * @internal
     */
    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            if (!newEmail.trim()) {
                setError('Email is required');
                setIsSubmitting(false);
                return;
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const trimmedEmail = newEmail.trim();
            if (!emailRegex.test(trimmedEmail)) {
                setError('Please enter a valid email address');
                setIsSubmitting(false);
                return;
            }
            const validatedEmail = trimmedEmail;

            // Check if email is the same as current
            if (validatedEmail === user.email) {
                setError('New email must be different from current email');
                setIsSubmitting(false);
                return;
            }

            await onRequestEmailChange(validatedEmail);
            setEmailSent(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error requesting email change');
        } finally {
            setIsSubmitting(false);
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
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Change Email</h2>
                    <button
                        type="button"
                        className="modal-close"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>

                {emailSent ? (
                    <div className="change-email-sent">
                        <p>
                            A verification link has been sent to <strong>{newEmail.trim()}</strong>.
                        </p>
                        <p className="change-email-help">
                            Please check your email and click the link to verify your new email address.
                            Your email will be updated after verification.
                        </p>
                        <button
                            type="button"
                            className="btn-primary"
                            onClick={onClose}
                            style={{ marginTop: '1rem', display: 'inline-block', width: 'auto' }}
                        >
                            Close
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="change-email-form">
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
                            <label htmlFor="current-email">Current Email</label>
                            <input
                                type="email"
                                id="current-email"
                                name="current-email"
                                value={user.email}
                                disabled
                                className="disabled-input"
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="new-email">New Email *</label>
                            <input
                                type="email"
                                id="new-email"
                                name="new-email"
                                placeholder="Enter your new email"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                required
                                disabled={isSubmitting}
                                autoComplete="email"
                            />
                        </div>

                        <div className="modal-actions">
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={onClose}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="btn-primary"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'Sending...' : 'Change Email'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

