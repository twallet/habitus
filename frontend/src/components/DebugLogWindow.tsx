import { useEffect, useState, useRef } from 'react';
import { API_BASE_URL } from '../config/api';
import './DebugLogWindow.css';

/**
 * Debug log window component that displays trackings and reminders debug information.
 * Automatically refreshes when trackings or reminders change.
 * @public
 */
export function DebugLogWindow() {
    const [logContent, setLogContent] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const logRef = useRef<HTMLPreElement>(null);

    /**
     * Fetch debug log from API.
     * @internal
     */
    const fetchDebugLog = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const token = localStorage.getItem('habitus_token');
            const url = `${API_BASE_URL}/api/trackings/debug`;
            const headers: Record<string, string> = {};

            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(url, { headers });

            if (response.ok) {
                const data = await response.json();
                setLogContent(data.log || '');
                setError(null);
            } else {
                const errorText = await response.text();
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch {
                    errorData = { error: errorText || `HTTP ${response.status}: ${response.statusText}` };
                }
                setError(errorData.error || `Failed to fetch debug log: ${response.status} ${response.statusText}`);
                setLogContent('');
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to fetch debug log';
            setError(errorMessage);
            setLogContent('');
            console.error('[DebugLogWindow] Error fetching debug log:', err);
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Initial fetch and setup refresh listener.
     * @internal
     */
    useEffect(() => {
        console.log('[DebugLogWindow] Component mounted, fetching debug log');
        fetchDebugLog();

        // Listen for custom events when trackings or reminders change
        const handleTrackingChange = () => {
            fetchDebugLog();
        };

        const handleReminderChange = () => {
            fetchDebugLog();
        };

        // Listen for tracking and reminder change events
        window.addEventListener('trackingsChanged', handleTrackingChange);
        window.addEventListener('remindersChanged', handleReminderChange);
        window.addEventListener('trackingDeleted', handleTrackingChange);

        return () => {
            window.removeEventListener('trackingsChanged', handleTrackingChange);
            window.removeEventListener('remindersChanged', handleReminderChange);
            window.removeEventListener('trackingDeleted', handleTrackingChange);
        };
    }, []);

    /**
     * Auto-scroll to bottom when content changes.
     * @internal
     */
    useEffect(() => {
        if (logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [logContent]);

    return (
        <div className="debug-log-window">
            <div className="debug-log-header">
                <h3>Debug Log</h3>
                <button
                    type="button"
                    className="debug-log-refresh"
                    onClick={fetchDebugLog}
                    disabled={isLoading}
                    aria-label="Refresh debug log"
                >
                    {isLoading ? 'Loading...' : 'Refresh'}
                </button>
            </div>
            <div className="debug-log-content">
                {error ? (
                    <div className="debug-log-error">
                        <strong>Error:</strong> {error}
                        <br />
                        <button
                            type="button"
                            onClick={fetchDebugLog}
                            style={{
                                marginTop: '8px',
                                padding: '4px 8px',
                                background: '#0e639c',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                            }}
                        >
                            Retry
                        </button>
                    </div>
                ) : (
                    <pre ref={logRef} className="debug-log-text">
                        {logContent || (isLoading ? 'Loading...' : 'Click Refresh to load debug log')}
                    </pre>
                )}
            </div>
        </div>
    );
}

