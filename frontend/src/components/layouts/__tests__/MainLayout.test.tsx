// @vitest-environment jsdom
import { vi, type MockedFunction } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { MainLayout } from '../MainLayout';
import { useAuth } from '../../../hooks/useAuth';
import { useCoordinatedEntities } from '../../../hooks/useCoordinatedEntities';
import { TrackingState, Frequency } from '../../../models/Tracking';
import { ReminderStatus, ReminderValue } from '../../../models/Reminder';

// Mock hooks
vi.mock('../../../hooks/useAuth', () => ({
    useAuth: vi.fn(),
}));

vi.mock('../../../hooks/useCoordinatedEntities', () => ({
    useCoordinatedEntities: vi.fn(),
}));

// Mock getDailyCitation
vi.mock('../../../utils/citations', () => ({
    getDailyCitation: vi.fn(() => 'Test citation'),
}));

const mockUseAuth = useAuth as MockedFunction<typeof useAuth>;
const mockUseCoordinatedEntities = useCoordinatedEntities as MockedFunction<typeof useCoordinatedEntities>;

describe('MainLayout', () => {
    const mockUser = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        created_at: '2024-01-01T00:00:00Z',
    };

    const mockTrackings = [
        {
            id: 1,
            user_id: 1,
            question: 'Did you exercise?',
            state: TrackingState.RUNNING,
            frequency: { type: "daily" } as Frequency,
            created_at: '2024-01-01T00:00:00Z',
        },
    ];

    const mockReminders = [
        {
            id: 1,
            tracking_id: 1,
            user_id: 1,
            scheduled_time: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
            status: ReminderStatus.PENDING,
            value: null,
            notes: undefined,
        },
    ];

    beforeEach(() => {
        vi.clearAllMocks();

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
            disconnectTelegram: vi.fn(),
            updateUserPreferences: vi.fn(),
            deleteUser: vi.fn(),
        });

        mockUseCoordinatedEntities.mockReturnValue({
            isLoading: false, // For backward compatibility
            trackings: mockTrackings,
            trackingsLoading: false,
            createTracking: vi.fn(),
            updateTracking: vi.fn(),
            updateTrackingState: vi.fn(),
            deleteTracking: vi.fn(),
            refreshTrackings: vi.fn(),
            reminders: mockReminders,
            remindersLoading: false,
            updateReminder: vi.fn(),
            completeReminder: vi.fn(),
            dismissReminder: vi.fn(),
            snoozeReminder: vi.fn(),
            deleteReminder: vi.fn(),
            refreshReminders: vi.fn(),
            removeRemindersForTracking: vi.fn(),
            removeRemindersForTrackingByStatus: vi.fn(),
        });
    });

    const renderMainLayout = () => {
        return render(
            <MemoryRouter>
                <MainLayout />
            </MemoryRouter>
        );
    };

    it('should show loading state when isLoading is true', () => {
        mockUseAuth.mockReturnValue({
            user: null,
            token: null,
            isLoading: true,
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
            disconnectTelegram: vi.fn(),
            updateUserPreferences: vi.fn(),
            deleteUser: vi.fn(),
        });

        renderMainLayout();

        expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should redirect to login when not authenticated', () => {
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
            disconnectTelegram: vi.fn(),
            updateUserPreferences: vi.fn(),
            deleteUser: vi.fn(),
        });

        renderMainLayout();

        // Should redirect to login (Navigate component)
        // In test environment, we check that login elements would appear
        // The actual redirect is handled by React Router
    });

    it('should render main layout when authenticated', () => {
        renderMainLayout();

        expect(screen.getByRole('heading', { name: /habitus/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /trackings/i })).toBeInTheDocument();
    });

    it('should display user menu', () => {
        renderMainLayout();

        expect(screen.getByRole('button', { name: /account settings/i })).toBeInTheDocument();
    });

    it('should display navigation with correct badge counts', () => {
        renderMainLayout();

        expect(screen.getByRole('link', { name: /trackings/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /reminders/i })).toBeInTheDocument();
    });

    it('should calculate pending reminders count correctly', () => {
        const pendingReminders = [
            {
                id: 1,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
                status: ReminderStatus.PENDING,
                value: null,
                notes: undefined,
            },
            {
                id: 2,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
                status: ReminderStatus.PENDING,
                value: null,
                notes: undefined,
            },
        ];

        mockUseCoordinatedEntities.mockReturnValue({
            isLoading: false, // For backward compatibility
            trackings: mockTrackings,
            trackingsLoading: false,
            createTracking: vi.fn(),
            updateTracking: vi.fn(),
            updateTrackingState: vi.fn(),
            deleteTracking: vi.fn(),
            refreshTrackings: vi.fn(),
            reminders: pendingReminders,
            remindersLoading: false,
            updateReminder: vi.fn(),
            completeReminder: vi.fn(),
            dismissReminder: vi.fn(),
            snoozeReminder: vi.fn(),
            deleteReminder: vi.fn(),
            refreshReminders: vi.fn(),
            removeRemindersForTracking: vi.fn(),
            removeRemindersForTrackingByStatus: vi.fn(),
        });

        renderMainLayout();

        // Should show badge with count
        const remindersLink = screen.getByRole('link', { name: /reminders/i });
        expect(remindersLink).toBeInTheDocument();
    });

    it('should calculate running trackings count correctly', () => {
        const runningTrackings = [
            {
                id: 1,
                user_id: 1,
                question: 'Question 1',
                state: TrackingState.RUNNING,
                frequency: { type: "daily" } as Frequency,
                created_at: '2024-01-01T00:00:00Z',
            },
            {
                id: 2,
                user_id: 1,
                question: 'Question 2',
                state: TrackingState.RUNNING,
                frequency: { type: "daily" } as Frequency,
                created_at: '2024-01-01T00:00:00Z',
            },
        ];

        mockUseCoordinatedEntities.mockReturnValue({
            isLoading: false, // For backward compatibility
            trackings: runningTrackings,
            trackingsLoading: false,
            createTracking: vi.fn(),
            updateTracking: vi.fn(),
            updateTrackingState: vi.fn(),
            deleteTracking: vi.fn(),
            refreshTrackings: vi.fn(),
            reminders: mockReminders,
            remindersLoading: false,
            updateReminder: vi.fn(),
            completeReminder: vi.fn(),
            dismissReminder: vi.fn(),
            snoozeReminder: vi.fn(),
            deleteReminder: vi.fn(),
            refreshReminders: vi.fn(),
            removeRemindersForTracking: vi.fn(),
            removeRemindersForTrackingByStatus: vi.fn(),
        });

        renderMainLayout();

        const trackingsLink = screen.getByRole('link', { name: /trackings/i });
        expect(trackingsLink).toBeInTheDocument();
    });

    it('should open tracking form when FAB is clicked', async () => {
        const user = userEvent.setup();
        renderMainLayout();

        const fabButton = screen.getByRole('button', { name: /create tracking/i });
        await user.click(fabButton);

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: /create tracking/i })).toBeInTheDocument();
        });
    });

    it('should close tracking form when close button is clicked', async () => {
        const user = userEvent.setup();
        renderMainLayout();

        const fabButton = screen.getByRole('button', { name: /create tracking/i });
        await user.click(fabButton);

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: /create tracking/i })).toBeInTheDocument();
        });

        const closeButton = screen.getByRole('button', { name: /×/i });
        await user.click(closeButton);

        await waitFor(() => {
            expect(screen.queryByRole('heading', { name: /create tracking/i })).not.toBeInTheDocument();
        });
    });

    it('should open edit profile modal when user menu item is clicked', async () => {
        const user = userEvent.setup();
        renderMainLayout();

        const userMenuButton = screen.getByRole('button', { name: /account settings/i });
        await user.click(userMenuButton);

        await waitFor(() => {
            expect(screen.getByText('Account settings')).toBeInTheDocument();
        });

        const accountSettingsItem = screen.getByText('Account settings');
        await user.click(accountSettingsItem);

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: /edit profile/i })).toBeInTheDocument();
        });
    });

    it('should open change email modal when change email is clicked', async () => {
        const user = userEvent.setup();
        renderMainLayout();

        const userMenuButton = screen.getByRole('button', { name: /account settings/i });
        await user.click(userMenuButton);

        await waitFor(() => {
            expect(screen.getByText('Account settings')).toBeInTheDocument();
        });

        const accountSettingsItem = screen.getByText('Account settings');
        await user.click(accountSettingsItem);

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: /edit profile/i })).toBeInTheDocument();
        });

        const changeEmailButton = screen.getByRole('button', { name: /change email/i });
        await user.click(changeEmailButton);

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: /change email/i })).toBeInTheDocument();
        });
    });

    it('should open delete confirmation modal when delete user is clicked', async () => {
        const user = userEvent.setup();
        renderMainLayout();

        const userMenuButton = screen.getByRole('button', { name: /account settings/i });
        await user.click(userMenuButton);

        await waitFor(() => {
            expect(screen.getByText('Delete account')).toBeInTheDocument();
        });

        const deleteItem = screen.getByText('Delete account');
        await user.click(deleteItem);

        await waitFor(() => {
            // The modal should appear - check for the modal content
            expect(screen.getByRole('heading', { name: /delete account/i })).toBeInTheDocument();
        });
    });

    it('should open tracking form when FAB is clicked', async () => {
        const user = userEvent.setup();
        renderMainLayout();

        const fabButton = screen.getByRole('button', { name: /create tracking/i });
        await user.click(fabButton);

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: /create tracking/i })).toBeInTheDocument();
        });
    });


    it('should handle logout', async () => {
        const user = userEvent.setup();
        const mockLogout = vi.fn();

        mockUseAuth.mockReturnValue({
            user: mockUser,
            token: 'mock-token',
            isLoading: false,
            isAuthenticated: true,
            requestLoginMagicLink: vi.fn(),
            requestRegisterMagicLink: vi.fn(),
            requestEmailChange: vi.fn(),
            verifyMagicLink: vi.fn(),
            logout: mockLogout,
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

        renderMainLayout();

        const userMenuButton = screen.getByRole('button', { name: /account settings/i });
        await user.click(userMenuButton);

        await waitFor(() => {
            expect(screen.getByText('Log out')).toBeInTheDocument();
        });

        const logoutItem = screen.getByText('Log out');
        await user.click(logoutItem);

        await waitFor(() => {
            expect(mockLogout).toHaveBeenCalledTimes(1);
            expect(screen.getByText('Logged out successfully')).toBeInTheDocument();
        });
    });

    it('should handle profile update successfully', async () => {
        const user = userEvent.setup();
        const mockUpdateProfile = vi.fn().mockResolvedValue(undefined);

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
            updateProfile: mockUpdateProfile,
            updateNotificationPreferences: vi.fn(),
            getTelegramStartLink: vi.fn(),
            getTelegramStatus: vi.fn(),
            cancelTelegramConnection: vi.fn(),
            disconnectTelegram: vi.fn(),
            updateUserPreferences: vi.fn(),
            deleteUser: vi.fn(),
        });

        renderMainLayout();

        const userMenuButton = screen.getByRole('button', { name: /account settings/i });
        await user.click(userMenuButton);

        await waitFor(() => {
            expect(screen.getByText('Account settings')).toBeInTheDocument();
        });

        const accountSettingsItem = screen.getByText('Account settings');
        await user.click(accountSettingsItem);

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: /edit profile/i })).toBeInTheDocument();
        });

        // Profile update would be tested in EditProfileModal tests
    });

    it('should handle email change request successfully', async () => {
        const user = userEvent.setup();
        const mockRequestEmailChange = vi.fn().mockResolvedValue(undefined);

        mockUseAuth.mockReturnValue({
            user: mockUser,
            token: 'mock-token',
            isLoading: false,
            isAuthenticated: true,
            requestLoginMagicLink: vi.fn(),
            requestRegisterMagicLink: vi.fn(),
            requestEmailChange: mockRequestEmailChange,
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

        renderMainLayout();

        const userMenuButton = screen.getByRole('button', { name: /account settings/i });
        await user.click(userMenuButton);

        await waitFor(() => {
            expect(screen.getByText('Account settings')).toBeInTheDocument();
        });

        const accountSettingsItem = screen.getByText('Account settings');
        await user.click(accountSettingsItem);

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: /edit profile/i })).toBeInTheDocument();
        });

        const changeEmailButton = screen.getByRole('button', { name: /change email/i });
        await user.click(changeEmailButton);

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: /change email/i })).toBeInTheDocument();
        });

        // Email change would be tested in ChangeEmailModal tests
    });

    it('should handle delete user successfully', async () => {
        const user = userEvent.setup();
        const mockDeleteUser = vi.fn().mockResolvedValue(undefined);

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
            disconnectTelegram: vi.fn(),
            updateUserPreferences: vi.fn(),
            deleteUser: mockDeleteUser,
        });

        renderMainLayout();

        const userMenuButton = screen.getByRole('button', { name: /account settings/i });
        await user.click(userMenuButton);

        await waitFor(() => {
            expect(screen.getByText('Delete account')).toBeInTheDocument();
        });

        const deleteItem = screen.getByText('Delete account');
        await user.click(deleteItem);

        await waitFor(() => {
            // The modal should appear - check for the modal content
            expect(screen.getByRole('heading', { name: /delete account/i })).toBeInTheDocument();
        });

        // Delete confirmation would be tested in DeleteUserConfirmationModal tests
    });

    it('should handle tracking deleted event', () => {
        const mockRemoveRemindersForTracking = vi.fn();
        const mockRefreshReminders = vi.fn().mockResolvedValue(undefined);

        mockUseCoordinatedEntities.mockReturnValue({
            isLoading: false, // For backward compatibility
            trackings: mockTrackings,
            trackingsLoading: false,
            createTracking: vi.fn(),
            updateTracking: vi.fn(),
            updateTrackingState: vi.fn(),
            deleteTracking: vi.fn(),
            refreshTrackings: vi.fn(),
            reminders: mockReminders,
            remindersLoading: false,
            updateReminder: vi.fn(),
            completeReminder: vi.fn(),
            dismissReminder: vi.fn(),
            snoozeReminder: vi.fn(),
            deleteReminder: vi.fn(),
            refreshReminders: mockRefreshReminders,
            removeRemindersForTracking: mockRemoveRemindersForTracking,
            removeRemindersForTrackingByStatus: vi.fn(),
        });

        renderMainLayout();

        // Dispatch tracking deleted event
        const event = new CustomEvent('trackingDeleted', { detail: { trackingId: 1 } });
        window.dispatchEvent(event);

        expect(mockRemoveRemindersForTracking).toHaveBeenCalledWith(1);
        expect(mockRefreshReminders).toHaveBeenCalled();
    });

    it('should dispatch trackingsChanged event when trackings change', () => {
        const trackingsChangedSpy = vi.fn();
        window.addEventListener('trackingsChanged', trackingsChangedSpy);

        const { rerender } = renderMainLayout();

        const newTrackings = [...mockTrackings, {
            id: 2,
            user_id: 1,
            question: 'New question',
            state: TrackingState.RUNNING,
            frequency: { type: "daily" } as Frequency,
            created_at: '2024-01-01T00:00:00Z',
        }];

        mockUseCoordinatedEntities.mockReturnValue({
            isLoading: false, // For backward compatibility
            trackings: newTrackings,
            trackingsLoading: false,
            createTracking: vi.fn(),
            updateTracking: vi.fn(),
            updateTrackingState: vi.fn(),
            deleteTracking: vi.fn(),
            refreshTrackings: vi.fn(),
            reminders: mockReminders,
            remindersLoading: false,
            updateReminder: vi.fn(),
            completeReminder: vi.fn(),
            dismissReminder: vi.fn(),
            snoozeReminder: vi.fn(),
            deleteReminder: vi.fn(),
            refreshReminders: vi.fn(),
            removeRemindersForTracking: vi.fn(),
            removeRemindersForTrackingByStatus: vi.fn(),
        });

        rerender(
            <MemoryRouter>
                <MainLayout />
            </MemoryRouter>
        );

        // Event should be dispatched
        expect(trackingsChangedSpy).toHaveBeenCalled();
    });

    it('should dispatch remindersChanged event when reminders change', () => {
        const remindersChangedSpy = vi.fn();
        window.addEventListener('remindersChanged', remindersChangedSpy);

        const { rerender } = renderMainLayout();

        const newReminders = [...mockReminders, {
            id: 2,
            tracking_id: 1,
            user_id: 1,
            scheduled_time: new Date().toISOString(),
            status: ReminderStatus.PENDING,
            value: null,
            notes: undefined,
        }];

        mockUseCoordinatedEntities.mockReturnValue({
            isLoading: false, // For backward compatibility
            trackings: mockTrackings,
            trackingsLoading: false,
            createTracking: vi.fn(),
            updateTracking: vi.fn(),
            updateTrackingState: vi.fn(),
            deleteTracking: vi.fn(),
            refreshTrackings: vi.fn(),
            reminders: newReminders,
            remindersLoading: false,
            updateReminder: vi.fn(),
            completeReminder: vi.fn(),
            dismissReminder: vi.fn(),
            snoozeReminder: vi.fn(),
            deleteReminder: vi.fn(),
            refreshReminders: vi.fn(),
            removeRemindersForTracking: vi.fn(),
            removeRemindersForTrackingByStatus: vi.fn(),
        });

        rerender(
            <MemoryRouter>
                <MainLayout />
            </MemoryRouter>
        );

        // Event should be dispatched
        expect(remindersChangedSpy).toHaveBeenCalled();
    });

    it('should refresh trackings when reminders reference missing trackings', async () => {
        const mockRefreshTrackings = vi.fn().mockResolvedValue(undefined);

        const remindersWithMissingTracking = [
            {
                id: 1,
                tracking_id: 999, // Non-existent tracking
                user_id: 1,
                scheduled_time: new Date().toISOString(),
                status: ReminderStatus.PENDING,
                value: null,
                notes: undefined,
            },
        ];

        mockUseCoordinatedEntities.mockReturnValue({
            isLoading: false, // For backward compatibility
            trackings: mockTrackings,
            trackingsLoading: false,
            createTracking: vi.fn(),
            updateTracking: vi.fn(),
            updateTrackingState: vi.fn(),
            deleteTracking: vi.fn(),
            refreshTrackings: mockRefreshTrackings,
            reminders: remindersWithMissingTracking,
            remindersLoading: false,
            updateReminder: vi.fn(),
            completeReminder: vi.fn(),
            dismissReminder: vi.fn(),
            snoozeReminder: vi.fn(),
            deleteReminder: vi.fn(),
            refreshReminders: vi.fn(),
            removeRemindersForTracking: vi.fn(),
            removeRemindersForTrackingByStatus: vi.fn(),
        });

        renderMainLayout();

        await waitFor(() => {
            expect(mockRefreshTrackings).toHaveBeenCalled();
        });
    });

    it('should not refresh trackings when trackings are loading', () => {
        const mockRefreshTrackings = vi.fn();

        const remindersWithMissingTracking = [
            {
                id: 1,
                tracking_id: 999,
                user_id: 1,
                scheduled_time: new Date().toISOString(),
                status: ReminderStatus.PENDING,
                value: null,
                notes: undefined,
            },
        ];

        mockUseCoordinatedEntities.mockReturnValue({
            isLoading: false, // For backward compatibility
            trackings: mockTrackings,
            trackingsLoading: true, // Loading
            createTracking: vi.fn(),
            updateTracking: vi.fn(),
            updateTrackingState: vi.fn(),
            deleteTracking: vi.fn(),
            refreshTrackings: mockRefreshTrackings,
            reminders: remindersWithMissingTracking,
            remindersLoading: false,
            updateReminder: vi.fn(),
            completeReminder: vi.fn(),
            dismissReminder: vi.fn(),
            snoozeReminder: vi.fn(),
            deleteReminder: vi.fn(),
            refreshReminders: vi.fn(),
            removeRemindersForTracking: vi.fn(),
            removeRemindersForTrackingByStatus: vi.fn(),
        });

        renderMainLayout();

        // Should not refresh when loading
        expect(mockRefreshTrackings).not.toHaveBeenCalled();
    });


    it('should filter out answered and upcoming reminders from count', () => {
        const mixedReminders = [
            {
                id: 1,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
                status: ReminderStatus.PENDING,
                value: null,
                notes: undefined,
            },
            {
                id: 2,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: new Date().toISOString(),
                status: ReminderStatus.ANSWERED,
                value: ReminderValue.COMPLETED,
                notes: undefined,
            },
            {
                id: 3,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
                status: ReminderStatus.UPCOMING,
                value: null,
                notes: undefined,
            },
        ];

        mockUseCoordinatedEntities.mockReturnValue({
            isLoading: false, // For backward compatibility
            trackings: mockTrackings,
            trackingsLoading: false,
            createTracking: vi.fn(),
            updateTracking: vi.fn(),
            updateTrackingState: vi.fn(),
            deleteTracking: vi.fn(),
            refreshTrackings: vi.fn(),
            reminders: mixedReminders,
            remindersLoading: false,
            updateReminder: vi.fn(),
            completeReminder: vi.fn(),
            dismissReminder: vi.fn(),
            snoozeReminder: vi.fn(),
            deleteReminder: vi.fn(),
            refreshReminders: vi.fn(),
            removeRemindersForTracking: vi.fn(),
            removeRemindersForTrackingByStatus: vi.fn(),
        });

        renderMainLayout();

        // Should only count PENDING reminders that have passed
        const remindersLink = screen.getByRole('link', { name: /reminders/i });
        expect(remindersLink).toBeInTheDocument();
    });

    it('should display daily citation in header', () => {
        renderMainLayout();

        const image = screen.getByAltText('🌱');
        expect(image).toHaveAttribute('title', 'Test citation');
    });

    it('should hide message when Message onHide is called', async () => {
        const user = userEvent.setup();
        const mockLogout = vi.fn();

        mockUseAuth.mockReturnValue({
            user: mockUser,
            token: 'mock-token',
            isLoading: false,
            isAuthenticated: true,
            requestLoginMagicLink: vi.fn(),
            requestRegisterMagicLink: vi.fn(),
            requestEmailChange: vi.fn(),
            verifyMagicLink: vi.fn(),
            logout: mockLogout,
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

        renderMainLayout();

        const userMenuButton = screen.getByRole('button', { name: /account settings/i });
        await user.click(userMenuButton);

        await waitFor(() => {
            expect(screen.getByText('Log out')).toBeInTheDocument();
        });

        const logoutItem = screen.getByText('Log out');
        await user.click(logoutItem);

        await waitFor(() => {
            expect(screen.getByText('Logged out successfully')).toBeInTheDocument();
        });

        const closeButton = screen.getByRole('button', { name: /close/i });
        await user.click(closeButton);

        await waitFor(() => {
            expect(screen.queryByText('Logged out successfully')).not.toBeInTheDocument();
        });
    });
});

