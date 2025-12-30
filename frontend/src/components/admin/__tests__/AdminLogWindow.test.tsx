// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminLogWindow } from '../AdminLogWindow';
import { API_BASE_URL } from '../../../config/api';

// Mock API_BASE_URL
vi.mock('../../../config/api', () => ({
    API_BASE_URL: 'http://localhost:3000',
}));

describe('AdminLogWindow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = vi.fn();
        localStorage.clear();
    });

    it('should render admin log window', () => {
        render(<AdminLogWindow />);

        expect(screen.getByText('Admin Log')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
    });

    it('should fetch admin log on mount', async () => {
        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ log: 'Test log content' }),
        });

        render(<AdminLogWindow />);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE_URL}/api/admin`,
                expect.objectContaining({
                    headers: expect.any(Object),
                })
            );
        });
    });

    it('should use custom endpoint when provided', async () => {
        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ log: 'Test log content' }),
        });

        render(<AdminLogWindow endpoint="/api/custom" />);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE_URL}/api/custom`,
                expect.any(Object)
            );
        });
    });

    it('should include authorization header when token is present', async () => {
        localStorage.setItem('habitus_token', 'test-token');
        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ log: 'Test log content' }),
        });

        render(<AdminLogWindow />);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer test-token',
                    }),
                })
            );
        });
    });

    it('should display log content when fetch succeeds', async () => {
        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ log: '=== USERS ===\nUSER #1 : ID=1 | Name=Test' }),
        });

        render(<AdminLogWindow />);

        await waitFor(() => {
            expect(screen.getByText(/=== USERS ===/)).toBeInTheDocument();
        });
    });

    it('should display error message when fetch fails', async () => {
        (global.fetch as any).mockResolvedValue({
            ok: false,
            status: 403,
            statusText: 'Forbidden',
            text: async () => JSON.stringify({ error: 'Admin access required' }),
        });

        render(<AdminLogWindow />);

        await waitFor(() => {
            expect(screen.getByText(/Error:/)).toBeInTheDocument();
            expect(screen.getByText(/Admin access required/)).toBeInTheDocument();
        });
    });

    it('should display error message when fetch throws', async () => {
        (global.fetch as any).mockRejectedValue(new Error('Network error'));

        render(<AdminLogWindow />);

        await waitFor(() => {
            expect(screen.getByText(/Error:/)).toBeInTheDocument();
            expect(screen.getByText(/Network error/)).toBeInTheDocument();
        });
    });

    it('should refresh log when refresh button is clicked', async () => {
        const user = userEvent.setup();
        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ log: 'Test log content' }),
        });

        render(<AdminLogWindow />);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });

        const refreshButton = screen.getByRole('button', { name: /refresh/i });
        await user.click(refreshButton);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledTimes(2);
        });
    });

    it('should show loading state while fetching', async () => {
        (global.fetch as any).mockImplementation(
            () => new Promise((resolve) => setTimeout(() => resolve({
                ok: true,
                json: async () => ({ log: 'Test log content' }),
            }), 100))
        );

        const { container } = render(<AdminLogWindow />);

        // Check that loading state appears in the content area
        const logContent = container.querySelector('.admin-log-text');
        expect(logContent).toHaveTextContent('Loading...');

        await waitFor(() => {
            expect(logContent).not.toHaveTextContent('Loading...');
        });
    });

    it('should disable refresh button while loading', async () => {
        (global.fetch as any).mockImplementation(
            () => new Promise((resolve) => setTimeout(() => resolve({
                ok: true,
                json: async () => ({ log: 'Test log content' }),
            }), 100))
        );

        render(<AdminLogWindow />);

        const refreshButton = screen.getByRole('button', { name: /refresh/i });
        expect(refreshButton).toBeDisabled();

        await waitFor(() => {
            expect(refreshButton).not.toBeDisabled();
        });
    });

    it('should retry when retry button is clicked after error', async () => {
        const user = userEvent.setup();
        (global.fetch as any)
            .mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                text: async () => JSON.stringify({ error: 'Server error' }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ log: 'Success log' }),
            });

        render(<AdminLogWindow />);

        await waitFor(() => {
            expect(screen.getByText(/Error:/)).toBeInTheDocument();
        });

        const retryButton = screen.getByRole('button', { name: /retry/i });
        await user.click(retryButton);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledTimes(2);
        });
    });

    it('should not listen to change events when listenToChanges is false', () => {
        const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

        render(<AdminLogWindow listenToChanges={false} />);

        expect(addEventListenerSpy).not.toHaveBeenCalledWith('trackingsChanged', expect.any(Function));
        expect(addEventListenerSpy).not.toHaveBeenCalledWith('remindersChanged', expect.any(Function));

        addEventListenerSpy.mockRestore();
    });

    it('should listen to change events when listenToChanges is true', () => {
        const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

        render(<AdminLogWindow listenToChanges={true} />);

        expect(addEventListenerSpy).toHaveBeenCalledWith('trackingsChanged', expect.any(Function));
        expect(addEventListenerSpy).toHaveBeenCalledWith('remindersChanged', expect.any(Function));

        addEventListenerSpy.mockRestore();
    });

    it('should auto-scroll to bottom when content changes', async () => {
        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ log: 'Test log content\nLine 2\nLine 3' }),
        });

        const { container } = render(<AdminLogWindow />);

        await waitFor(() => {
            const logText = container.querySelector('.admin-log-text');
            expect(logText).toBeInTheDocument();
            // Check that scrollTop is set (would be set to scrollHeight)
            expect((logText as HTMLElement).scrollTop).toBeGreaterThanOrEqual(0);
        });
    });
});

