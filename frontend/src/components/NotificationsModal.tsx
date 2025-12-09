import { useState, FormEvent, useEffect } from 'react';
import './NotificationsModal.css';
import { UserData } from '../models/User';

interface NotificationsModalProps {
    onClose: () => void;
    onSave: (selectedChannels: string[], telegramChatId?: string) => Promise<void>;
    user?: UserData | null;
}

/**
 * Modal component for managing notification settings.
 * Allows users to select notification channels for reminders.
 * @param props - Component props
 * @param props.onClose - Callback when modal is closed
 * @param props.onSave - Callback when settings are saved
 * @param props.user - Current user data (optional, for loading existing preferences)
 * @public
 */
export function NotificationsModal({
    onClose,
    onSave,
    user,
}: NotificationsModalProps) {
    const [selectedChannels, setSelectedChannels] = useState<string[]>(['Email']);
    const [telegramChatId, setTelegramChatId] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * Load existing preferences from user data.
     * @internal
     */
    useEffect(() => {
        if (user) {
            setSelectedChannels(user.notification_channels || ['Email']);
            setTelegramChatId(user.telegram_chat_id || '');
        }
    }, [user]);

    /**
     * Handle channel toggle.
     * @param channel - The channel to toggle
     * @internal
     */
    const handleChannelToggle = (channel: string) => {
        if (selectedChannels.includes(channel)) {
            // Remove channel if already selected
            setSelectedChannels(selectedChannels.filter((ch) => ch !== channel));
        } else {
            // Add channel if not selected
            setSelectedChannels([...selectedChannels, channel]);
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

        // Validate that Telegram chat ID is provided if Telegram is selected
        if (selectedChannels.includes('Telegram') && !telegramChatId.trim()) {
            setError('Telegram chat ID is required when Telegram notifications are enabled');
            setIsSubmitting(false);
            return;
        }

        try {
            await onSave(
                selectedChannels,
                selectedChannels.includes('Telegram') ? telegramChatId.trim() : undefined
            );
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error saving notification settings');
        } finally {
            setIsSubmitting(false);
        }
    };

    const channels = [
        { id: 'Email', label: 'Email', enabled: true },
        { id: 'Telegram', label: 'Telegram', enabled: true },
    ];

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Configure notifications</h2>
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

                    {selectedChannels.includes('Telegram') && (
                        <div className="form-group">
                            <label htmlFor="telegram-chat-id" className="notifications-label">
                                Telegram Chat ID
                            </label>
                            <input
                                id="telegram-chat-id"
                                type="text"
                                value={telegramChatId}
                                onChange={(e) => setTelegramChatId(e.target.value)}
                                placeholder="Enter your Telegram chat ID"
                                disabled={isSubmitting}
                                className="form-input"
                            />
                            <p className="form-help-text">
                                To get your chat ID, start a conversation with your bot and send /start, then check the bot's logs or use @userinfobot
                            </p>
                        </div>
                    )}

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

