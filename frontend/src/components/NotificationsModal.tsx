import { useState, FormEvent, useEffect } from 'react';
import './NotificationsModal.css';
import { UserData } from '../models/User';
import { TelegramConnectionModal } from './TelegramConnectionModal';

interface NotificationsModalProps {
    onClose: () => void;
    onSave: (notificationChannel: string, telegramChatId?: string) => Promise<void>;
    onGetTelegramStartLink: () => Promise<{ link: string; token: string }>;
    onGetTelegramStatus: () => Promise<{ connected: boolean; telegramChatId: string | null }>;
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
 * MS Teams icon SVG component.
 * @internal
 */
function MSTeamsIcon({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            <path d="M19.5 4.5h-15A1.5 1.5 0 003 6v12a1.5 1.5 0 001.5 1.5h15a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5zM12 7.5a3 3 0 110 6 3 3 0 010-6zm-6 9v-1.5a4.5 4.5 0 019 0V16.5H6z" />
        </svg>
    );
}

/**
 * Slack icon SVG component.
 * @internal
 */
function SlackIcon({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            <path d="M5.042 15.165a2.528 2.528 0 01-2.52 2.523A2.528 2.528 0 010 15.165a2.527 2.527 0 012.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 012.521-2.52 2.527 2.527 0 012.521 2.52v6.313A2.528 2.528 0 018.834 24a2.528 2.528 0 01-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 01-2.521-2.52A2.528 2.528 0 018.834 0a2.528 2.528 0 012.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 012.521 2.521 2.528 2.528 0 01-2.521 2.521H2.522A2.528 2.528 0 010 8.834a2.528 2.528 0 012.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 012.522-2.521A2.528 2.528 0 0124 8.834a2.528 2.528 0 01-2.522 2.521h-2.52V8.834zM17.688 8.834a2.528 2.528 0 01-2.523 2.521 2.527 2.527 0 01-2.52-2.521V2.522A2.527 2.527 0 0115.165 0a2.528 2.528 0 012.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 012.523 2.522A2.528 2.528 0 0115.165 24a2.527 2.527 0 01-2.52-2.522v-2.52h2.52zM15.165 17.688a2.527 2.527 0 01-2.52-2.523 2.526 2.526 0 012.52-2.52h6.313A2.527 2.527 0 0124 15.165a2.528 2.528 0 01-2.522 2.523h-6.313z" />
        </svg>
    );
}

/**
 * Modal component for managing notification settings.
 * Allows users to select a single notification channel for reminders.
 * @param props - Component props
 * @param props.onClose - Callback when modal is closed
 * @param props.onSave - Callback when settings are saved (accepts single channel)
 * @param props.onGetTelegramStartLink - Callback to get Telegram connection link
 * @param props.onGetTelegramStatus - Callback to check Telegram connection status
 * @param props.user - Current user data (optional, for loading existing preferences)
 * @public
 */
export function NotificationsModal({
    onClose,
    onSave,
    onGetTelegramStartLink,
    onGetTelegramStatus,
    user,
}: NotificationsModalProps) {
    const [selectedChannel, setSelectedChannel] = useState<string>('Email');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showTelegramModal, setShowTelegramModal] = useState(false);
    const [telegramConnected, setTelegramConnected] = useState(false);
    const [telegramChatId, setTelegramChatId] = useState<string | null>(null);
    const [telegramConfigInProgress, setTelegramConfigInProgress] = useState(false);
    const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

    /**
     * Load existing preferences from user data.
     * @internal
     */
    useEffect(() => {
        if (user) {
            setSelectedChannel(user.notification_channels || 'Email');

            if (user.telegram_chat_id) {
                setTelegramChatId(user.telegram_chat_id);
                setTelegramConnected(true);
                // Stop polling if Telegram is already connected
                if (pollingInterval) {
                    clearInterval(pollingInterval);
                    setPollingInterval(null);
                }
                setTelegramConfigInProgress(false);
            }
        }
    }, [user, pollingInterval]);

    /**
     * Check Telegram connection status.
     * @internal
     */
    const checkTelegramStatus = async () => {
        try {
            const status = await onGetTelegramStatus();
            if (status.connected && status.telegramChatId) {
                setTelegramChatId(status.telegramChatId);
                setTelegramConnected(true);
                setTelegramConfigInProgress(false);
                // Automatically select Telegram when connected
                setSelectedChannel('Telegram');
                // Stop polling
                if (pollingInterval) {
                    clearInterval(pollingInterval);
                    setPollingInterval(null);
                }
            }
        } catch (err) {
            console.error('Error checking Telegram status:', err);
        }
    };

    /**
     * Start polling for Telegram connection status.
     * @internal
     */
    const startPolling = () => {
        if (pollingInterval) {
            clearInterval(pollingInterval);
        }
        const interval = setInterval(() => {
            checkTelegramStatus();
        }, 2000); // Poll every 2 seconds
        setPollingInterval(interval);
        // Check immediately
        checkTelegramStatus();
    };

    /**
     * Cleanup polling interval on unmount or when modal closes.
     * @internal
     */
    useEffect(() => {
        return () => {
            if (pollingInterval) {
                clearInterval(pollingInterval);
                setPollingInterval(null);
            }
        };
    }, [pollingInterval]);

    /**
     * Stop polling when modal is closed.
     * @internal
     */
    useEffect(() => {
        // This effect runs when the component mounts/unmounts
        // We'll also stop polling if telegramConfigInProgress becomes false
        if (!telegramConfigInProgress && pollingInterval) {
            clearInterval(pollingInterval);
            setPollingInterval(null);
        }
    }, [telegramConfigInProgress]);

    /**
     * Handle channel selection change.
     * @param channelId - The selected channel ID
     * @internal
     */
    const handleChannelChange = (channelId: string) => {
        // Stop polling if switching away from Telegram configuration
        if (telegramConfigInProgress && channelId !== 'Telegram') {
            setTelegramConfigInProgress(false);
            if (pollingInterval) {
                clearInterval(pollingInterval);
                setPollingInterval(null);
            }
        }

        if (channelId === 'Telegram') {
            // If Telegram is already connected, just select it
            if (telegramConnected) {
                setSelectedChannel('Telegram');
                return;
            }
            // Otherwise, open Telegram connection modal
            setSelectedChannel('Telegram');
            setShowTelegramModal(true);
        } else {
            setSelectedChannel(channelId);
            setShowTelegramModal(false);
        }
    };

    /**
     * Handle successful Telegram connection.
     * @internal
     */
    const handleTelegramConnected = async () => {
        setShowTelegramModal(false);
        await checkTelegramStatus();
    };

    /**
     * Handle link clicked in Telegram modal - close modal, select Email, show badge, and start polling.
     * @internal
     */
    const handleTelegramLinkClicked = () => {
        setShowTelegramModal(false);
        setSelectedChannel('Email');
        setTelegramConfigInProgress(true);
        startPolling();
    };

    /**
     * Handle cancel from Telegram modal - return to Email.
     * @internal
     */
    const handleCancelTelegram = () => {
        setShowTelegramModal(false);
        setSelectedChannel('Email');
        setTelegramConfigInProgress(false);
        // Stop polling if active
        if (pollingInterval) {
            clearInterval(pollingInterval);
            setPollingInterval(null);
        }
    };

    /**
     * Handle modal close - stop polling before closing.
     * @internal
     */
    const handleModalClose = () => {
        // Stop polling when modal closes
        if (pollingInterval) {
            clearInterval(pollingInterval);
            setPollingInterval(null);
        }
        setTelegramConfigInProgress(false);
        onClose();
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

        // Validate that Telegram is connected if Telegram is selected
        if (selectedChannel === 'Telegram' && !telegramConnected) {
            setError('Please connect your Telegram account before saving');
            setIsSubmitting(false);
            return;
        }

        try {
            await onSave(
                selectedChannel,
                selectedChannel === 'Telegram' && telegramChatId ? telegramChatId : undefined
            );
            // Stop polling before closing
            if (pollingInterval) {
                clearInterval(pollingInterval);
                setPollingInterval(null);
            }
            setTelegramConfigInProgress(false);
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
            color: '#005A7F',
            description: `Reminders will be sent to ${user?.email || 'your email address'}`
        },
        {
            id: 'Telegram',
            label: 'Telegram',
            enabled: true,
            icon: <TelegramIcon className="channel-icon-svg" />,
            color: '#0088cc',
            description: 'Connect your Telegram account to receive reminders'
        },
        {
            id: 'WhatsApp',
            label: 'WhatsApp',
            enabled: false,
            icon: <WhatsAppIcon className="channel-icon-svg" />,
            color: '#25D366',
            description: 'Coming soon'
        },
        {
            id: 'MSTeams',
            label: 'MS Teams',
            enabled: false,
            icon: <MSTeamsIcon className="channel-icon-svg" />,
            color: '#6264A7',
            description: 'Coming soon'
        },
        {
            id: 'Slack',
            label: 'Slack',
            enabled: false,
            icon: <SlackIcon className="channel-icon-svg" />,
            color: '#4A154B',
            description: 'Coming soon'
        },
    ];

    return (
        <div className="modal-overlay" onClick={handleModalClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Configure notifications</h2>
                    <button
                        type="button"
                        className="modal-close"
                        onClick={handleModalClose}
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
                        <label className="notifications-label">Notification channel</label>
                        <p className="form-help-text" style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
                            Select one notification channel for reminders
                        </p>
                        <div className="notification-channels">
                            {channels.map((channel) => (
                                <label
                                    key={channel.id}
                                    className={`channel-option channel-option-${channel.id.toLowerCase()} ${!channel.enabled ? 'disabled' : ''}`}
                                    style={selectedChannel === channel.id ? { '--channel-color': channel.color } as React.CSSProperties : undefined}
                                >
                                    {channel.enabled ? (
                                        <>
                                            {channel.id === 'Telegram' && telegramConfigInProgress && (
                                                <span className="coming-soon-badge config-progress-badge" style={{ background: '#0088cc', color: 'white' }}>
                                                    Configuration in progress
                                                </span>
                                            )}
                                            <input
                                                type="radio"
                                                name="notification-channel"
                                                value={channel.id}
                                                checked={selectedChannel === channel.id}
                                                onChange={() => handleChannelChange(channel.id)}
                                                disabled={isSubmitting}
                                            />
                                        </>
                                    ) : (
                                        <span className="coming-soon-badge">Coming soon</span>
                                    )}
                                    <span className="channel-icon">
                                        {typeof channel.icon === 'string' ? channel.icon : channel.icon}
                                    </span>
                                    <div className="channel-info">
                                        <span className="channel-label">{channel.label}</span>
                                        <span className="channel-description">{channel.description}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {selectedChannel === 'Email' && (
                        <div className="form-group">
                            <div className="message info show">
                                <span className="message-text">
                                    Reminders will be sent to <strong>{user?.email || 'your email address'}</strong>
                                </span>
                            </div>
                        </div>
                    )}

                    {selectedChannel === 'Telegram' && telegramConnected && (
                        <div className="form-group">
                            <div className="message success show">
                                <span className="message-text">
                                    ✓ Telegram account connected
                                </span>
                            </div>
                        </div>
                    )}

                    <div className="modal-actions">
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={handleModalClose}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={isSubmitting || (selectedChannel === 'Telegram' && !telegramConnected)}
                        >
                            {isSubmitting ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Telegram Connection Modal */}
            {showTelegramModal && (
                <TelegramConnectionModal
                    onClose={handleTelegramConnected}
                    onCancel={handleCancelTelegram}
                    onLinkClicked={handleTelegramLinkClicked}
                    onGetTelegramStartLink={onGetTelegramStartLink}
                    onGetTelegramStatus={onGetTelegramStatus}
                />
            )}
        </div>
    );
}
