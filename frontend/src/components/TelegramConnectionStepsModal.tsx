import { useState, useEffect, useRef } from 'react';
import './NotificationsModal.css';

interface TelegramConnectionStepsModalProps {
    onClose: () => void;
    onGetTelegramStartLink: () => Promise<{ link: string; token: string }>;
    onCopyClicked?: () => void;
}

/**
 * Modal component for Telegram connection steps.
 * Shows a 2-step guide for connecting Telegram account.
 * @param props - Component props
 * @param props.onClose - Callback when modal is closed
 * @param props.onGetTelegramStartLink - Callback to get Telegram connection link
 * @public
 */
export function TelegramConnectionStepsModal({
    onClose,
    onGetTelegramStartLink,
    onCopyClicked,
}: TelegramConnectionStepsModalProps) {
    const [telegramStartCommand, setTelegramStartCommand] = useState<string | null>(null);
    const [isGeneratingLink, setIsGeneratingLink] = useState(false);
    const [keyCopied, setKeyCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const hasGeneratedRef = useRef(false);

    /**
     * Generate Telegram connection link and extract start command.
     * Only generate once when modal is mounted.
     * @internal
     */
    useEffect(() => {
        // Only generate link once when component mounts
        if (hasGeneratedRef.current) {
            return;
        }

        const generateLink = async () => {
            hasGeneratedRef.current = true;
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

                // Extract start command from link: format is "/start <token> <userId>"
                try {
                    const url = new URL(result.link);
                    const startParam = url.searchParams.get('start');
                    if (startParam) {
                        const decoded = decodeURIComponent(startParam);
                        // Build command as "/start <token> <userId>" (ensure leading /start)
                        const command = decoded.startsWith('/start ') ? decoded : `/start ${decoded}`;
                        setTelegramStartCommand(command);
                    }
                } catch (e) {
                    // Ignore URL parsing errors
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Error generating Telegram link');
            } finally {
                setIsGeneratingLink(false);
            }
        };

        generateLink();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only run once on mount

    /**
     * Handle modal close.
     * @internal
     */
    const handleModalClose = () => {
        setKeyCopied(false);
        hasGeneratedRef.current = false; // Reset so token can be regenerated if modal reopens
        setTelegramStartCommand(null); // Clear the command
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={handleModalClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Connect your Telegram account</h2>
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

                    {!isGeneratingLink && (
                        <div className="telegram-connection-panel-inline">
                            <div className="connection-step">
                                <div className={`step-indicator ${telegramStartCommand ? 'active' : ''}`}>1</div>
                                <div className="step-content">
                                    <h4>Go to 🌱 Habitus in Telegram</h4>
                                    <p className="form-help-text">Click the button below to open Habitus in Telegram:</p>
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
                                        Copy your key by clicking the button below and paste it in the Habitus chat in Telegram:
                                    </p>
                                    {telegramStartCommand ? (
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                if (telegramStartCommand) {
                                                    try {
                                                        await navigator.clipboard.writeText(telegramStartCommand);
                                                        setKeyCopied(true);
                                                        // Notify parent that copy was clicked
                                                        if (onCopyClicked) {
                                                            onCopyClicked();
                                                        }
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
                                    ) : (
                                        <p className="form-help-text" style={{ marginTop: '8px', fontStyle: 'italic', color: '#666' }}>
                                            Generating key...
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {keyCopied && (
                        <p className="form-help-text" style={{ marginTop: '24px', color: '#25a85a', fontWeight: 'bold' }}>
                            Once checked you complete the 2 steps, your Telegram account will appear as connected. You can now close this window.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

