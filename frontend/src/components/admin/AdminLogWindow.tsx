import { useEffect, useState, useRef, useCallback } from 'react';
import { API_BASE_URL } from '../../config/api';
import './AdminLogWindow.css';

/**
 * Converts ANSI color codes to HTML spans with CSS colors.
 * @param text - Text containing ANSI escape codes
 * @returns HTML string with color spans
 * @internal
 */
function ansiToHtml(text: string): string {
    // Escape HTML special characters
    const escapeHtml = (str: string): string => {
        const map: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;',
        };
        return str.replace(/[&<>"']/g, (m) => map[m]);
    };

    // Replace ANSI codes with HTML spans (matching PowerShell colors)
    let html = escapeHtml(text);

    // Replace ANSI codes with HTML spans
    html = html.replace(/\x1b\[32m/g, '<span style="color: #4ec9b0">'); // Green
    html = html.replace(/\x1b\[33m/g, '<span style="color: #dcdcaa">'); // Yellow
    html = html.replace(/\x1b\[34m/g, '<span style="color: #569cd6">'); // Blue
    html = html.replace(/\x1b\[35m/g, '<span style="color: #c586c0">'); // Magenta
    html = html.replace(/\x1b\[36m/g, '<span style="color: #4ec9b0">'); // Cyan
    html = html.replace(/\x1b\[37m/g, '<span style="color: #d4d4d4">'); // White
    html = html.replace(/\x1b\[90m/g, '<span style="color: #808080">'); // Gray
    html = html.replace(/\x1b\[93m/g, '<span style="color: #dcdcaa">'); // Bright Yellow
    html = html.replace(/\x1b\[0m/g, '</span>'); // Reset

    // Close any unclosed spans at the end
    const openSpans = (html.match(/<span/g) || []).length;
    const closeSpans = (html.match(/<\/span>/g) || []).length;
    for (let i = 0; i < openSpans - closeSpans; i++) {
        html += '</span>';
    }

    return html;
}

/**
 * Props for AdminLogWindow component.
 * @public
 */
export interface AdminLogWindowProps {
    /**
     * Custom API endpoint to fetch log from. Defaults to '/api/admin'.
     */
    endpoint?: string;
    /**
     * Whether to listen for change events. Defaults to false.
     */
    listenToChanges?: boolean;
}

/**
 * Admin log window component that displays admin information.
 * Shows formatted log output from the admin API endpoint.
 * @param props - Component props
 * @public
 */
export function AdminLogWindow({ endpoint = '/api/admin', listenToChanges = false }: AdminLogWindowProps = {}) {
    const [logContent, setLogContent] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const logRef = useRef<HTMLDivElement>(null);

    /**
     * Fetch admin log from API.
     * @internal
     */
    const fetchAdminLog = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const token = localStorage.getItem('habitus_token');
            const url = `${API_BASE_URL}${endpoint}`;
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
                setError(errorData.error || `Failed to fetch admin log: ${response.status} ${response.statusText}`);
                setLogContent('');
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to fetch admin log';
            setError(errorMessage);
            setLogContent('');
            console.error('[AdminLogWindow] Error fetching admin log:', err);
        } finally {
            setIsLoading(false);
        }
    }, [endpoint]);

    /**
     * Initial fetch and setup refresh listener.
     * @internal
     */
    useEffect(() => {
        console.log('[AdminLogWindow] Component mounted, fetching admin log');
        fetchAdminLog();

        if (!listenToChanges) {
            return;
        }

        // Listen for custom events when trackings or reminders change
        const handleTrackingChange = () => {
            fetchAdminLog();
        };

        const handleReminderChange = () => {
            fetchAdminLog();
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
    }, [fetchAdminLog, listenToChanges]);

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
        <div className="admin-log-window">
            <div className="admin-log-header">
                <h3>Admin Log</h3>
                <button
                    type="button"
                    className="admin-log-refresh"
                    onClick={fetchAdminLog}
                    disabled={isLoading}
                    aria-label="Refresh admin log"
                >
                    {isLoading ? 'Loading...' : 'Refresh'}
                </button>
            </div>
            <div className="admin-log-content">
                {error ? (
                    <div className="admin-log-error">
                        <strong>Error:</strong> {error}
                        <br />
                        <button
                            type="button"
                            onClick={fetchAdminLog}
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
                    <div
                        ref={logRef}
                        className="admin-log-text"
                        dangerouslySetInnerHTML={{
                            __html: logContent
                                ? ansiToHtml(logContent)
                                : isLoading
                                    ? 'Loading...'
                                    : 'Click Refresh to load admin log',
                        }}
                    />
                )}
            </div>
        </div>
    );
}

