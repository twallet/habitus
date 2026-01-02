import { useState, useEffect } from 'react';
import './NotificationsModal.css';

interface TelegramConnectionModalProps {
    onClose: () => void;
    onCancel: () => void;
    onLinkClicked: () => void;
    onGetTelegramStartLink: () => Promise<{ link: string; token: string }>;
    onGetTelegramStatus: () => Promise<{ connected: boolean; telegramChatId: string | null }>;
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
 * Modal component for connecting Telegram account.
 * Automatically generates a connection link and polls for connection status.
 * @param props - Component props
 * @param props.onClose - Callback when connection is successful or modal is closed
 * @param props.onCancel - Callback when user cancels (should return to Email selection)
 * @param props.onLinkClicked - Callback when user clicks the Telegram link (should close modal, select Email, and show "Configuration in progress" badge)
 * @param props.onGetTelegramStartLink - Callback to get Telegram connection link
 * @param props.onGetTelegramStatus - Callback to check Telegram connection status
 * @public
 */
export function TelegramConnectionModal({
    onClose,
    onCancel,
    onLinkClicked,
    onGetTelegramStartLink,
    onGetTelegramStatus,
}: TelegramConnectionModalProps) {
    const [telegramLink, setTelegramLink] = useState<string | null>(null);
    const [isGeneratingLink, setIsGeneratingLink] = useState(true);
    const [isCheckingStatus, setIsCheckingStatus] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

    /**
     * Generate Telegram connection link on mount.
     * @internal
     */
    useEffect(() => {
        const generateLink = async () => {
            setIsGeneratingLink(true);
            setError(null);
            try {
                const result = await onGetTelegramStartLink();
                setTelegramLink(result.link);

                // Start polling for connection status
                const interval = setInterval(() => {
                    checkTelegramStatus();
                }, 2000); // Poll every 2 seconds

                setPollingInterval(interval);

                // Check immediately
                await checkTelegramStatus();
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Error generating Telegram link');
            } finally {
                setIsGeneratingLink(false);
            }
        };

        generateLink();
    }, []);

    /**
     * Check Telegram connection status.
     * @internal
     */
    const checkTelegramStatus = async () => {
        if (isCheckingStatus) return;

        setIsCheckingStatus(true);
        try {
            const status = await onGetTelegramStatus();
            if (status.connected && status.telegramChatId) {
                // Stop polling once connected
                if (pollingInterval) {
                    clearInterval(pollingInterval);
                    setPollingInterval(null);
                }
                // Close modal and notify parent
                onClose();
            }
        } catch (err) {
            console.error('Error checking Telegram status:', err);
        } finally {
            setIsCheckingStatus(false);
        }
    };

    /**
     * Cleanup polling interval on unmount.
     * @internal
     */
    useEffect(() => {
        return () => {
            if (pollingInterval) {
                clearInterval(pollingInterval);
            }
        };
    }, [pollingInterval]);

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Connect Telegram</h2>
                    <button
                        type="button"
                        className="modal-close"
                        onClick={onCancel}
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <div style={{ width: '32px', height: '32px', color: '#0088cc' }}>
                                <TelegramIcon className="channel-icon-svg" />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Connect your Telegram account</h3>
                                <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                    Click the link below to connect your Telegram account to Habitus
                                </p>
                            </div>
                        </div>

                        {isGeneratingLink ? (
                            <div style={{ padding: '16px', textAlign: 'center' }}>
                                <p className="form-help-text">Generating connection link...</p>
                            </div>
                        ) : telegramLink ? (
                            <div className="telegram-connection-flow">
                                <a
                                    href={telegramLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn-primary"
                                    onClick={onLinkClicked}
                                    style={{
                                        display: 'block',
                                        textAlign: 'center',
                                        textDecoration: 'none',
                                        padding: '12px 24px',
                                        fontSize: '1rem'
                                    }}
                                >
                                    Open Telegram
                                </a>
                                <p className="form-help-text" style={{ marginTop: '1rem', textAlign: 'center' }}>
                                    After clicking the link and starting the bot, your account will be connected automatically.
                                    {isCheckingStatus && (
                                        <span style={{ display: 'block', marginTop: '0.5rem' }}>
                                            Checking connection status...
                                        </span>
                                    )}
                                </p>
                            </div>
                        ) : null}
                    </div>

                    <div className="modal-actions">
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={onCancel}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

