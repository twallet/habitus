import { DebugPage } from './DebugPage';

/**
 * Wrapper component that only renders DebugPage in development environment.
 * Shows a message in production indicating the page is not available.
 * @public
 */
export function DevOnlyDebugPage() {
    // Check if we're in development mode
    const isDev = import.meta.env.DEV;

    if (!isDev) {
        return (
            <div className="debug-page" style={{ padding: '20px', minHeight: '100vh', backgroundColor: '#1e1e1e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                    <h1>Debug Page Not Available</h1>
                    <p>This page is only available in development environment.</p>
                </div>
            </div>
        );
    }

    return <DebugPage />;
}

