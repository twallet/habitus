import { useState, FormEvent } from 'react';
import './NotificationsModal.css';

interface NotificationsModalProps {
    onClose: () => void;
    onSave: (selectedChannels: string[]) => Promise<void>;
}

/**
 * Modal component for managing notification settings.
 * Allows users to select notification channels for reminders.
 * @param props - Component props
 * @param props.onClose - Callback when modal is closed
 * @param props.onSave - Callback when settings are saved
 * @public
 */
export function NotificationsModal({
    onClose,
    onSave,
}: NotificationsModalProps) {
    const [selectedChannels, setSelectedChannels] = useState<string[]>(['Email']);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * Handle channel toggle.
     * @param channel - The channel to toggle
     * @internal
     */
    const handleChannelToggle = (channel: string) => {
        if (channel === 'Email') {
            // Email is always enabled, so we just ensure it's selected
            if (!selectedChannels.includes(channel)) {
                setSelectedChannels([...selectedChannels, channel]);
            }
        } else {
            // Other channels are disabled for now
            return;
        }
    };

    /**
     * Handle form submission.
     * @param e - Form submission event
     * @internal
     */
    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        // Prevent double submission
        if (isSubmitting) {
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await onSave(selectedChannels);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error saving notification settings');
        } finally {
            setIsSubmitting(false);
        }
    };

    const channels = [
        { id: 'Email', label: 'Email', enabled: true },
        { id: 'Whatsapp', label: 'Whatsapp', enabled: false },
        { id: 'Telegram', label: 'Telegram', enabled: false },
        { id: 'MS Teams', label: 'MS Teams', enabled: false },
    ];

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Notifications</h2>
                    <button
                        type="button"
                        className="modal-close"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="notifications-form">
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
                        <label className="notifications-label">Send reminders</label>
                        <div className="notification-channels">
                            {channels.map((channel) => (
                                <label
                                    key={channel.id}
                                    className={`channel-option ${!channel.enabled ? 'disabled' : ''}`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedChannels.includes(channel.id)}
                                        onChange={() => handleChannelToggle(channel.id)}
                                        disabled={!channel.enabled || isSubmitting}
                                    />
                                    <span>{channel.label}</span>
                                </label>
                            ))}
                        </div>
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
                            {isSubmitting ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

