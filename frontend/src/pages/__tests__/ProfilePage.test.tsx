// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProfilePage } from '../ProfilePage';
import { useAuth } from '../../hooks/useAuth';

// Mock useAuth hook
vi.mock('../../hooks/useAuth', () => ({
    useAuth: vi.fn(),
}));

const mockUseAuth = useAuth as MockedFunction<typeof useAuth>;

describe('ProfilePage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render null when user is not authenticated', () => {
        mockUseAuth.mockReturnValue({
            user: null,
            token: null,
            isLoading: false,
            isAuthenticated: false,
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
            updateUserPreferences: vi.fn(),
            deleteUser: vi.fn(),
        });

        const { container } = render(<ProfilePage />);
        expect(container.firstChild).toBeNull();
    });

    it('should render user profile information when authenticated', () => {
        const mockUser = {
            id: 1,
            name: 'John Doe',
            email: 'john@example.com',
            created_at: '2024-01-01T00:00:00Z',
        };

        mockUseAuth.mockReturnValue({
            user: mockUser,
            token: 'mock-token',
            isLoading: false,
            isAuthenticated: true,
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
            updateUserPreferences: vi.fn(),
            deleteUser: vi.fn(),
        });

        render(<ProfilePage />);

        expect(screen.getByRole('heading', { name: /my profile/i })).toBeInTheDocument();
        expect(screen.getByText(/name:/i)).toBeInTheDocument();
        expect(screen.getByText(mockUser.name)).toBeInTheDocument();
        expect(screen.getByText(/email:/i)).toBeInTheDocument();
        expect(screen.getByText(mockUser.email)).toBeInTheDocument();
        expect(screen.getByText(/profile editing is currently handled via the user menu/i)).toBeInTheDocument();
    });

    it('should display user name and email correctly', () => {
        const mockUser = {
            id: 2,
            name: 'Jane Smith',
            email: 'jane.smith@example.com',
            created_at: '2024-02-01T00:00:00Z',
        };

        mockUseAuth.mockReturnValue({
            user: mockUser,
            token: 'mock-token',
            isLoading: false,
            isAuthenticated: true,
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
            updateUserPreferences: vi.fn(),
            deleteUser: vi.fn(),
        });

        render(<ProfilePage />);

        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.getByText('jane.smith@example.com')).toBeInTheDocument();
    });
});
