// @vitest-environment jsdom
import { vi, type MockedFunction } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProtectedRoute } from '../ProtectedRoute';
import { useAuth } from '../../hooks/useAuth';

// Mock useAuth hook
vi.mock('../../hooks/useAuth', () => ({
    useAuth: vi.fn(),
}));

const mockUseAuth = useAuth as MockedFunction<typeof useAuth>;

describe('ProtectedRoute', () => {
    const TestChild = () => <div>Protected Content</div>;

    const getMockAuthReturn = (overrides?: {
        isAuthenticated?: boolean;
        isLoading?: boolean;
        user?: any;
        token?: string | null;
    }) => ({
        user: overrides?.user ?? null,
        token: overrides?.token ?? null,
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
        getTelegramStartLink: vi.fn(),
        getTelegramStatus: vi.fn(),
        cancelTelegramConnection: vi.fn(),
        disconnectTelegram: vi.fn(),
        updateUserPreferences: vi.fn(),
        deleteUser: vi.fn(),
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should show loading state when isLoading is true', () => {
        mockUseAuth.mockReturnValue(getMockAuthReturn({ isLoading: true }));

        render(
            <MemoryRouter>
                <ProtectedRoute>
                    <TestChild />
                </ProtectedRoute>
            </MemoryRouter>
        );

        expect(screen.getByText('Loading...')).toBeInTheDocument();
        expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('should show loading message with container class', () => {
        mockUseAuth.mockReturnValue(getMockAuthReturn({ isLoading: true }));

        const { container } = render(
            <MemoryRouter>
                <ProtectedRoute>
                    <TestChild />
                </ProtectedRoute>
            </MemoryRouter>
        );

        const loadingDiv = container.querySelector('.container .loading');
        expect(loadingDiv).toBeInTheDocument();
        expect(loadingDiv).toHaveTextContent('Loading...');
    });

    it('should redirect to login when not authenticated', () => {
        mockUseAuth.mockReturnValue(getMockAuthReturn({ isAuthenticated: false }));

        render(
            <MemoryRouter initialEntries={['/protected']}>
                <ProtectedRoute>
                    <TestChild />
                </ProtectedRoute>
            </MemoryRouter>
        );

        // Navigate component will redirect, so child content should not be visible
        expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('should render children when authenticated', () => {
        const mockUser = {
            id: 1,
            name: 'Test User',
            email: 'test@example.com',
            created_at: '2024-01-01T00:00:00Z',
        };

        mockUseAuth.mockReturnValue(
            getMockAuthReturn({
                isAuthenticated: true,
                user: mockUser,
                token: 'mock-token',
            })
        );

        render(
            <MemoryRouter>
                <ProtectedRoute>
                    <TestChild />
                </ProtectedRoute>
            </MemoryRouter>
        );

        expect(screen.getByText('Protected Content')).toBeInTheDocument();
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    it('should render multiple children when authenticated', () => {
        const mockUser = {
            id: 1,
            name: 'Test User',
            email: 'test@example.com',
            created_at: '2024-01-01T00:00:00Z',
        };

        mockUseAuth.mockReturnValue(
            getMockAuthReturn({
                isAuthenticated: true,
                user: mockUser,
                token: 'mock-token',
            })
        );

        render(
            <MemoryRouter>
                <ProtectedRoute>
                    <div>Child 1</div>
                    <div>Child 2</div>
                    <TestChild />
                </ProtectedRoute>
            </MemoryRouter>
        );

        expect(screen.getByText('Child 1')).toBeInTheDocument();
        expect(screen.getByText('Child 2')).toBeInTheDocument();
        expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    it('should not show loading when isLoading is false and authenticated', () => {
        const mockUser = {
            id: 1,
            name: 'Test User',
            email: 'test@example.com',
            created_at: '2024-01-01T00:00:00Z',
        };

        mockUseAuth.mockReturnValue(
            getMockAuthReturn({
                isLoading: false,
                isAuthenticated: true,
                user: mockUser,
                token: 'mock-token',
            })
        );

        render(
            <MemoryRouter>
                <ProtectedRoute>
                    <TestChild />
                </ProtectedRoute>
            </MemoryRouter>
        );

        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
        expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    it('should handle loading state transition to authenticated', () => {
        const mockUser = {
            id: 1,
            name: 'Test User',
            email: 'test@example.com',
            created_at: '2024-01-01T00:00:00Z',
        };

        // First render: loading
        mockUseAuth.mockReturnValue(getMockAuthReturn({ isLoading: true }));
        const { rerender } = render(
            <MemoryRouter>
                <ProtectedRoute>
                    <TestChild />
                </ProtectedRoute>
            </MemoryRouter>
        );

        expect(screen.getByText('Loading...')).toBeInTheDocument();

        // Second render: authenticated
        mockUseAuth.mockReturnValue(
            getMockAuthReturn({
                isLoading: false,
                isAuthenticated: true,
                user: mockUser,
                token: 'mock-token',
            })
        );
        rerender(
            <MemoryRouter>
                <ProtectedRoute>
                    <TestChild />
                </ProtectedRoute>
            </MemoryRouter>
        );

        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
        expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    it('should handle loading state transition to unauthenticated', () => {
        // First render: loading
        mockUseAuth.mockReturnValue(getMockAuthReturn({ isLoading: true }));
        const { rerender } = render(
            <MemoryRouter>
                <ProtectedRoute>
                    <TestChild />
                </ProtectedRoute>
            </MemoryRouter>
        );

        expect(screen.getByText('Loading...')).toBeInTheDocument();

        // Second render: not authenticated
        mockUseAuth.mockReturnValue(getMockAuthReturn({ isLoading: false, isAuthenticated: false }));
        rerender(
            <MemoryRouter>
                <ProtectedRoute>
                    <TestChild />
                </ProtectedRoute>
            </MemoryRouter>
        );

        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
        expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });
});

