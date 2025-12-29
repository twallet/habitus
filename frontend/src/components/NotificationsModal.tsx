import { useState, FormEvent, useEffect } from 'react';
import './NotificationsModal.css';
import { UserData } from '../models/User';

interface NotificationsModalProps {
    onClose: () => void;
    onSave: (selectedChannels: string[], telegramChatId?: string) => Promise<void>;
    user?: UserData | null;
}

/**
 * Telegram icon SVG component.
 * Official Telegram brand icon.
 * @internal
 */
function TelegramIcon({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161l-1.87 8.8c-.138.654-.49.815-.993.508l-2.74-2.02-1.322 1.27c-.146.146-.27.27-.553.27l.197-2.79 5.062-4.58c.22-.196-.048-.305-.341-.11l-6.25 3.94-2.69-.843c-.587-.186-.6-.587.12-.88l10.47-4.04c.487-.18.914.112.755.85z" />
        </svg>
    );
}

/**
 * WhatsApp icon SVG component.
 * Official WhatsApp brand icon.
 * @internal
 */
function WhatsAppIcon({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.98 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
        </svg>
    );
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
    const [calendarProvider, setCalendarProvider] = useState<string>('');
    const [whatsappNumber, setWhatsappNumber] = useState<string>('');
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
        {
            id: 'Email',
            label: 'Email',
            enabled: true,
            icon: '📧',
            color: '#005A7F'
        },
        {
            id: 'Calendar',
            label: 'Calendar',
            enabled: true,
            icon: '📅',
            color: '#EA4335'
        },
        {
            id: 'Telegram',
            label: 'Telegram',
            enabled: true,
            icon: <TelegramIcon className="channel-icon-svg" />,
            color: '#0088cc'
        },
        {
            id: 'WhatsApp',
            label: 'WhatsApp',
            enabled: true,
            icon: <WhatsAppIcon className="channel-icon-svg" />,
            color: '#25D366'
        },
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
                                    className={`channel-option channel-option-${channel.id.toLowerCase()} ${!channel.enabled ? 'disabled' : ''}`}
                                    style={selectedChannels.includes(channel.id) ? { '--channel-color': channel.color } as React.CSSProperties : undefined}
                                >
                                    <span className="channel-icon">
                                        {typeof channel.icon === 'string' ? channel.icon : channel.icon}
                                    </span>
                                    <span className="channel-label">{channel.label}</span>
                                    <input
                                        type="checkbox"
                                        checked={selectedChannels.includes(channel.id)}
                                        onChange={() => handleChannelToggle(channel.id)}
                                        disabled={!channel.enabled || isSubmitting}
                                    />
                                </label>
                            ))}
                        </div>
                    </div>

                    {selectedChannels.includes('Telegram') && (
                        <div className="form-group">
                            <label htmlFor="telegram-chat-id" className="notifications-label">
                                Telegram chat ID
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

                    {selectedChannels.includes('Calendar') && (
                        <div className="form-group">
                            <label htmlFor="calendar-provider" className="notifications-label">
                                Calendar provider
                            </label>
                            <select
                                id="calendar-provider"
                                value={calendarProvider}
                                onChange={(e) => setCalendarProvider(e.target.value)}
                                disabled={isSubmitting}
                                className="form-input"
                            >
                                <option value="">Select a calendar provider</option>
                                <option value="google">Google Calendar</option>
                                <option value="outlook">Microsoft Outlook</option>
                                <option value="apple">Apple Calendar</option>
                            </select>
                            <p className="form-help-text">
                                Connect your calendar to sync reminders. This feature is coming soon.
                            </p>
                        </div>
                    )}

                    {selectedChannels.includes('WhatsApp') && (
                        <div className="form-group">
                            <label htmlFor="whatsapp-number" className="notifications-label">
                                WhatsApp number
                            </label>
                            <input
                                id="whatsapp-number"
                                type="text"
                                value={whatsappNumber}
                                onChange={(e) => setWhatsappNumber(e.target.value)}
                                placeholder="Enter your WhatsApp number (e.g., +1234567890)"
                                disabled={isSubmitting}
                                className="form-input"
                            />
                            <p className="form-help-text">
                                Enter your WhatsApp number to receive reminders. This feature is coming soon.
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

