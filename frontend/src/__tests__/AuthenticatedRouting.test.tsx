// @vitest-environment jsdom
import { vi, type MockedFunction } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../AppRoutes';
import { useAuth } from '../hooks/useAuth';
import { useTrackings } from '../hooks/useTrackings';
import { useReminders } from '../hooks/useReminders';

// Mock hooks
vi.mock('../hooks/useAuth', () => ({
    useAuth: vi.fn(),
}));

vi.mock('../hooks/useTrackings', () => ({
    useTrackings: vi.fn(),
}));

vi.mock('../hooks/useReminders', () => ({
    useReminders: vi.fn(),
}));

const mockUseAuth = useAuth as MockedFunction<typeof useAuth>;
const mockUseTrackings = useTrackings as MockedFunction<typeof useTrackings>;
const mockUseReminders = useReminders as MockedFunction<typeof useReminders>;

describe('Authenticated Routing', () => {
    const mockUser = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        created_at: '2024-01-01T00:00:00Z',
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Default mock for useTrackings
        mockUseTrackings.mockReturnValue({
            trackings: [],
            isLoading: false,
            createTracking: vi.fn(),
            updateTracking: vi.fn(),
            updateTrackingState: vi.fn(),
            deleteTracking: vi.fn(),
            refreshTrackings: vi.fn(),
        });

        // Default mock for useReminders
        mockUseReminders.mockReturnValue({
            reminders: [],
            isLoading: false,
            updateReminder: vi.fn(),
            completeReminder: vi.fn(),
            dismissReminder: vi.fn(),
            snoozeReminder: vi.fn(),
            deleteReminder: vi.fn(),
            refreshReminders: vi.fn(),
            removeRemindersForTracking: vi.fn(),
        });
    });

    const renderWithAuth = (initialRoute = '/', isAuthenticated = true) => {
        mockUseAuth.mockReturnValue({
            user: isAuthenticated ? mockUser : null,
            token: isAuthenticated ? 'mock-token' : null,
            isLoading: false,
            isAuthenticated,
            requestLoginMagicLink: vi.fn(),
            requestRegisterMagicLink: vi.fn(),
            requestEmailChange: vi.fn(),
            verifyMagicLink: vi.fn(),
            logout: vi.fn(),
            setTokenFromCallback: vi.fn(),
            updateProfile: vi.fn(),
            deleteUser: vi.fn(),
        });

        return render(
            <MemoryRouter initialEntries={[initialRoute]}>
                <AppRoutes />
            </MemoryRouter>
        );
    };

    describe('Protected Routes', () => {
        it('should allow access to root route when authenticated', async () => {
            renderWithAuth('/', true);

            await waitFor(() => {
                expect(screen.getByText(/no trackings/i)).toBeInTheDocument();
            });
        });

        it('should allow access to /reminders when authenticated', async () => {
            renderWithAuth('/reminders', true);

            await waitFor(() => {
                expect(screen.getByText(/no pending reminders/i)).toBeInTheDocument();
            });
        });

        it('should redirect to /login when accessing root unauthenticated', async () => {
            renderWithAuth('/', false);

            await waitFor(() => {
                expect(screen.getByPlaceholderText(/enter your email/i)).toBeInTheDocument();
            });
        });

        it('should redirect to /login when accessing /reminders unauthenticated', async () => {
            renderWithAuth('/reminders', false);

            await waitFor(() => {
                expect(screen.getByPlaceholderText(/enter your email/i)).toBeInTheDocument();
            });
        });

        it('should redirect to /login when accessing /profile unauthenticated', async () => {
            renderWithAuth('/profile', false);

            await waitFor(() => {
                expect(screen.getByPlaceholderText(/enter your email/i)).toBeInTheDocument();
            });
        });
    });

    describe('Public Routes', () => {
        it('should allow access to /login when unauthenticated', async () => {
            renderWithAuth('/login', false);

            await waitFor(() => {
                expect(screen.getByPlaceholderText(/enter your email/i)).toBeInTheDocument();
            });
        });

        it('should redirect to / when accessing /login while authenticated', async () => {
            renderWithAuth('/login', true);

            await waitFor(() => {
                expect(screen.getByText(/no trackings/i)).toBeInTheDocument();
            });
        });
    });

    describe('Navigation Between Routes', () => {
        it('should navigate from trackings to reminders when authenticated', async () => {
            const user = userEvent.setup();
            renderWithAuth('/', true);

            await waitFor(() => {
                expect(screen.getByText(/no trackings/i)).toBeInTheDocument();
            });

            const remindersLink = screen.getByRole('link', { name: /reminders/i });
            await user.click(remindersLink);

            await waitFor(() => {
                expect(screen.getByText(/no pending reminders/i)).toBeInTheDocument();
            });
        });

        it('should navigate from reminders to trackings when authenticated', async () => {
            const user = userEvent.setup();
            renderWithAuth('/reminders', true);

            await waitFor(() => {
                expect(screen.getByText(/no pending reminders/i)).toBeInTheDocument();
            });

            const trackingsLink = screen.getByRole('link', { name: /trackings/i });
            await user.click(trackingsLink);

            await waitFor(() => {
                expect(screen.getByText(/no trackings/i)).toBeInTheDocument();
            });
        });
    });

    describe('Catch-all Route', () => {
        it('should redirect unknown routes to / when authenticated', async () => {
            renderWithAuth('/unknown-route', true);

            await waitFor(() => {
                expect(screen.getByText(/no trackings/i)).toBeInTheDocument();
            });
        });

        it('should redirect unknown routes to /login when unauthenticated', async () => {
            renderWithAuth('/unknown-route', false);

            await waitFor(() => {
                expect(screen.getByPlaceholderText(/enter your email/i)).toBeInTheDocument();
            });
        });
    });
});
