import { useState, useEffect, useMemo, useRef } from 'react';
import './NotificationsModal.css';
import { UserData } from '../models/User';

interface NotificationsModalProps {
    onClose: () => void;
    onSave: (notificationChannel: string, telegramChatId?: string) => Promise<void>;
    onGetTelegramStartLink: () => Promise<{ link: string; token: string }>;
    onGetTelegramStatus: () => Promise<{ connected: boolean; telegramChatId: string | null; telegramUsername: string | null }>;
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
    user,
}: NotificationsModalProps) {
    const [selectedChannel, setSelectedChannel] = useState<string>('Email');
    const selectedChannelRef = useRef<string>('Email');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [telegramConnected, setTelegramConnected] = useState(false);
    const [telegramChatId, setTelegramChatId] = useState<string | null>(null);
    const [telegramUsername, setTelegramUsername] = useState<string | null>(null);
    const [telegramLink, setTelegramLink] = useState<string | null>(null);
    const [telegramStartCommand, setTelegramStartCommand] = useState<string | null>(null);
    const [isGeneratingLink, setIsGeneratingLink] = useState(false);
    const [keyCopied, setKeyCopied] = useState(false);

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
                // Fetch Telegram username
                checkTelegramStatus().catch((err) => {
                    console.error('Error fetching Telegram username:', err);
                });
            } else {
                // Check Telegram status even if not connected to get current state
                checkTelegramStatus().catch((err) => {
                    console.error('Error checking Telegram status:', err);
                });
            }
        }
    }, [user]);

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
                setTelegramUsername(status.telegramUsername || null);
                // Automatically save when connected (use ref to get current value)
                if (selectedChannelRef.current === 'Telegram') {
                    await savePreferences('Telegram', status.telegramChatId);
                }
            }
        } catch (err) {
            console.error('Error checking Telegram status:', err);
        }
    };

    /**
     * Generate Telegram connection link and extract start command.
     * @internal
     */
    const generateTelegramLink = async () => {
        setIsGeneratingLink(true);
        setError(null);
        try {
            const result = await onGetTelegramStartLink();

            // Check if webhook is configured
            if (result && typeof result === 'object' && 'webhookConfigured' in result && !(result as any).webhookConfigured) {
                const webhookUrl = (result as any).webhookUrl;
                const webhookError = (result as any).webhookError;
                let errorMsg = `Telegram webhook is not configured. The connection will not work until the webhook is set up. ${webhookUrl ? `Current webhook URL: ${webhookUrl}` : 'No webhook URL is set.'}`;
                if (webhookError) {
                    errorMsg += ` Telegram reports error: ${webhookError}`;
                }
                errorMsg += ' Please use the /api/telegram/set-webhook endpoint to configure it.';
                setError(errorMsg);
                setIsGeneratingLink(false);
                return;
            }

            setTelegramLink(result.link);
            // Extract start command from link: format is "start <token> <userId>"
            try {
                const url = new URL(result.link);
                const startParam = url.searchParams.get('start');
                if (startParam) {
                    const decoded = decodeURIComponent(startParam);
                    // Build command as "start <token> <userId>" (remove leading /start if present)
                    const command = decoded.startsWith('/start ') ? decoded.substring(7) : `start ${decoded}`;
                    setTelegramStartCommand(command);
                }
            } catch (e) {
                // Ignore URL parsing errors
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error generating Telegram link');
        } finally {
            // Ensure isGeneratingLink is set to false after link generation
            setIsGeneratingLink(false);
        }
    };


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
            await onSave(
                channelId,
                channelId === 'Telegram' && chatIdToUse ? chatIdToUse : undefined
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error saving notification settings');
        } finally {
            setIsSubmitting(false);
        }
    };

    /**
     * Handle channel selection change.
     * @param channelId - The selected channel ID
     * @internal
     */
    const handleChannelChange = async (channelId: string) => {
        if (channelId === 'Telegram') {
            setSelectedChannel('Telegram');
            selectedChannelRef.current = 'Telegram';
            // If Telegram is already connected, save immediately
            if (telegramConnected) {
                await savePreferences('Telegram');
                return;
            }
            // Otherwise, generate connection link if not already generated
            if (!telegramLink && !isGeneratingLink) {
                await generateTelegramLink();
            }
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
        setTelegramLink(null);
        setKeyCopied(false);
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
    }, [telegramConnected, telegramUsername]);

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
                                        {channel.enabled ? (
                                            <>
                                                {channel.id === 'Telegram' && telegramConnected && (
                                                    <span className="coming-soon-badge config-progress-badge" style={{ background: '#25a85a', color: 'white' }}>
                                                        ✓ Connected
                                                    </span>
                                                )}
                                            </>
                                        ) : (
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
                                                            ? (telegramConnected ? 'badge-green' : 'badge-red')
                                                            : ''
                                                        }`}>
                                                        {channel.badge}
                                                        {channel.id === 'Telegram' && telegramConnected && (
                                                            <button
                                                                type="button"
                                                                className="badge-disconnect-btn"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDisconnectTelegram();
                                                                }}
                                                                aria-label="Disconnect Telegram account"
                                                                title="Disconnect Telegram account"
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
                                                    disabled={isSubmitting}
                                                />
                                            ) : null}
                                        </div>
                                    </label>
                                    {channel.id === 'Telegram' && selectedChannel === 'Telegram' && !telegramConnected && !isGeneratingLink && (
                                        <div className="telegram-connection-panel-inline" key={`telegram-panel-${telegramLink}`}>
                                            <h3 style={{ marginBottom: '16px', fontSize: '1.1rem', fontWeight: 'bold' }}>
                                                How to connect your Telegram account?
                                            </h3>
                                            <div className="connection-step">
                                                <div className={`step-indicator ${telegramStartCommand ? 'active' : ''}`}>1</div>
                                                <div className="step-content">
                                                    <h4>Go to 🌱 Habitus in Telegram</h4>
                                                    <p className="form-help-text">Click the button below to open 🌱 Habitus in Telegram:</p>
                                                    <a
                                                        href="https://t.me/abitus_robot"
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="btn-primary telegram-link-button"
                                                        style={{
                                                            display: 'inline-block',
                                                            textAlign: 'center',
                                                            textDecoration: 'none',
                                                            marginTop: '8px',
                                                            height: 'auto',
                                                            minHeight: '32px',
                                                            lineHeight: '32px'
                                                        }}
                                                    >
                                                        Go
                                                    </a>
                                                </div>
                                            </div>
                                            <div className="connection-step">
                                                <div className={`step-indicator ${telegramStartCommand ? 'active' : ''}`}>2</div>
                                                <div className="step-content">
                                                    <h4>Copy/Paste your key</h4>
                                                    <p className="form-help-text">
                                                        Copy the command and paste it in the 🌱 Habitus chat in Telegram:
                                                    </p>
                                                    {telegramStartCommand ? (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={async () => {
                                                                    if (telegramStartCommand) {
                                                                        try {
                                                                            await navigator.clipboard.writeText(telegramStartCommand);
                                                                            setKeyCopied(true);
                                                                        } catch (err) {
                                                                            console.error('Error copying to clipboard:', err);
                                                                        }
                                                                    }
                                                                }}
                                                                className="btn-primary"
                                                                style={{
                                                                    display: 'inline-block',
                                                                    textAlign: 'center',
                                                                    marginTop: '8px',
                                                                    width: 'auto',
                                                                    height: 'auto',
                                                                    minHeight: '32px',
                                                                    lineHeight: '32px'
                                                                }}
                                                                title="Copy key to clipboard"
                                                            >
                                                                Copy key
                                                            </button>
                                                            {keyCopied && (
                                                                <p className="form-help-text" style={{ marginTop: '12px', color: '#25a85a', fontWeight: 'bold' }}>
                                                                    You can close the window, your reminders will be sent by Telegram as soon as we finish to connect your Telegram account
                                                                </p>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <p className="form-help-text" style={{ marginTop: '8px', fontStyle: 'italic', color: '#666' }}>
                                                            Generating key...
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
