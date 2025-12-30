import { useState } from 'react';
import { DebugLogWindow } from '../../components/debug/DebugLogWindow';
import { useAuth } from '../../hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config/api';

/**
 * Admin page component that displays admin tools and debug information.
 * Requires authentication and admin access.
 * @public
 */
export function AdminPage() {
    const { isAuthenticated, isLoading, token } = useAuth();
    const [isClearing, setIsClearing] = useState(false);
    const [clearError, setClearError] = useState<string | null>(null);

    if (isLoading) {
        return (
            <div className="container">
                <div className="loading">Loading...</div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    /**
     * Handle clearing all database data.
     * @internal
     */
    const handleClearDatabase = async () => {
        if (!confirm('Are you sure you want to clear ALL data from the database? This action cannot be undone.')) {
            return;
        }

        if (!confirm('This will delete ALL users, trackings, reminders, and schedules. Are you absolutely sure?')) {
            return;
        }

        setIsClearing(true);
        setClearError(null);

        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/clear-db`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to clear database');
            }

            alert('Database cleared successfully. Refreshing page...');
            window.location.reload();
        } catch (error) {
            setClearError(error instanceof Error ? error.message : 'Unknown error');
            setIsClearing(false);
        }
    };

    return (
        <div className="admin-page" style={{ padding: '20px', minHeight: '100vh', backgroundColor: '#1e1e1e' }}>
            <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 style={{ color: '#fff', margin: 0 }}>Admin Panel</h1>
                <button
                    onClick={handleClearDatabase}
                    disabled={isClearing}
                    style={{
                        padding: '10px 20px',
                        backgroundColor: '#dc3545',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: isClearing ? 'not-allowed' : 'pointer',
                        fontSize: '16px',
                        opacity: isClearing ? 0.6 : 1,
                    }}
                >
                    {isClearing ? 'Clearing...' : 'Clear All Data'}
                </button>
            </div>
            {clearError && (
                <div style={{
                    padding: '10px',
                    backgroundColor: '#dc3545',
                    color: '#fff',
                    borderRadius: '4px',
                    marginBottom: '20px'
                }}>
                    Error: {clearError}
                </div>
            )}
            <DebugLogWindow endpoint="/api/admin" listenToChanges={false} />
        </div>
    );
}

