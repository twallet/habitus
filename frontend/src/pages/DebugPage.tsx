import { DebugLogWindow } from '../components/DebugLogWindow';

/**
 * Debug page component that displays the debug log window.
 * Standalone page without app layout components.
 * @public
 */
export function DebugPage() {
    return (
        <div className="debug-page" style={{ padding: '20px', minHeight: '100vh', backgroundColor: '#1e1e1e' }}>
            <DebugLogWindow />
        </div>
    );
}

