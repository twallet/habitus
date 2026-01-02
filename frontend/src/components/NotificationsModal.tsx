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
    const [telegramConnecting, setTelegramConnecting] = useState(false);
    const [telegramLink, setTelegramLink] = useState<string | null>(null);
    const [isGeneratingLink, setIsGeneratingLink] = useState(false);
    const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

    /**
     * Load existing preferences from user data.
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
                // Stop polling if Telegram is already connected
                if (pollingInterval) {
                    clearInterval(pollingInterval);
                    setPollingInterval(null);
                }
                setTelegramConnecting(false);
                // Fetch Telegram username
                checkTelegramStatus().catch((err) => {
                    console.error('Error fetching Telegram username:', err);
                });
            }
        }
    }, [user, pollingInterval]);

    /**
     * Check Telegram connection status.
     * @internal
     */
    const checkTelegramStatus = async () => {
        try {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/44241464-0bc0-4530-b46d-6424cd84bcb5', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'NotificationsModal.tsx:113', message: 'checkTelegramStatus called', data: {}, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'E' }) }).catch(() => { });
            // #endregion
            const status = await onGetTelegramStatus();
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/44241464-0bc0-4530-b46d-6424cd84bcb5', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'NotificationsModal.tsx:115', message: 'Telegram status received', data: { connected: status?.connected, hasChatId: !!status?.telegramChatId, chatId: status?.telegramChatId }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'E' }) }).catch(() => { });
            // #endregion
            if (status.connected && status.telegramChatId) {
                setTelegramChatId(status.telegramChatId);
                setTelegramConnected(true);
                setTelegramUsername(status.telegramUsername || null);
                setTelegramConnecting(false);
                // Stop polling
                if (pollingInterval) {
                    clearInterval(pollingInterval);
                    setPollingInterval(null);
                }
                // Automatically save when connected (use ref to get current value)
                if (selectedChannelRef.current === 'Telegram') {
                    await savePreferences('Telegram', status.telegramChatId);
                }
            } else {
                // Keep connecting state if not yet connected
                // This ensures the panel stays visible
                if (selectedChannelRef.current === 'Telegram' && !telegramConnected) {
                    setTelegramConnecting(true);
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
     * Generate Telegram connection link.
     * @internal
     */
    const generateTelegramLink = async () => {
        setIsGeneratingLink(true);
        setError(null);
        try {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/44241464-0bc0-4530-b46d-6424cd84bcb5', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'NotificationsModal.tsx:162', message: 'generateTelegramLink called', data: {}, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'C' }) }).catch(() => { });
            // #endregion
            const result = await onGetTelegramStartLink();
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/44241464-0bc0-4530-b46d-6424cd84bcb5', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'NotificationsModal.tsx:166', message: 'Telegram link received', data: { hasLink: !!result?.link, link: result?.link?.substring(0, 100), webhookConfigured: (result as any)?.webhookConfigured }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A' }) }).catch(() => { });
            // #endregion

            // Check if webhook is configured
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/44241464-0bc0-4530-b46d-6424cd84bcb5', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'NotificationsModal.tsx:180', message: 'Checking webhook configuration', data: { hasResult: !!result, isObject: result && typeof result === 'object', hasWebhookConfigured: result && typeof result === 'object' && 'webhookConfigured' in result, webhookConfigured: (result as any)?.webhookConfigured, conditionMet: result && typeof result === 'object' && 'webhookConfigured' in result && !(result as any).webhookConfigured }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A' }) }).catch(() => { });
            // #endregion
            if (result && typeof result === 'object' && 'webhookConfigured' in result && !(result as any).webhookConfigured) {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/44241464-0bc0-4530-b46d-6424cd84bcb5', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'NotificationsModal.tsx:181', message: 'Webhook not configured - setting error', data: { webhookUrl: (result as any)?.webhookUrl }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A' }) }).catch(() => { });
                // #endregion
                const webhookUrl = (result as any).webhookUrl;
                setError(`Telegram webhook is not configured. The connection will not work until the webhook is set up. ${webhookUrl ? `Current webhook URL: ${webhookUrl}` : 'No webhook URL is set.'} Please use the /api/telegram/set-webhook endpoint to configure it. For local development, use a tunneling service like ngrok.`);
                setIsGeneratingLink(false);
                return;
            }

            setTelegramLink(result.link);
            // Set connecting state after link is ready
            setTelegramConnecting(true);
            startPolling();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error generating Telegram link');
            setTelegramConnecting(false);
        } finally {
            // Ensure isGeneratingLink is set to false after link generation
            setIsGeneratingLink(false);
        }
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
     * Stop polling when Telegram connection is no longer in progress.
     * @internal
     */
    useEffect(() => {
        if (!telegramConnecting && pollingInterval) {
            clearInterval(pollingInterval);
            setPollingInterval(null);
        }
    }, [telegramConnecting, pollingInterval]);

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
            // Stop polling after saving
            if (pollingInterval) {
                clearInterval(pollingInterval);
                setPollingInterval(null);
            }
            setTelegramConnecting(false);
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
        // Stop polling if switching away from Telegram
        if (channelId !== 'Telegram' && pollingInterval) {
            clearInterval(pollingInterval);
            setPollingInterval(null);
            setTelegramConnecting(false);
            setTelegramLink(null);
        }

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
     * Handle canceling Telegram connection.
     * @internal
     */
    const handleCancelTelegram = async () => {
        setTelegramConnecting(false);
        setTelegramLink(null);
        // Stop polling if active
        if (pollingInterval) {
            clearInterval(pollingInterval);
            setPollingInterval(null);
        }
        // Switch back to Email and save
        setSelectedChannel('Email');
        await savePreferences('Email');
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
        setTelegramConnecting(false);
        setTelegramLink(null);
        onClose();
    };


    // Get display values for badges
    const emailBadge = useMemo(() => {
        if (selectedChannel === 'Email' && user?.email) {
            return user.email;
        }
        return null;
    }, [selectedChannel, user?.email]);

    const telegramBadge = useMemo(() => {
        if (selectedChannel === 'Telegram' && telegramUsername) {
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
        return null;
    }, [selectedChannel, telegramUsername]);

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
                                                {channel.id === 'Telegram' && telegramConnecting && (
                                                    <span className="coming-soon-badge config-progress-badge" style={{ background: '#0088cc', color: 'white' }}>
                                                        Connecting...
                                                    </span>
                                                )}
                                                {channel.id === 'Telegram' && telegramConnected && !telegramConnecting && (
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
                                                    <span className="user-badge">{channel.badge}</span>
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
                                    {channel.id === 'Telegram' && selectedChannel === 'Telegram' && !telegramConnected && (
                                        <div className="telegram-connection-panel-inline" key={`telegram-panel-${isGeneratingLink}-${telegramLink}`}>
                                            {isGeneratingLink ? (
                                                <div className="connection-step">
                                                    <div className="step-indicator loading">
                                                        <span className="spinner"></span>
                                                    </div>
                                                    <div className="step-content">
                                                        <h4>Preparing connection...</h4>
                                                        <p className="form-help-text">Generating your unique Telegram connection link</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="connection-step">
                                                        <div className={`step-indicator ${telegramLink ? 'active' : ''}`}>1</div>
                                                        <div className="step-content">
                                                            <h4>Open Telegram</h4>
                                                            <p className="form-help-text">Click the button below to open Telegram and start the bot</p>
                                                            {telegramLink ? (
                                                                <a
                                                                    href={telegramLink}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="btn-primary telegram-link-button"
                                                                    style={{
                                                                        display: 'inline-block',
                                                                        textAlign: 'center',
                                                                        textDecoration: 'none',
                                                                        marginTop: '8px'
                                                                    }}
                                                                >
                                                                    Open Telegram
                                                                </a>
                                                            ) : (
                                                                <p className="form-help-text" style={{ marginTop: '8px', fontStyle: 'italic' }}>
                                                                    Generating link...
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="connection-step">
                                                        <div className={`step-indicator ${telegramConnecting ? 'active' : ''}`}>2</div>
                                                        <div className="step-content">
                                                            <h4>Start the bot</h4>
                                                            <p className="form-help-text">
                                                                In Telegram, tap the "Start" button to connect your account
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="connection-step">
                                                        <div className={`step-indicator ${telegramConnecting ? 'checking' : ''}`}>3</div>
                                                        <div className="step-content">
                                                            <h4>Waiting for connection...</h4>
                                                            {telegramConnecting && (
                                                                <p className="form-help-text">
                                                                    <span className="spinner-inline"></span>
                                                                    Checking connection status...
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="connection-actions">
                                                        <button
                                                            type="button"
                                                            className="btn-secondary"
                                                            onClick={handleCancelTelegram}
                                                            disabled={isSubmitting}
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}
                                    {channel.id === 'Telegram' && selectedChannel === 'Telegram' && telegramConnected && (
                                        <div className="telegram-success-message-inline">
                                            <div className="message success show">
                                                <span className="message-text">
                                                    ✓ Telegram account connected{telegramUsername ? ` (@${telegramUsername.replace('@', '')})` : ''}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
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
                </div>
            </div>
        </div>
    );
}
