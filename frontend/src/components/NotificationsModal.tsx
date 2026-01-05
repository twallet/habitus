import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import './NotificationsModal.css';
import { UserData } from '../models/User';
import { TelegramConnectionStepsModal } from './TelegramConnectionStepsModal';

interface NotificationsModalProps {
    onClose: () => void;
    onSave: (notificationChannel: string, telegramChatId?: string) => Promise<void>;
    onGetTelegramStartLink: () => Promise<{ link: string; token: string }>;
    onGetTelegramStatus: () => Promise<{ connected: boolean; telegramChatId: string | null; telegramUsername: string | null; hasActiveToken: boolean }>;
    onCancelTelegramConnection?: () => Promise<{ success: boolean; message?: string }>;
    onDisconnectTelegram?: () => Promise<UserData | void>;
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
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            style={{ display: 'block', flexShrink: 0 }}
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
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            style={{ display: 'block', flexShrink: 0 }}
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
    onDisconnectTelegram,
    user,
}: NotificationsModalProps) {
    const [selectedChannel, setSelectedChannel] = useState<string>(user?.notification_channels || 'Email');
    const selectedChannelRef = useRef<string>(user?.notification_channels || 'Email');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [telegramConnected, setTelegramConnected] = useState(!!user?.telegram_chat_id);
    const [telegramChatId, setTelegramChatId] = useState<string | null>(user?.telegram_chat_id || null);
    const [telegramUsername, setTelegramUsername] = useState<string | null>(null);
    const [showTelegramConnectionModal, setShowTelegramConnectionModal] = useState(false);
    const [telegramConnecting, setTelegramConnecting] = useState(false);
    const isCancelingRef = useRef(false);
    const telegramConnectingRef = useRef(false);
    const telegramConnectedRef = useRef(false);
    const justSavedRef = useRef(false);
    const hasShownSuccessRef = useRef(false);

    /**
     * Update telegramConnecting state and ref.
     * @param value - New connecting state
     * @internal
     */
    const updateTelegramConnecting = useCallback((value: boolean) => {
        setTelegramConnecting(value);
        telegramConnectingRef.current = value;
    }, []);

    /**
     * Update telegramConnected state and ref.
     * @param value - New connected state
     * @internal
     */
    const updateTelegramConnected = useCallback((value: boolean) => {
        setTelegramConnected(value);
        telegramConnectedRef.current = value;
    }, []);

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
            // Update state immediately to prevent blinking
            setSelectedChannel(channelId);
            selectedChannelRef.current = channelId;
            // Mark that we just saved to prevent useEffect from overriding
            justSavedRef.current = true;
            // Then save to backend
            await onSave(channelId, chatIdToUse || undefined);
            // Reset flag after a short delay
            setTimeout(() => {
                justSavedRef.current = false;
            }, 500);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error saving notification preferences');
            justSavedRef.current = false;
            // Revert on error (this will be overwritten by useEffect when user prop updates)
        } finally {
            setIsSubmitting(false);
        }
    };

    /**
     * Check Telegram connection status including active token state.
     * @internal
     */
    const checkTelegramStatus = useCallback(async () => {
        try {
            console.log('[NotificationsModal] Checking Telegram status...');
            const status = await onGetTelegramStatus();
            const wasConnected = telegramConnected;
            console.log('[NotificationsModal] Telegram status received:', {
                status,
                wasConnected,
                currentConnected: telegramConnected,
                currentConnecting: telegramConnecting
            });

            if (status.connected && status.telegramChatId) {
                console.log('[NotificationsModal] Telegram is connected, updating state');
                setTelegramChatId(status.telegramChatId);
                updateTelegramConnected(true);
                updateTelegramConnecting(false);
                if (status.telegramUsername) {
                    setTelegramUsername(status.telegramUsername);
                }
                // Automatically select Telegram and save when newly connected (not already connected)
                if (selectedChannelRef.current === 'Telegram' && !wasConnected) {
                    console.log('[NotificationsModal] New connection detected, auto-saving');
                    // User was trying to connect, now save
                    await savePreferences('Telegram', status.telegramChatId);
                    // Show success message only once for new connections
                    if (!hasShownSuccessRef.current) {
                        const successMsg = `Telegram connected successfully as ${status.telegramUsername || 'user'}!`;
                        setSuccessMessage(successMsg);
                        hasShownSuccessRef.current = true;
                        setTimeout(() => {
                            setSuccessMessage(null);
                        }, 4000);
                    }
                }
            } else {
                console.log('[NotificationsModal] Telegram not connected, hasActiveToken:', status.hasActiveToken);
                setTelegramChatId(null);
                updateTelegramConnected(false);
                // Set connecting state based on hasActiveToken from backend (for internal logic)
                updateTelegramConnecting(status.hasActiveToken);
                // If Telegram is selected but not connected, switch back to Email
                if (selectedChannelRef.current === 'Telegram' && !status.connected) {
                    console.log('[NotificationsModal] Telegram not connected, switching to Email');
                    setSelectedChannel('Email');
                    selectedChannelRef.current = 'Email';
                    // Save Email preference
                    await savePreferences('Email');
                }
            }
        } catch (err) {
            console.error('[NotificationsModal] Error checking Telegram status:', err);
        }
    }, [onGetTelegramStatus, telegramConnected, telegramConnecting, savePreferences, updateTelegramConnected, updateTelegramConnecting]);

    /**
     * Load existing preferences from user data and check Telegram status.
     * @internal
     */
    useEffect(() => {
        if (user) {
            // Only update if not in the middle of saving to prevent blinking
            if (!justSavedRef.current) {
                const channel = user.notification_channels || 'Email';
                // Only update if different to prevent unnecessary re-renders
                if (selectedChannel !== channel) {
                    setSelectedChannel(channel);
                    selectedChannelRef.current = channel;
                }
            }

            if (user.telegram_chat_id) {
                // Only update if changed to prevent re-renders
                if (telegramChatId !== user.telegram_chat_id) {
                    setTelegramChatId(user.telegram_chat_id);
                    updateTelegramConnected(true);
                    updateTelegramConnecting(false);
                }
                // Fetch Telegram username only if we don't have it yet
                if (!telegramUsername) {
                    checkTelegramStatus().catch((err) => {
                        console.error('Error fetching Telegram username:', err);
                    });
                }
            } else if (!telegramConnecting) {
                // Check Telegram status even if not connected to get current state (including hasActiveToken)
                // But only if not already checking
                checkTelegramStatus().catch((err) => {
                    console.error('Error checking Telegram status:', err);
                });
            }
        }
    }, [user]);

    /**
     * Check status when modal opens (to detect expired tokens).
     * @internal
     */
    useEffect(() => {
        checkTelegramStatus().catch((err) => {
            console.error('Error checking initial Telegram status:', err);
        });
    }, []); // Run only once on mount

    /**
     * Auto-close connection modal when Telegram connects via SSE.
     * @internal
     */
    useEffect(() => {
        console.log('[NotificationsModal] Connection state changed:', {
            telegramConnected,
            showTelegramConnectionModal
        });
        if (telegramConnected && showTelegramConnectionModal) {
            console.log('[NotificationsModal] Auto-closing connection modal - Telegram connected');
            setShowTelegramConnectionModal(false);
        }
    }, [telegramConnected, showTelegramConnectionModal]);

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
            // If Telegram is already connected, select and save immediately
            if (telegramConnected) {
                setSelectedChannel('Telegram');
                selectedChannelRef.current = 'Telegram';
                await savePreferences('Telegram');
                return;
            }
            // If not connected, open connection modal but don't select Telegram yet
            // Telegram will only be selected after successful connection
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
            // Call the disconnect endpoint
            if (onDisconnectTelegram) {
                await onDisconnectTelegram();
            }
            // Switch to Email
            setSelectedChannel('Email');
            selectedChannelRef.current = 'Email';
            // Clear Telegram connection state
            updateTelegramConnected(false);
            setTelegramChatId(null);
            setTelegramUsername(null);
            // Reset success message flag so it can be shown again on reconnection
            hasShownSuccessRef.current = false;
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

    // Check globalThis first for test compatibility, then fall back to import.meta.env
    const isDev = (globalThis as any).import?.meta?.env?.DEV ?? import.meta.env.DEV;

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
            enabled: !isDev,
            icon: <TelegramIcon className="channel-icon-svg" />,
            color: '#0088cc',
            description: isDev ? 'Disabled in development' : 'Send reminders by Telegram',
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
    ], [emailBadge, telegramBadge, isDev]);

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

                    {successMessage && (
                        <div className="message success show">
                            <span className="message-text">{successMessage}</span>
                            <button
                                type="button"
                                className="message-close"
                                onClick={() => setSuccessMessage(null)}
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
                                                <span className="channel-label-text">{channel.label}</span>
                                                {channel.badge && (
                                                    <span className={`user-badge ${channel.id === 'Email'
                                                        ? 'badge-green'
                                                        : channel.id === 'Telegram'
                                                            ? (telegramConnected ? 'badge-green' : 'badge-red')
                                                            : ''
                                                        }`}
                                                        title={channel.id === 'Telegram' && telegramConnected
                                                            ? `Connected as ${channel.badge}. Click the x to disconnect.`
                                                            : undefined
                                                        }>
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
                                                                title="Disconnect your Telegram account and switch to Email notifications"
                                                                style={{ backgroundColor: '#000000', color: '#ffffff' }}
                                                            >
                                                                x
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
                                                    disabled={isSubmitting || (channel.id === 'Telegram' && !telegramConnected)}
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
                    onClose={async () => {
                        console.log('[NotificationsModal] onClose called from TelegramConnectionStepsModal');
                        // Always close the modal first to ensure UI updates
                        setShowTelegramConnectionModal(false);
                        
                        // Check connection status to see if connection was successful
                        try {
                            const status = await onGetTelegramStatus();
                            console.log('[NotificationsModal] Status check result:', {
                                connected: status.connected,
                                telegramChatId: status.telegramChatId,
                                telegramUsername: status.telegramUsername
                            });
                            
                            if (status.connected && status.telegramChatId) {
                                // Connection was successful - update parent state and keep Telegram selected
                                console.log('[NotificationsModal] Connection successful, updating state');
                                setTelegramChatId(status.telegramChatId);
                                updateTelegramConnected(true);
                                updateTelegramConnecting(false);
                                if (status.telegramUsername) {
                                    setTelegramUsername(status.telegramUsername);
                                }
                                // Keep Telegram selected since connection was successful
                                setSelectedChannel('Telegram');
                                selectedChannelRef.current = 'Telegram';
                                // Auto-save preferences with Telegram
                                try {
                                    await savePreferences('Telegram', status.telegramChatId);
                                } catch (saveErr) {
                                    console.error('[NotificationsModal] Error saving preferences:', saveErr);
                                    // Continue even if save fails
                                }
                                // Show success message
                                if (!hasShownSuccessRef.current) {
                                    const successMsg = `Telegram connected successfully as ${status.telegramUsername || 'user'}!`;
                                    setSuccessMessage(successMsg);
                                    hasShownSuccessRef.current = true;
                                    setTimeout(() => {
                                        setSuccessMessage(null);
                                    }, 4000);
                                }
                            } else {
                                // Connection was not successful - switch back to Email
                                console.log('[NotificationsModal] Connection not successful, switching to Email');
                                setSelectedChannel('Email');
                                selectedChannelRef.current = 'Email';
                                updateTelegramConnecting(false);
                            }
                        } catch (err) {
                            console.error('[NotificationsModal] Error checking status on close:', err);
                            // On error, switch back to Email as fallback
                            setSelectedChannel('Email');
                            selectedChannelRef.current = 'Email';
                            updateTelegramConnecting(false);
                        }
                    }}
                    onCancel={async () => {
                        setShowTelegramConnectionModal(false);
                        setSelectedChannel('Email');
                        selectedChannelRef.current = 'Email';
                        if (onCancelTelegramConnection) {
                            await onCancelTelegramConnection();
                        }
                        // Reset connecting state after cancel
                        updateTelegramConnecting(false);
                        // Re-check status to sync with backend
                        await checkTelegramStatus();
                    }}
                    onGetTelegramStartLink={async () => {
                        // Generate the link
                        const result = await onGetTelegramStartLink();
                        // Immediately check status to detect the new active token
                        // Don't let status check errors prevent link generation
                        try {
                            await checkTelegramStatus();
                        } catch (err) {
                            console.error('[NotificationsModal] Error checking status after link generation:', err);
                            // Continue even if status check fails
                        }
                        return result;
                    }}
                    onCopyClicked={() => {
                        // No additional action needed
                    }}
                    onGetTelegramStatus={onGetTelegramStatus}
                />
            )}
        </div>
    );
}
