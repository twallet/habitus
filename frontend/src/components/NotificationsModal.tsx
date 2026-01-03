import { useState, useEffect, useMemo, useRef } from 'react';
import './NotificationsModal.css';
import { UserData } from '../models/User';
import { TelegramConnectionStepsModal } from './TelegramConnectionStepsModal';

interface NotificationsModalProps {
    onClose: () => void;
    onSave: (notificationChannel: string, telegramChatId?: string) => Promise<void>;
    onGetTelegramStartLink: () => Promise<{ link: string; token: string }>;
    onGetTelegramStatus: () => Promise<{ connected: boolean; telegramChatId: string | null; telegramUsername: string | null; hasActiveToken: boolean }>;
    onCancelTelegramConnection?: () => Promise<{ success: boolean; message?: string }>;
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
    onCancelTelegramConnection,
    user,
}: NotificationsModalProps) {
    const [selectedChannel, setSelectedChannel] = useState<string>('Email');
    const selectedChannelRef = useRef<string>('Email');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [telegramConnected, setTelegramConnected] = useState(false);
    const [telegramChatId, setTelegramChatId] = useState<string | null>(null);
    const [telegramUsername, setTelegramUsername] = useState<string | null>(null);
    const [showTelegramConnectionModal, setShowTelegramConnectionModal] = useState(false);
    const [telegramConnecting, setTelegramConnecting] = useState(false);
    const isCancelingRef = useRef(false);
    const checkStatusIntervalRef = useRef<NodeJS.Timeout | null>(null);

    /**
     * Save notification preferences.
     * @param channelId - The selected channel ID
     * @param providedTelegramChatId - Optional Telegram chat ID (used when saving immediately after connection)
     * @internal
     */
    const savePreferences = async (channelId: string, providedTelegramChatId?: string | null) => {
        // Prevent double submission
        if (isSubmitting) {
            return;
        }

        setIsSubmitting(true);
        setError(null);

        // Use provided chat ID if available, otherwise use state
        const chatIdToUse = providedTelegramChatId !== undefined ? providedTelegramChatId : telegramChatId;

        // Validate that Telegram is connected if Telegram is selected
        if (channelId === 'Telegram' && !chatIdToUse) {
            setError('Please connect your Telegram account before saving');
            setIsSubmitting(false);
            return;
        }

        try {
            await onSave(channelId, chatIdToUse || undefined);
            setSelectedChannel(channelId);
            selectedChannelRef.current = channelId;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error saving notification preferences');
        } finally {
            setIsSubmitting(false);
        }
    };

    /**
     * Check Telegram connection status including active token state.
     * @internal
     */
    const checkTelegramStatus = async () => {
        try {
            const status = await onGetTelegramStatus();
            if (status.connected && status.telegramChatId) {
                setTelegramChatId(status.telegramChatId);
                setTelegramConnected(true);
                setTelegramConnecting(false);
                if (status.telegramUsername) {
                    setTelegramUsername(status.telegramUsername);
                }
                // Automatically save when connected (use ref to get current value)
                if (selectedChannelRef.current === 'Telegram') {
                    await savePreferences('Telegram', status.telegramChatId);
                }
            } else {
                setTelegramChatId(null);
                setTelegramConnected(false);
                // Set connecting state based on hasActiveToken from backend
                setTelegramConnecting(status.hasActiveToken);
            }
        } catch (err) {
            console.error('Error checking Telegram status:', err);
        }
    };

    /**
     * Load existing preferences from user data and check Telegram status.
     * @internal
     */
    useEffect(() => {
        if (user) {
            const channel = user.notification_channels || 'Email';
            setSelectedChannel(channel);
            selectedChannelRef.current = channel;

            if (user.telegram_chat_id) {
                setTelegramChatId(user.telegram_chat_id);
                setTelegramConnected(true);
                setTelegramConnecting(false);
                // Fetch Telegram username
                checkTelegramStatus().catch((err) => {
                    console.error('Error fetching Telegram username:', err);
                });
            } else {
                // Check Telegram status even if not connected to get current state (including hasActiveToken)
                checkTelegramStatus().catch((err) => {
                    console.error('Error checking Telegram status:', err);
                });
            }
        }
    }, [user]);

    /**
     * Poll for connection status when connecting (to detect when token expires or connection succeeds).
     * @internal
     */
    useEffect(() => {
        if (telegramConnecting && !telegramConnected) {
            // Poll every 30 seconds to check if token expired or connection succeeded
            checkStatusIntervalRef.current = setInterval(() => {
                checkTelegramStatus();
            }, 30000); // Check every 30 seconds

            return () => {
                if (checkStatusIntervalRef.current) {
                    clearInterval(checkStatusIntervalRef.current);
                    checkStatusIntervalRef.current = null;
                }
            };
        } else {
            // Clear interval when not connecting
            if (checkStatusIntervalRef.current) {
                clearInterval(checkStatusIntervalRef.current);
                checkStatusIntervalRef.current = null;
            }
        }
    }, [telegramConnecting, telegramConnected]);

    /**
     * Handle channel selection change.
     * @param channelId - The selected channel ID
     * @internal
     */
    const handleChannelChange = async (channelId: string) => {
        // Don't open modal if we're in the process of canceling
        if (isCancelingRef.current) {
            return;
        }
        if (channelId === 'Telegram') {
            setSelectedChannel('Telegram');
            selectedChannelRef.current = 'Telegram';
            // If Telegram is already connected, save immediately
            if (telegramConnected) {
                await savePreferences('Telegram');
                return;
            }
            // Otherwise, open the connection steps modal
            setShowTelegramConnectionModal(true);
        } else {
            setSelectedChannel(channelId);
            selectedChannelRef.current = channelId;
            // Save immediately for non-Telegram channels
            await savePreferences(channelId);
        }
    };

    /**
     * Handle disconnecting Telegram account.
     * @internal
     */
    const handleDisconnectTelegram = async () => {
        try {
            // Switch to Email and save (this will clear telegram_chat_id)
            setSelectedChannel('Email');
            selectedChannelRef.current = 'Email';
            await savePreferences('Email');
            // Clear Telegram connection state
            setTelegramConnected(false);
            setTelegramChatId(null);
            setTelegramUsername(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error disconnecting Telegram account');
        }
    };

    /**
     * Handle modal close.
     * @internal
     */
    const handleModalClose = () => {
        onClose();
    };


    // Get display values for badges
    const emailBadge = useMemo(() => {
        // Always show email badge if user email exists
        if (user?.email) {
            return user.email;
        }
        return null;
    }, [user?.email]);

    const telegramBadge = useMemo(() => {
        // Show "Connecting..." if copy button was clicked but not yet connected
        if (telegramConnecting && !telegramConnected) {
            return 'Connecting...';
        }
        // Show "No account connected" if Telegram is not connected
        if (!telegramConnected) {
            return 'No account connected';
        }
        // Show Telegram username if connected
        if (telegramUsername) {
            // If it's already prefixed with @, use as is
            // If it looks like a username (no spaces, alphanumeric/underscores), add @
            // Otherwise (likely first_name), use as is
            let displayUsername = telegramUsername;
            if (!telegramUsername.startsWith('@') && !telegramUsername.includes(' ')) {
                // Likely a username, add @ prefix
                displayUsername = `@${telegramUsername}`;
            }
            return displayUsername;
        }
        // If connected but no username available, show generic message
        return 'Connected';
    }, [telegramConnected, telegramUsername, telegramConnecting]);

    const channels = useMemo(() => [
        {
            id: 'Email',
            label: 'Email',
            enabled: true,
            icon: '📧',
            color: '#005A7F',
            description: 'Send reminders by email',
            badge: emailBadge
        },
        {
            id: 'Telegram',
            label: 'Telegram',
            enabled: true,
            icon: <TelegramIcon className="channel-icon-svg" />,
            color: '#0088cc',
            description: 'Send reminders by Telegram',
            badge: telegramBadge
        },
        {
            id: 'WhatsApp',
            label: 'WhatsApp',
            enabled: false,
            icon: <WhatsAppIcon className="channel-icon-svg" />,
            color: '#25D366',
            description: 'Coming soon',
            badge: null
        },
    ], [emailBadge, telegramBadge]);

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

                <div className="notifications-form">
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
                        <label className="notifications-label">Select one notification channel for reminders</label>
                        <div className="notification-channels">
                            {channels.map((channel) => (
                                <div key={channel.id}>
                                    <label
                                        className={`channel-option channel-option-${channel.id.toLowerCase()} ${!channel.enabled ? 'disabled' : ''}`}
                                        style={selectedChannel === channel.id ? { '--channel-color': channel.color } as React.CSSProperties : undefined}
                                        title={channel.description}
                                    >
                                        {channel.enabled ? null : (
                                            <span className="coming-soon-badge">Coming soon</span>
                                        )}
                                        <div className="channel-header">
                                            <span className="channel-icon">
                                                {typeof channel.icon === 'string' ? channel.icon : channel.icon}
                                            </span>
                                            <span className="channel-label">
                                                {channel.label}
                                                {channel.badge && (
                                                    <span className={`user-badge ${channel.id === 'Email'
                                                        ? 'badge-green'
                                                        : channel.id === 'Telegram'
                                                            ? (telegramConnected ? 'badge-green' : telegramConnecting ? 'badge-yellow' : 'badge-red')
                                                            : ''
                                                        }`}
                                                        style={channel.id === 'Telegram' && telegramConnecting && !telegramConnected
                                                            ? { backgroundColor: '#fff9c4', color: '#856404' }
                                                            : undefined
                                                        }>
                                                        {channel.badge}
                                                        {channel.id === 'Telegram' && telegramConnecting && !telegramConnected && (
                                                            <button
                                                                type="button"
                                                                className="badge-disconnect-btn"
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    e.preventDefault();
                                                                    // Set canceling flag to prevent modal from opening
                                                                    isCancelingRef.current = true;
                                                                    // Cancel the connection on the backend
                                                                    if (onCancelTelegramConnection) {
                                                                        try {
                                                                            await onCancelTelegramConnection();
                                                                        } catch (err) {
                                                                            console.error('Error cancelling Telegram connection:', err);
                                                                        }
                                                                    }
                                                                    setTelegramConnecting(false);
                                                                    // Close the connection modal if it's open
                                                                    setShowTelegramConnectionModal(false);
                                                                    // Select Email channel
                                                                    setSelectedChannel('Email');
                                                                    selectedChannelRef.current = 'Email';
                                                                    // Re-check status to sync with backend (should now show hasActiveToken as false)
                                                                    await checkTelegramStatus();
                                                                    // Reset canceling flag after a short delay
                                                                    setTimeout(() => {
                                                                        isCancelingRef.current = false;
                                                                    }, 100);
                                                                }}
                                                                aria-label="Cancel Telegram connection"
                                                                title="Cancel Telegram connection"
                                                                style={{ backgroundColor: '#000000', color: '#ffffff' }}
                                                            >
                                                                X
                                                            </button>
                                                        )}
                                                        {channel.id === 'Telegram' && telegramConnected && !telegramConnecting && (
                                                            <button
                                                                type="button"
                                                                className="badge-disconnect-btn"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDisconnectTelegram();
                                                                }}
                                                                aria-label="Disconnect Telegram account"
                                                                title="Disconnect Telegram account"
                                                                style={{ backgroundColor: '#000000', color: '#ffffff' }}
                                                            >
                                                                ×
                                                            </button>
                                                        )}
                                                    </span>
                                                )}
                                            </span>
                                            {channel.enabled ? (
                                                <input
                                                    type="radio"
                                                    name="notification-channel"
                                                    value={channel.id}
                                                    checked={selectedChannel === channel.id}
                                                    onChange={() => handleChannelChange(channel.id)}
                                                    disabled={isSubmitting || (channel.id === 'Telegram' && telegramConnecting && !telegramConnected)}
                                                />
                                            ) : null}
                                        </div>
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            {showTelegramConnectionModal && (
                <TelegramConnectionStepsModal
                    onClose={() => {
                        setShowTelegramConnectionModal(false);
                        // Always switch back to Email when closing the modal
                        setSelectedChannel('Email');
                        selectedChannelRef.current = 'Email';
                    }}
                    onGetTelegramStartLink={onGetTelegramStartLink}
                    onCopyClicked={() => {
                        // Check status to get hasActiveToken from backend
                        checkTelegramStatus();
                    }}
                />
            )}
        </div>
    );
}
