// @vitest-environment jsdom
import { vi, type MockedFunction } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { VerifyMagicLinkPage } from '../VerifyMagicLinkPage';
import { useAuth } from '../../hooks/useAuth';

// Mock useAuth hook
vi.mock('../../hooks/useAuth', () => ({
    useAuth: vi.fn(),
}));

const mockUseAuth = useAuth as MockedFunction<typeof useAuth>;

describe('VerifyMagicLinkPage', () => {
    const mockVerifyMagicLink = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    const getMockAuthReturn = (overrides?: {
        isAuthenticated?: boolean;
        user?: any;
        token?: string | null;
    }) => ({
        user: overrides?.user ?? null,
        token: overrides?.token ?? null,
        isLoading: false,
        isAuthenticated: overrides?.isAuthenticated ?? false,
        requestLoginMagicLink: vi.fn(),
        requestRegisterMagicLink: vi.fn(),
        requestEmailChange: vi.fn(),
        verifyMagicLink: mockVerifyMagicLink,
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

    it('should show loading message while verifying', async () => {
        mockVerifyMagicLink.mockImplementation(() => new Promise(() => { })); // Never resolves
        mockUseAuth.mockReturnValue(getMockAuthReturn());

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
        mockUseAuth.mockReturnValue(getMockAuthReturn());

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

    it('should verify magic link successfully and show success message', async () => {
        const mockUser = {
            id: 1,
            name: 'Test User',
            email: 'test@example.com',
            created_at: '2024-01-01T00:00:00Z',
        };

        mockVerifyMagicLink.mockResolvedValue(mockUser);
        mockUseAuth.mockReturnValue(getMockAuthReturn());

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
        mockUseAuth.mockReturnValue(getMockAuthReturn());

        render(
            <MemoryRouter initialEntries={[`/verify-magic-link?token=${encodedToken}`]}>
                <VerifyMagicLinkPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(mockVerifyMagicLink).toHaveBeenCalledWith('test-token-with-special-chars');
        });
    });

    it('should handle already decoded token', async () => {
        const mockUser = {
            id: 1,
            name: 'Test User',
            email: 'test@example.com',
            created_at: '2024-01-01T00:00:00Z',
        };

        const token = 'already-decoded-token';
        mockVerifyMagicLink.mockResolvedValue(mockUser);
        mockUseAuth.mockReturnValue(getMockAuthReturn());

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
        mockUseAuth.mockReturnValue(getMockAuthReturn());

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
        mockUseAuth.mockReturnValue(getMockAuthReturn());

        render(
            <MemoryRouter initialEntries={['/verify-magic-link?token=invalid-token']}>
                <VerifyMagicLinkPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Invalid or expired verification link')).toBeInTheDocument();
        });
    });

    it('should render Message component with success props', async () => {
        const mockUser = {
            id: 1,
            name: 'Test User',
            email: 'test@example.com',
            created_at: '2024-01-01T00:00:00Z',
        };

        mockVerifyMagicLink.mockResolvedValue(mockUser);
        mockUseAuth.mockReturnValue(getMockAuthReturn());

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
        mockUseAuth.mockReturnValue(getMockAuthReturn());

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

    it('should call verifyMagicLink with decoded token when URL contains encoded token', async () => {
        const mockUser = {
            id: 1,
            name: 'Test User',
            email: 'test@example.com',
            created_at: '2024-01-01T00:00:00Z',
        };

        // Token with characters that need encoding
        const originalToken = 'token+with/special=chars&more';
        const encodedToken = encodeURIComponent(originalToken);

        mockVerifyMagicLink.mockResolvedValue(mockUser);
        mockUseAuth.mockReturnValue(getMockAuthReturn());

        render(
            <MemoryRouter initialEntries={[`/verify-magic-link?token=${encodedToken}`]}>
                <VerifyMagicLinkPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(mockVerifyMagicLink).toHaveBeenCalledWith(originalToken);
        });
    });
});
