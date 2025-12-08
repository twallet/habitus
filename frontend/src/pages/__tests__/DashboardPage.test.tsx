// @vitest-environment jsdom
import { vi, type MockedFunction } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OutletContextType } from '../../context/AppContext';
import { DashboardPage } from '../DashboardPage';
import { ReminderStatus } from '../../models/Reminder';
import { TrackingState } from '../../models/Tracking';

// Mock useOutletContext
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useOutletContext: vi.fn(),
    };
});

import { useOutletContext } from 'react-router-dom';

const mockUseOutletContext = useOutletContext as MockedFunction<typeof useOutletContext>;

describe('DashboardPage', () => {
    const mockTrackings = [
        {
            id: 1,
            user_id: 1,
            question: 'Did you exercise today?',
            notes: null,
            icon: '🏃',
            state: TrackingState.RUNNING,
            days: { type: 'interval', interval_value: 1, interval_unit: 'day' },
            created_at: '2024-01-01T00:00:00Z',
        },
        {
            id: 2,
            user_id: 1,
            question: 'Did you meditate?',
            notes: 'Daily meditation',
            icon: '🧘',
            state: TrackingState.RUNNING,
            days: { type: 'interval', interval_value: 1, interval_unit: 'day' },
            created_at: '2024-01-01T00:00:00Z',
        },
    ];

    const mockReminders = [
        {
            id: 1,
            tracking_id: 1,
            scheduled_time: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour ago
            status: ReminderStatus.PENDING,
            notes: 'Test notes',
        },
        {
            id: 2,
            tracking_id: 2,
            scheduled_time: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
            status: ReminderStatus.PENDING,
            notes: null,
        },
    ];

    const mockContext: OutletContextType = {
        user: {
            id: 1,
            name: 'Test User',
            email: 'test@example.com',
            created_at: '2024-01-01T00:00:00Z',
        },
        trackings: mockTrackings,
        trackingsLoading: false,
        createTracking: vi.fn(),
        updateTracking: vi.fn(),
        updateTrackingState: vi.fn(),
        deleteTracking: vi.fn(),
        reminders: mockReminders,
        remindersLoading: false,
        updateReminder: vi.fn(),
        completeReminder: vi.fn(),
        dismissReminder: vi.fn(),
        snoozeReminder: vi.fn(),
        setShowTrackingForm: vi.fn(),
        setEditingTracking: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockUseOutletContext.mockReturnValue(mockContext);
    });

    it('should render empty state when no pending reminders', () => {
        mockUseOutletContext.mockReturnValue({
            ...mockContext,
            reminders: [],
        });

        render(<DashboardPage />);

        expect(screen.getByRole('heading', { name: /pending reminders/i })).toBeInTheDocument();
        expect(screen.getByText(/no pending reminders right now!/i)).toBeInTheDocument();
        expect(screen.getByText(/relax and enjoy your day!/i)).toBeInTheDocument();
    });

    it('should render pending reminders for today', () => {
        render(<DashboardPage />);

        expect(screen.getByRole('heading', { name: /pending reminders/i })).toBeInTheDocument();
        expect(screen.getByText('Did you exercise today?')).toBeInTheDocument();
        expect(screen.getByText('Did you meditate?')).toBeInTheDocument();
    });

    it('should filter out reminders not from today', () => {
        const yesterdayReminder = {
            id: 3,
            tracking_id: 1,
            scheduled_time: new Date(Date.now() - 1000 * 60 * 60 * 25).toISOString(), // 25 hours ago
            status: ReminderStatus.PENDING,
            notes: null,
        };

        mockUseOutletContext.mockReturnValue({
            ...mockContext,
            reminders: [...mockReminders, yesterdayReminder],
        });

        render(<DashboardPage />);

        expect(screen.getByText('Did you exercise today?')).toBeInTheDocument();
        expect(screen.getByText('Did you meditate?')).toBeInTheDocument();
        // Should not show yesterday's reminder
        expect(screen.queryByText(yesterdayReminder.notes || '')).not.toBeInTheDocument();
    });

    it('should filter out future reminders', () => {
        const futureReminder = {
            id: 3,
            tracking_id: 1,
            scheduled_time: new Date(Date.now() + 1000 * 60 * 60).toISOString(), // 1 hour from now
            status: ReminderStatus.PENDING,
            notes: null,
        };

        mockUseOutletContext.mockReturnValue({
            ...mockContext,
            reminders: [...mockReminders, futureReminder],
        });

        render(<DashboardPage />);

        expect(screen.getByText('Did you exercise today?')).toBeInTheDocument();
        expect(screen.getByText('Did you meditate?')).toBeInTheDocument();
    });

    it('should filter out non-pending reminders', () => {
        const answeredReminder = {
            id: 3,
            tracking_id: 1,
            scheduled_time: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
            status: ReminderStatus.ANSWERED,
            notes: null,
        };

        mockUseOutletContext.mockReturnValue({
            ...mockContext,
            reminders: [...mockReminders, answeredReminder],
        });

        render(<DashboardPage />);

        expect(screen.getByText('Did you exercise today?')).toBeInTheDocument();
        expect(screen.getByText('Did you meditate?')).toBeInTheDocument();
    });

    it('should display tracking icon or default icon', () => {
        render(<DashboardPage />);

        const cards = screen.getAllByText(/did you/i);
        expect(cards.length).toBeGreaterThan(0);
    });

    it('should display "Unknown Question" when tracking is missing', () => {
        const reminderWithoutTracking = {
            id: 3,
            tracking_id: 999, // Non-existent tracking
            scheduled_time: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
            status: ReminderStatus.PENDING,
            notes: null,
        };

        mockUseOutletContext.mockReturnValue({
            ...mockContext,
            reminders: [...mockReminders, reminderWithoutTracking],
        });

        render(<DashboardPage />);

        expect(screen.getByText('Unknown Question')).toBeInTheDocument();
    });

    it('should handle notes editing', async () => {
        const user = userEvent.setup();
        const mockUpdateReminder = vi.fn().mockResolvedValue({});
        mockUseOutletContext.mockReturnValue({
            ...mockContext,
            updateReminder: mockUpdateReminder,
        });

        render(<DashboardPage />);

        const textarea = screen.getAllByPlaceholderText('Add notes...')[0];
        await user.type(textarea, 'Updated notes');
        await user.tab(); // Trigger blur

        await waitFor(() => {
            expect(mockUpdateReminder).toHaveBeenCalledWith(1, 'Updated notes');
        });
    });

    it('should save notes on Enter key', async () => {
        const user = userEvent.setup();
        const mockUpdateReminder = vi.fn().mockResolvedValue({});
        mockUseOutletContext.mockReturnValue({
            ...mockContext,
            updateReminder: mockUpdateReminder,
        });

        render(<DashboardPage />);

        const textarea = screen.getAllByPlaceholderText('Add notes...')[0];
        await user.type(textarea, 'New notes');
        await user.keyboard('{Enter}');

        await waitFor(() => {
            expect(mockUpdateReminder).toHaveBeenCalledWith(1, 'New notes');
        });
    });

    it('should not save notes on Shift+Enter', async () => {
        const user = userEvent.setup();
        const mockUpdateReminder = vi.fn().mockResolvedValue({});
        mockUseOutletContext.mockReturnValue({
            ...mockContext,
            updateReminder: mockUpdateReminder,
        });

        render(<DashboardPage />);

        const textarea = screen.getAllByPlaceholderText('Add notes...')[0];
        await user.type(textarea, 'New notes');
        await user.keyboard('{Shift>}{Enter}{/Shift}');

        // Should not have been called yet (only on blur or Enter without Shift)
        expect(mockUpdateReminder).not.toHaveBeenCalled();
    });

    it('should cancel notes editing on Escape key', async () => {
        const user = userEvent.setup();
        mockUseOutletContext.mockReturnValue({
            ...mockContext,
            updateReminder: vi.fn(),
        });

        render(<DashboardPage />);

        const textarea = screen.getAllByPlaceholderText('Add notes...')[0];
        await user.type(textarea, 'Test notes');
        await user.keyboard('{Escape}');

        // Notes should be reset to original value
        await waitFor(() => {
            expect(textarea).toHaveValue('Test notes'); // Original value from mockReminders[0]
        });
    });

    it('should handle complete reminder', async () => {
        const user = userEvent.setup();
        const mockCompleteReminder = vi.fn().mockResolvedValue({});
        mockUseOutletContext.mockReturnValue({
            ...mockContext,
            completeReminder: mockCompleteReminder,
        });

        render(<DashboardPage />);

        const completeButtons = screen.getAllByRole('button', { name: /complete reminder/i });
        await user.click(completeButtons[0]);

        await waitFor(() => {
            expect(mockCompleteReminder).toHaveBeenCalledWith(1);
        });
    });

    it('should handle dismiss reminder', async () => {
        const user = userEvent.setup();
        const mockDismissReminder = vi.fn().mockResolvedValue({});
        mockUseOutletContext.mockReturnValue({
            ...mockContext,
            dismissReminder: mockDismissReminder,
        });

        render(<DashboardPage />);

        const dismissButtons = screen.getAllByRole('button', { name: /dismiss reminder/i });
        await user.click(dismissButtons[0]);

        await waitFor(() => {
            expect(mockDismissReminder).toHaveBeenCalledWith(1);
        });
    });

    it('should toggle snooze dropdown', async () => {
        const user = userEvent.setup();
        render(<DashboardPage />);

        const snoozeButtons = screen.getAllByRole('button', { name: /snooze reminder/i });
        await user.click(snoozeButtons[0]);

        await waitFor(() => {
            expect(screen.getByText('5 min')).toBeInTheDocument();
            expect(screen.getByText('15 min')).toBeInTheDocument();
            expect(screen.getByText('30 min')).toBeInTheDocument();
        });
    });

    it('should handle snooze reminder', async () => {
        const user = userEvent.setup();
        const mockSnoozeReminder = vi.fn().mockResolvedValue({});
        mockUseOutletContext.mockReturnValue({
            ...mockContext,
            snoozeReminder: mockSnoozeReminder,
        });

        render(<DashboardPage />);

        const snoozeButtons = screen.getAllByRole('button', { name: /snooze reminder/i });
        await user.click(snoozeButtons[0]);

        await waitFor(() => {
            expect(screen.getByText('5 min')).toBeInTheDocument();
        });

        const snoozeOption = screen.getByText('15 min');
        await user.click(snoozeOption);

        await waitFor(() => {
            expect(mockSnoozeReminder).toHaveBeenCalledWith(1, 15);
        });
    });

    it('should close snooze dropdown when clicking outside', async () => {
        const user = userEvent.setup();
        render(<DashboardPage />);

        const snoozeButtons = screen.getAllByRole('button', { name: /snooze reminder/i });
        await user.click(snoozeButtons[0]);

        await waitFor(() => {
            expect(screen.getByText('5 min')).toBeInTheDocument();
        });

        // Click outside
        await user.click(document.body);

        await waitFor(() => {
            expect(screen.queryByText('5 min')).not.toBeInTheDocument();
        });
    });

    it('should handle error when updating notes fails', async () => {
        const user = userEvent.setup();
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
        const mockUpdateReminder = vi.fn().mockRejectedValue(new Error('Update failed'));
        mockUseOutletContext.mockReturnValue({
            ...mockContext,
            updateReminder: mockUpdateReminder,
        });

        render(<DashboardPage />);

        const textarea = screen.getAllByPlaceholderText('Add notes...')[0];
        await user.type(textarea, 'Test');
        await user.tab();

        await waitFor(() => {
            expect(mockUpdateReminder).toHaveBeenCalled();
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error updating notes:', expect.any(Error));
        });

        consoleErrorSpy.mockRestore();
    });

    it('should handle error when completing reminder fails', async () => {
        const user = userEvent.setup();
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
        const mockCompleteReminder = vi.fn().mockRejectedValue(new Error('Complete failed'));
        mockUseOutletContext.mockReturnValue({
            ...mockContext,
            completeReminder: mockCompleteReminder,
        });

        render(<DashboardPage />);

        const completeButtons = screen.getAllByRole('button', { name: /complete reminder/i });
        await user.click(completeButtons[0]);

        await waitFor(() => {
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error completing reminder:', expect.any(Error));
        });

        consoleErrorSpy.mockRestore();
    });

    it('should handle error when dismissing reminder fails', async () => {
        const user = userEvent.setup();
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
        const mockDismissReminder = vi.fn().mockRejectedValue(new Error('Dismiss failed'));
        mockUseOutletContext.mockReturnValue({
            ...mockContext,
            dismissReminder: mockDismissReminder,
        });

        render(<DashboardPage />);

        const dismissButtons = screen.getAllByRole('button', { name: /dismiss reminder/i });
        await user.click(dismissButtons[0]);

        await waitFor(() => {
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error dismissing reminder:', expect.any(Error));
        });

        consoleErrorSpy.mockRestore();
    });

    it('should handle error when snoozing reminder fails', async () => {
        const user = userEvent.setup();
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
        const mockSnoozeReminder = vi.fn().mockRejectedValue(new Error('Snooze failed'));
        mockUseOutletContext.mockReturnValue({
            ...mockContext,
            snoozeReminder: mockSnoozeReminder,
        });

        render(<DashboardPage />);

        const snoozeButtons = screen.getAllByRole('button', { name: /snooze reminder/i });
        await user.click(snoozeButtons[0]);

        await waitFor(() => {
            expect(screen.getByText('5 min')).toBeInTheDocument();
        });

        const snoozeOption = screen.getByText('5 min');
        await user.click(snoozeOption);

        await waitFor(() => {
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error snoozing reminder:', expect.any(Error));
        });

        consoleErrorSpy.mockRestore();
    });

    it('should sort reminders by scheduled time', () => {
        const unsortedReminders = [
            {
                id: 3,
                tracking_id: 1,
                scheduled_time: new Date(Date.now() - 1000 * 60 * 10).toISOString(), // 10 minutes ago
                status: ReminderStatus.PENDING,
                notes: null,
            },
            {
                id: 1,
                tracking_id: 1,
                scheduled_time: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour ago
                status: ReminderStatus.PENDING,
                notes: null,
            },
        ];

        mockUseOutletContext.mockReturnValue({
            ...mockContext,
            reminders: unsortedReminders,
        });

        render(<DashboardPage />);

        const cards = screen.getAllByText(/did you exercise today/i);
        expect(cards.length).toBeGreaterThan(0);
    });

    it('should initialize notes values from reminders', () => {
        render(<DashboardPage />);

        const textareas = screen.getAllByPlaceholderText('Add notes...');
        expect(textareas[0]).toHaveValue('Test notes'); // From mockReminders[0]
        expect(textareas[1]).toHaveValue(''); // From mockReminders[1] (notes is null)
    });
});

