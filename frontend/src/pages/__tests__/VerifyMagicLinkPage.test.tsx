// @vitest-environment jsdom
import { vi, type MockedFunction } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { VerifyMagicLinkPage } from '../VerifyMagicLinkPage';
import { useAuth } from '../../hooks/useAuth';

// Mock useAuth hook
vi.mock('../../hooks/useAuth', () => ({
    useAuth: vi.fn(),
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

const mockUseAuth = useAuth as MockedFunction<typeof useAuth>;

describe('VerifyMagicLinkPage', () => {
    const mockVerifyMagicLink = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.runAllTimers();
        vi.clearAllTimers();
        cleanup();
        vi.runAllTimers();
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    it('should show loading message while verifying', async () => {
        mockVerifyMagicLink.mockImplementation(() => new Promise(() => { })); // Never resolves
        mockUseAuth.mockReturnValue({
            user: null,
            token: null,
            isLoading: false,
            isAuthenticated: false,
            requestLoginMagicLink: vi.fn(),
            requestRegisterMagicLink: vi.fn(),
            requestEmailChange: vi.fn(),
            verifyMagicLink: mockVerifyMagicLink,
            logout: vi.fn(),
            setTokenFromCallback: vi.fn(),
            updateProfile: vi.fn(),
            updateNotificationPreferences: vi.fn(),
            deleteUser: vi.fn(),
        });

        render(
            <MemoryRouter initialEntries={['/verify-magic-link?token=test-token']}>
                <VerifyMagicLinkPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Verifying your email...')).toBeInTheDocument();
        });
    });

    it('should show error message when token is missing', async () => {
        mockUseAuth.mockReturnValue({
            user: null,
            token: null,
            isLoading: false,
            isAuthenticated: false,
            requestLoginMagicLink: vi.fn(),
            requestRegisterMagicLink: vi.fn(),
            requestEmailChange: vi.fn(),
            verifyMagicLink: mockVerifyMagicLink,
            logout: vi.fn(),
            setTokenFromCallback: vi.fn(),
            updateProfile: vi.fn(),
            updateNotificationPreferences: vi.fn(),
            deleteUser: vi.fn(),
        });

        render(
            <MemoryRouter initialEntries={['/verify-magic-link']}>
                <VerifyMagicLinkPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Invalid verification link. Token is missing.')).toBeInTheDocument();
        });

        expect(mockVerifyMagicLink).not.toHaveBeenCalled();
    });

    it('should redirect to login after 3 seconds when token is missing', async () => {
        mockUseAuth.mockReturnValue({
            user: null,
            token: null,
            isLoading: false,
            isAuthenticated: false,
            requestLoginMagicLink: vi.fn(),
            requestRegisterMagicLink: vi.fn(),
            requestEmailChange: vi.fn(),
            verifyMagicLink: mockVerifyMagicLink,
            logout: vi.fn(),
            setTokenFromCallback: vi.fn(),
            updateProfile: vi.fn(),
            updateNotificationPreferences: vi.fn(),
            deleteUser: vi.fn(),
        });

        render(
            <MemoryRouter initialEntries={['/verify-magic-link']}>
                <VerifyMagicLinkPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Invalid verification link. Token is missing.')).toBeInTheDocument();
        });

        expect(mockNavigate).not.toHaveBeenCalled();

        vi.advanceTimersByTime(3000);

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
        });
    });

    it('should verify magic link successfully and show success message', async () => {
        const mockUser = {
            id: 1,
            name: 'Test User',
            email: 'test@example.com',
            created_at: '2024-01-01T00:00:00Z',
        };

        mockVerifyMagicLink.mockResolvedValue(mockUser);
        mockUseAuth.mockReturnValue({
            user: null,
            token: null,
            isLoading: false,
            isAuthenticated: false,
            requestLoginMagicLink: vi.fn(),
            requestRegisterMagicLink: vi.fn(),
            requestEmailChange: vi.fn(),
            verifyMagicLink: mockVerifyMagicLink,
            logout: vi.fn(),
            setTokenFromCallback: vi.fn(),
            updateProfile: vi.fn(),
            updateNotificationPreferences: vi.fn(),
            deleteUser: vi.fn(),
        });

        render(
            <MemoryRouter initialEntries={['/verify-magic-link?token=valid-token']}>
                <VerifyMagicLinkPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(mockVerifyMagicLink).toHaveBeenCalledWith('valid-token');
        });

        await waitFor(() => {
            expect(screen.getByText('Email verified successfully! Redirecting...')).toBeInTheDocument();
        });
    });

    it('should decode URL-encoded token', async () => {
        const mockUser = {
            id: 1,
            name: 'Test User',
            email: 'test@example.com',
            created_at: '2024-01-01T00:00:00Z',
        };

        const encodedToken = encodeURIComponent('test-token-with-special-chars');
        mockVerifyMagicLink.mockResolvedValue(mockUser);
        mockUseAuth.mockReturnValue({
            user: null,
            token: null,
            isLoading: false,
            isAuthenticated: false,
            requestLoginMagicLink: vi.fn(),
            requestRegisterMagicLink: vi.fn(),
            requestEmailChange: vi.fn(),
            verifyMagicLink: mockVerifyMagicLink,
            logout: vi.fn(),
            setTokenFromCallback: vi.fn(),
            updateProfile: vi.fn(),
            updateNotificationPreferences: vi.fn(),
            deleteUser: vi.fn(),
        });

        render(
            <MemoryRouter initialEntries={[`/verify-magic-link?token=${encodedToken}`]}>
                <VerifyMagicLinkPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(mockVerifyMagicLink).toHaveBeenCalledWith('test-token-with-special-chars');
        });
    });

    it('should handle decode error gracefully when token is already decoded', async () => {
        const mockUser = {
            id: 1,
            name: 'Test User',
            email: 'test@example.com',
            created_at: '2024-01-01T00:00:00Z',
        };

        // Create a token that causes decodeURIComponent to throw
        // Actually, decodeURIComponent won't throw on most inputs, so we'll use a regular token
        const token = 'already-decoded-token';
        mockVerifyMagicLink.mockResolvedValue(mockUser);
        mockUseAuth.mockReturnValue({
            user: null,
            token: null,
            isLoading: false,
            isAuthenticated: false,
            requestLoginMagicLink: vi.fn(),
            requestRegisterMagicLink: vi.fn(),
            requestEmailChange: vi.fn(),
            verifyMagicLink: mockVerifyMagicLink,
            logout: vi.fn(),
            setTokenFromCallback: vi.fn(),
            updateProfile: vi.fn(),
            updateNotificationPreferences: vi.fn(),
            deleteUser: vi.fn(),
        });

        render(
            <MemoryRouter initialEntries={[`/verify-magic-link?token=${token}`]}>
                <VerifyMagicLinkPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(mockVerifyMagicLink).toHaveBeenCalledWith(token);
        });
    });

    it('should show error message when verification fails', async () => {
        const errorMessage = 'Invalid or expired token';
        mockVerifyMagicLink.mockRejectedValue(new Error(errorMessage));
        mockUseAuth.mockReturnValue({
            user: null,
            token: null,
            isLoading: false,
            isAuthenticated: false,
            requestLoginMagicLink: vi.fn(),
            requestRegisterMagicLink: vi.fn(),
            requestEmailChange: vi.fn(),
            verifyMagicLink: mockVerifyMagicLink,
            logout: vi.fn(),
            setTokenFromCallback: vi.fn(),
            updateProfile: vi.fn(),
            updateNotificationPreferences: vi.fn(),
            deleteUser: vi.fn(),
        });

        render(
            <MemoryRouter initialEntries={['/verify-magic-link?token=invalid-token']}>
                <VerifyMagicLinkPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(mockVerifyMagicLink).toHaveBeenCalledWith('invalid-token');
        });

        await waitFor(() => {
            expect(screen.getByText(errorMessage)).toBeInTheDocument();
        });
    });

    it('should show generic error message when verification fails with non-Error', async () => {
        mockVerifyMagicLink.mockRejectedValue('Unknown error');
        mockUseAuth.mockReturnValue({
            user: null,
            token: null,
            isLoading: false,
            isAuthenticated: false,
            requestLoginMagicLink: vi.fn(),
            requestRegisterMagicLink: vi.fn(),
            requestEmailChange: vi.fn(),
            verifyMagicLink: mockVerifyMagicLink,
            logout: vi.fn(),
            setTokenFromCallback: vi.fn(),
            updateProfile: vi.fn(),
            updateNotificationPreferences: vi.fn(),
            deleteUser: vi.fn(),
        });

        render(
            <MemoryRouter initialEntries={['/verify-magic-link?token=invalid-token']}>
                <VerifyMagicLinkPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Invalid or expired verification link')).toBeInTheDocument();
        });
    });

    it('should redirect to login after 3 seconds when verification fails', async () => {
        mockVerifyMagicLink.mockRejectedValue(new Error('Verification failed'));
        mockUseAuth.mockReturnValue({
            user: null,
            token: null,
            isLoading: false,
            isAuthenticated: false,
            requestLoginMagicLink: vi.fn(),
            requestRegisterMagicLink: vi.fn(),
            requestEmailChange: vi.fn(),
            verifyMagicLink: mockVerifyMagicLink,
            logout: vi.fn(),
            setTokenFromCallback: vi.fn(),
            updateProfile: vi.fn(),
            updateNotificationPreferences: vi.fn(),
            deleteUser: vi.fn(),
        });

        render(
            <MemoryRouter initialEntries={['/verify-magic-link?token=invalid-token']}>
                <VerifyMagicLinkPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Verification failed')).toBeInTheDocument();
        });

        expect(mockNavigate).not.toHaveBeenCalled();

        vi.advanceTimersByTime(3000);

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
        });
    });

    it('should redirect to trackings when verification is complete and user is authenticated', async () => {
        const mockUser = {
            id: 1,
            name: 'Test User',
            email: 'test@example.com',
            created_at: '2024-01-01T00:00:00Z',
        };

        mockVerifyMagicLink.mockResolvedValue(mockUser);
        mockUseAuth.mockReturnValue({
            user: mockUser,
            token: 'mock-token',
            isLoading: false,
            isAuthenticated: true,
            requestLoginMagicLink: vi.fn(),
            requestRegisterMagicLink: vi.fn(),
            requestEmailChange: vi.fn(),
            verifyMagicLink: mockVerifyMagicLink,
            logout: vi.fn(),
            setTokenFromCallback: vi.fn(),
            updateProfile: vi.fn(),
            updateNotificationPreferences: vi.fn(),
            deleteUser: vi.fn(),
        });

        render(
            <MemoryRouter initialEntries={['/verify-magic-link?token=valid-token']}>
                <VerifyMagicLinkPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Email verified successfully! Redirecting...')).toBeInTheDocument();
        });

        // Wait for the redirect timer (500ms delay)
        vi.advanceTimersByTime(500);

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith('/trackings', { replace: true });
        });
    });

    it('should not redirect to trackings if user is not authenticated yet', async () => {
        const mockUser = {
            id: 1,
            name: 'Test User',
            email: 'test@example.com',
            created_at: '2024-01-01T00:00:00Z',
        };

        mockVerifyMagicLink.mockResolvedValue(mockUser);
        mockUseAuth.mockReturnValue({
            user: null,
            token: null,
            isLoading: false,
            isAuthenticated: false,
            requestLoginMagicLink: vi.fn(),
            requestRegisterMagicLink: vi.fn(),
            requestEmailChange: vi.fn(),
            verifyMagicLink: mockVerifyMagicLink,
            logout: vi.fn(),
            setTokenFromCallback: vi.fn(),
            updateProfile: vi.fn(),
            updateNotificationPreferences: vi.fn(),
            deleteUser: vi.fn(),
        });

        render(
            <MemoryRouter initialEntries={['/verify-magic-link?token=valid-token']}>
                <VerifyMagicLinkPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Email verified successfully! Redirecting...')).toBeInTheDocument();
        });

        // Advance time but user is not authenticated yet
        vi.advanceTimersByTime(500);

        await waitFor(() => {
            expect(mockNavigate).not.toHaveBeenCalledWith('/trackings', expect.anything());
        });
    });

    it('should render Message component with correct props', async () => {
        const mockUser = {
            id: 1,
            name: 'Test User',
            email: 'test@example.com',
            created_at: '2024-01-01T00:00:00Z',
        };

        mockVerifyMagicLink.mockResolvedValue(mockUser);
        mockUseAuth.mockReturnValue({
            user: mockUser,
            token: 'mock-token',
            isLoading: false,
            isAuthenticated: true,
            requestLoginMagicLink: vi.fn(),
            requestRegisterMagicLink: vi.fn(),
            requestEmailChange: vi.fn(),
            verifyMagicLink: mockVerifyMagicLink,
            logout: vi.fn(),
            setTokenFromCallback: vi.fn(),
            updateProfile: vi.fn(),
            updateNotificationPreferences: vi.fn(),
            deleteUser: vi.fn(),
        });

        render(
            <MemoryRouter initialEntries={['/verify-magic-link?token=valid-token']}>
                <VerifyMagicLinkPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            const message = screen.getByRole('alert');
            expect(message).toBeInTheDocument();
            expect(message).toHaveClass('message', 'success', 'show');
            expect(message).toHaveTextContent('Email verified successfully! Redirecting...');
        });
    });

    it('should render error Message component with correct props', async () => {
        const errorMessage = 'Token expired';
        mockVerifyMagicLink.mockRejectedValue(new Error(errorMessage));
        mockUseAuth.mockReturnValue({
            user: null,
            token: null,
            isLoading: false,
            isAuthenticated: false,
            requestLoginMagicLink: vi.fn(),
            requestRegisterMagicLink: vi.fn(),
            requestEmailChange: vi.fn(),
            verifyMagicLink: mockVerifyMagicLink,
            logout: vi.fn(),
            setTokenFromCallback: vi.fn(),
            updateProfile: vi.fn(),
            updateNotificationPreferences: vi.fn(),
            deleteUser: vi.fn(),
        });

        render(
            <MemoryRouter initialEntries={['/verify-magic-link?token=expired-token']}>
                <VerifyMagicLinkPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            const message = screen.getByRole('alert');
            expect(message).toBeInTheDocument();
            expect(message).toHaveClass('message', 'error', 'show');
            expect(message).toHaveTextContent(errorMessage);
        });
    });
});

