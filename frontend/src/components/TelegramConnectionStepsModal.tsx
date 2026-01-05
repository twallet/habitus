import { useState, useEffect, useRef } from 'react';
import './NotificationsModal.css';

interface TelegramConnectionStepsModalProps {
    onClose: () => void;
    onCancel?: () => void;
    onGetTelegramStartLink: () => Promise<{ link: string; token: string }>;
    onCopyClicked?: () => void;
    onGetTelegramStatus?: () => Promise<{ connected: boolean; telegramChatId: string | null; telegramUsername: string | null; hasActiveToken: boolean }>;
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
    onCancel,
    onGetTelegramStartLink,
    onCopyClicked,
    onGetTelegramStatus,
}: TelegramConnectionStepsModalProps) {
    const [telegramStartCommand, setTelegramStartCommand] = useState<string | null>(null);
    const [telegramBotLink, setTelegramBotLink] = useState<string | null>(null);
    const [isGeneratingLink, setIsGeneratingLink] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [connectionStep, setConnectionStep] = useState<'steps' | 'waiting'>('steps');
    const [step1Completed, setStep1Completed] = useState(false);
    const hasGeneratedRef = useRef(false);
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const onGetTelegramStatusRef = useRef(onGetTelegramStatus || null);

    /**
     * Update ref when prop changes.
     * @internal
     */
    useEffect(() => {
        onGetTelegramStatusRef.current = onGetTelegramStatus || null;
    }, [onGetTelegramStatus]);

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

                // Store the bot link and extract start command from link
                setTelegramBotLink(result.link);

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
     * Poll for Telegram connection status when in waiting state.
     * This is a fallback in case SSE events are not received.
     * @internal
     */
    useEffect(() => {
        if (connectionStep === 'waiting' && onGetTelegramStatusRef.current) {
            // Start polling every 2 seconds
            const pollStatus = async () => {
                try {
                    const status = await onGetTelegramStatusRef.current!();
                    if (status.connected && status.telegramChatId) {
                        // Connection complete, close the modal
                        console.log('[TelegramConnectionStepsModal] Connection detected via polling, closing modal');
                        setConnectionStep('steps');
                        setStep1Completed(false);
                        hasGeneratedRef.current = false;
                        setTelegramStartCommand(null);
                        setTelegramBotLink(null);
                        onClose();
                    }
                } catch (err) {
                    console.error('[TelegramConnectionStepsModal] Error polling status:', err);
                }
            };

            // Poll immediately, then every 2 seconds
            pollStatus();
            pollingIntervalRef.current = setInterval(pollStatus, 2000);

            return () => {
                if (pollingIntervalRef.current) {
                    clearInterval(pollingIntervalRef.current);
                    pollingIntervalRef.current = null;
                }
            };
        } else {
            // Stop polling when not in waiting state
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }
        }
    }, [connectionStep, onClose]);

    /**
     * Handle modal close with confirmation if in waiting state or if step 1 was completed.
     * @internal
     */
    const handleModalClose = () => {
        if (connectionStep === 'waiting' || step1Completed) {
            // Show confirmation dialog with clearer wording
            if (window.confirm('Are you sure you want to close? Your Telegram connection is not complete yet.')) {
                setStep1Completed(false);
                setConnectionStep('steps');
                hasGeneratedRef.current = false;
                setTelegramStartCommand(null);
                setTelegramBotLink(null);
                // Stop polling if active
                if (pollingIntervalRef.current) {
                    clearInterval(pollingIntervalRef.current);
                    pollingIntervalRef.current = null;
                }
                if (onCancel) {
                    onCancel(); // Parent will handle closing
                } else {
                    onClose(); // Fallback to close
                }
            }
            // If user clicks "Cancel", do nothing - stay on current view
        } else {
            // Close immediately when not in waiting state and step 1 not completed
            setStep1Completed(false);
            setConnectionStep('steps');
            hasGeneratedRef.current = false;
            setTelegramStartCommand(null);
            setTelegramBotLink(null);
            // Stop polling if active
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }
            onClose();
        }
    };

    /**
     * Handle cancel button click (no confirmation needed).
     * @internal
     */
    const handleCancel = () => {
        setStep1Completed(false);
        setConnectionStep('steps');
        hasGeneratedRef.current = false;
        setTelegramStartCommand(null);
        setTelegramBotLink(null);
        // Stop polling if active
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }
        if (onCancel) {
            onCancel(); // Parent will handle closing the modal
        } else {
            onClose(); // Fallback to close if no onCancel handler
        }
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

                    {!isGeneratingLink && connectionStep === 'steps' && (
                        <div className="telegram-connection-panel-inline">
                            <div className="connection-step">
                                <div className={`step-indicator ${telegramStartCommand && !step1Completed ? 'active' : ''} ${step1Completed ? 'completed' : ''}`}>1</div>
                                <div className="step-content">
                                    <h4>Copy your key</h4>
                                    <p className="form-help-text">
                                        Copy your key by clicking the button below:
                                    </p>
                                    {telegramStartCommand ? (
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                if (telegramStartCommand) {
                                                    try {
                                                        await navigator.clipboard.writeText(telegramStartCommand);
                                                        setStep1Completed(true);
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
                                            disabled={step1Completed}
                                            style={{
                                                display: 'inline-block',
                                                textAlign: 'center',
                                                marginTop: '8px',
                                                width: 'auto',
                                                height: 'auto',
                                                minHeight: '32px',
                                                lineHeight: '32px',
                                                opacity: step1Completed ? 0.5 : 1,
                                                cursor: step1Completed ? 'not-allowed' : 'pointer'
                                            }}
                                            title={step1Completed ? "Key already copied" : "Copy key to clipboard"}
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
                            <div className="connection-step">
                                <div className={`step-indicator ${step1Completed ? 'active' : ''}`}>2</div>
                                <div className="step-content">
                                    <h4>Go to 🌱 Habitus in Telegram</h4>
                                    <p className="form-help-text">Paste the key in the Telegram Habitus chat:</p>
                                    <button
                                        type="button"
                                        disabled={!step1Completed}
                                        onClick={() => {
                                            // Open Telegram bot in new tab
                                            if (telegramBotLink) {
                                                window.open(telegramBotLink, '_blank', 'noopener,noreferrer');
                                            }
                                            setConnectionStep('waiting');
                                        }}
                                        className="btn-primary telegram-link-button"
                                        style={{
                                            display: 'inline-block',
                                            textAlign: 'center',
                                            marginTop: '8px',
                                            height: 'auto',
                                            minHeight: '32px',
                                            lineHeight: '32px',
                                            opacity: step1Completed ? 1 : 0.5,
                                            cursor: step1Completed ? 'pointer' : 'not-allowed'
                                        }}
                                        title={step1Completed ? "Open Telegram chat to paste the key" : "Copy the key first"}
                                    >
                                        Go to chat
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {connectionStep === 'waiting' && (
                        <div className="telegram-waiting-view" style={{ padding: '20px', textAlign: 'center' }}>
                            <div style={{ marginBottom: '20px' }}>
                                <div className="spinner" style={{
                                    border: '4px solid #f3f3f3',
                                    borderTop: '4px solid #25a85a',
                                    borderRadius: '50%',
                                    width: '40px',
                                    height: '40px',
                                    animation: 'spin 1s linear infinite',
                                    margin: '0 auto 20px'
                                }}></div>
                                <p className="form-help-text" style={{ fontSize: '16px', marginBottom: '10px' }}>
                                    Waiting for you to paste the key in the Telegram Habitus chat...
                                </p>
                                <p className="form-help-text" style={{ color: '#666', fontSize: '14px' }}>
                                    Once you paste the key, your account will be connected automatically.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="btn-secondary"
                                style={{
                                    marginTop: '20px',
                                    padding: '10px 20px'
                                }}
                            >
                                Cancel Connection
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

