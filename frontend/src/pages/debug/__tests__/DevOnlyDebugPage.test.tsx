// @vitest-environment jsdom
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DevOnlyDebugPage } from '../DevOnlyDebugPage';
import { DebugPage } from '../DebugPage';

// Mock DebugPage component
vi.mock('../DebugPage', () => ({
    DebugPage: vi.fn(() => <div data-testid="debug-page">Debug Page</div>),
}));

describe('DevOnlyDebugPage', () => {
    const originalDev = import.meta.env.DEV;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        // Restore original env value
        (import.meta.env as any).DEV = originalDev;
    });

    it('should render DebugPage when in development mode', () => {
        // Set DEV to true
        (import.meta.env as any).DEV = true;

        render(<DevOnlyDebugPage />);

        expect(DebugPage).toHaveBeenCalled();
        expect(screen.getByTestId('debug-page')).toBeInTheDocument();
        expect(screen.queryByText('Debug Page Not Available')).not.toBeInTheDocument();
    });

    it('should show "not available" message when not in development mode', () => {
        // Set DEV to false
        (import.meta.env as any).DEV = false;

        render(<DevOnlyDebugPage />);

        expect(screen.getByText('Debug Page Not Available')).toBeInTheDocument();
        expect(screen.getByText('This page is only available in development environment.')).toBeInTheDocument();
        expect(DebugPage).not.toHaveBeenCalled();
    });

    it('should have correct styling for the "not available" message', () => {
        // Set DEV to false
        (import.meta.env as any).DEV = false;

        render(<DevOnlyDebugPage />);

        const container = screen.getByText('Debug Page Not Available').closest('.debug-page');
        expect(container).toBeInTheDocument();
        expect(container).toHaveStyle({
            padding: '20px',
            minHeight: '100vh',
            backgroundColor: '#1e1e1e',
            color: '#fff',
        });
    });

    it('should have centered content in "not available" message', () => {
        // Set DEV to false
        (import.meta.env as any).DEV = false;

        render(<DevOnlyDebugPage />);

        const innerDiv = screen.getByText('Debug Page Not Available').parentElement;
        expect(innerDiv).toHaveStyle({ textAlign: 'center' });
    });
});

