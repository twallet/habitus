// @vitest-environment jsdom
import { vi, type MockedFunction, type Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AdminPage } from '../AdminPage';
import { useAuth } from '../../../hooks/useAuth';
import { API_BASE_URL } from '../../../config/api';

// Mock useAuth hook
vi.mock('../../../hooks/useAuth', () => ({
    useAuth: vi.fn(),
}));

// Mock AdminLogWindow component
vi.mock('../../../components/admin/AdminLogWindow', () => ({
    AdminLogWindow: ({ endpoint }: { endpoint: string }) => (
        <div data-testid="admin-log-window">AdminLogWindow: {endpoint}</div>
    ),
}));

// Mock API_BASE_URL
vi.mock('../../../config/api', () => ({
    API_BASE_URL: 'http://localhost:3000',
}));

// Mock window.confirm and window.alert
const mockConfirm = vi.fn();
const mockAlert = vi.fn();
const mockReload = vi.fn();

Object.defineProperty(window, 'confirm', {
    writable: true,
    value: mockConfirm,
});

Object.defineProperty(window, 'alert', {
    writable: true,
    value: mockAlert,
});

Object.defineProperty(window, 'location', {
    writable: true,
    value: {
        reload: mockReload,
    },
});

const mockUseAuth = useAuth as MockedFunction<typeof useAuth>;

describe('AdminPage', () => {
    const getMockAuthReturn = (overrides?: {
        isAuthenticated?: boolean;
        isLoading?: boolean;
        token?: string | null;
    }) => ({
        user: null,
        token: overrides?.token ?? 'mock-token',
        isLoading: overrides?.isLoading ?? false,
        isAuthenticated: overrides?.isAuthenticated ?? false,
        requestLoginMagicLink: vi.fn(),
        requestRegisterMagicLink: vi.fn(),
        requestEmailChange: vi.fn(),
        verifyMagicLink: vi.fn(),
        logout: vi.fn(),
        setTokenFromCallback: vi.fn(),
        updateProfile: vi.fn(),
        updateNotificationPreferences: vi.fn(),
        updateUserPreferences: vi.fn(),
        deleteUser: vi.fn(),
    });

    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = vi.fn();
    });

    it('should show loading state when isLoading is true', () => {
        mockUseAuth.mockReturnValue(getMockAuthReturn({ isLoading: true }));

        render(
            <MemoryRouter>
                <AdminPage />
            </MemoryRouter>
        );

        expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should redirect to login when not authenticated', () => {
        mockUseAuth.mockReturnValue(getMockAuthReturn({ isAuthenticated: false }));

        render(
            <MemoryRouter initialEntries={['/admin']}>
                <AdminPage />
            </MemoryRouter>
        );

        // Navigate component will redirect, so admin content should not be visible
        expect(screen.queryByText('Clear All Data')).not.toBeInTheDocument();
    });

    it('should render admin panel when authenticated', () => {
        mockUseAuth.mockReturnValue(
            getMockAuthReturn({
                isAuthenticated: true,
                token: 'mock-token',
            })
        );

        render(
            <MemoryRouter>
                <AdminPage />
            </MemoryRouter>
        );

        expect(screen.getByText('Clear All Data')).toBeInTheDocument();
        expect(screen.getByTestId('admin-log-window')).toBeInTheDocument();
    });

    it('should not clear database when first confirmation is cancelled', async () => {
        const user = userEvent.setup();
        mockUseAuth.mockReturnValue(
            getMockAuthReturn({
                isAuthenticated: true,
                token: 'mock-token',
            })
        );
        mockConfirm.mockReturnValue(false);

        render(
            <MemoryRouter>
                <AdminPage />
            </MemoryRouter>
        );

        const clearButton = screen.getByText('Clear All Data');
        await user.click(clearButton);

        expect(mockConfirm).toHaveBeenCalledTimes(1);
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should not clear database when second confirmation is cancelled', async () => {
        const user = userEvent.setup();
        mockUseAuth.mockReturnValue(
            getMockAuthReturn({
                isAuthenticated: true,
                token: 'mock-token',
            })
        );
        mockConfirm
            .mockReturnValueOnce(true) // First confirmation
            .mockReturnValueOnce(false); // Second confirmation

        render(
            <MemoryRouter>
                <AdminPage />
            </MemoryRouter>
        );

        const clearButton = screen.getByText('Clear All Data');
        await user.click(clearButton);

        expect(mockConfirm).toHaveBeenCalledTimes(2);
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should clear database when both confirmations are accepted', async () => {
        const user = userEvent.setup();
        mockUseAuth.mockReturnValue(
            getMockAuthReturn({
                isAuthenticated: true,
                token: 'mock-token',
            })
        );
        mockConfirm.mockReturnValue(true);
        (global.fetch as Mock).mockResolvedValue({
            ok: true,
            json: async () => ({ message: 'Database cleared successfully' }),
        });

        render(
            <MemoryRouter>
                <AdminPage />
            </MemoryRouter>
        );

        const clearButton = screen.getByText('Clear All Data');
        await user.click(clearButton);

        await waitFor(() => {
            expect(mockConfirm).toHaveBeenCalledTimes(2);
        });

        expect(global.fetch).toHaveBeenCalledWith(
            `${API_BASE_URL}/api/admin/clear-db`,
            {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer mock-token',
                    'Content-Type': 'application/json',
                },
            }
        );
    });

    it('should show error message when clearing database fails', async () => {
        const user = userEvent.setup();
        mockUseAuth.mockReturnValue(
            getMockAuthReturn({
                isAuthenticated: true,
                token: 'mock-token',
            })
        );
        mockConfirm.mockReturnValue(true);
        (global.fetch as Mock).mockResolvedValue({
            ok: false,
            json: async () => ({ error: 'Failed to clear database' }),
        });

        render(
            <MemoryRouter>
                <AdminPage />
            </MemoryRouter>
        );

        const clearButton = screen.getByText('Clear All Data');
        await user.click(clearButton);

        await waitFor(() => {
            expect(screen.getByText(/Error: Failed to clear database/)).toBeInTheDocument();
        });

        expect(clearButton).not.toBeDisabled();
    });

    it('should show loading state while clearing database', async () => {
        const user = userEvent.setup();
        mockUseAuth.mockReturnValue(
            getMockAuthReturn({
                isAuthenticated: true,
                token: 'mock-token',
            })
        );
        mockConfirm.mockReturnValue(true);
        (global.fetch as Mock).mockImplementation(
            () => new Promise((resolve) => setTimeout(() => resolve({
                ok: true,
                json: async () => ({ message: 'Database cleared successfully' }),
            }), 100))
        );

        render(
            <MemoryRouter>
                <AdminPage />
            </MemoryRouter>
        );

        const clearButton = screen.getByText('Clear All Data');
        await user.click(clearButton);

        await waitFor(() => {
            expect(screen.getByText('Clearing...')).toBeInTheDocument();
        });

        expect(clearButton).toBeDisabled();
    });

    it('should handle fetch errors', async () => {
        const user = userEvent.setup();
        mockUseAuth.mockReturnValue(
            getMockAuthReturn({
                isAuthenticated: true,
                token: 'mock-token',
            })
        );
        mockConfirm.mockReturnValue(true);
        (global.fetch as Mock).mockRejectedValue(new Error('Network error'));

        render(
            <MemoryRouter>
                <AdminPage />
            </MemoryRouter>
        );

        const clearButton = screen.getByText('Clear All Data');
        await user.click(clearButton);

        await waitFor(() => {
            expect(screen.getByText(/Error: Network error/)).toBeInTheDocument();
        });
    });
});

