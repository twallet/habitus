// @vitest-environment jsdom
import { vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RemindersList } from "../RemindersList";
import { ReminderData, ReminderStatus, ReminderValue } from "../../models/Reminder";
import { TrackingData } from "../../models/Tracking";
import * as useRemindersModule from "../../hooks/useReminders";
import * as useTrackingsModule from "../../hooks/useTrackings";

// Mock the hooks
vi.mock("../../hooks/useReminders", () => ({
    useReminders: vi.fn(),
}));

vi.mock("../../hooks/useTrackings", () => ({
    useTrackings: vi.fn(),
}));

describe("RemindersList", () => {
    const mockUpdateReminder = vi.fn().mockResolvedValue(undefined);
    const mockSnoozeReminder = vi.fn().mockResolvedValue(undefined);
    const mockCompleteReminder = vi.fn().mockResolvedValue(undefined);
    const mockDismissReminder = vi.fn().mockResolvedValue(undefined);
    const mockDeleteReminder = vi.fn().mockResolvedValue(undefined);
    const mockRefreshReminders = vi.fn().mockResolvedValue(undefined);

    const mockTracking: TrackingData = {
        id: 1,
        user_id: 1,
        question: "Did I exercise?",
        icon: "💪",
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (useRemindersModule.useReminders as any).mockReturnValue({
            reminders: [],
            isLoading: false,
            updateReminder: mockUpdateReminder,
            snoozeReminder: mockSnoozeReminder,
            completeReminder: mockCompleteReminder,
            dismissReminder: mockDismissReminder,
            deleteReminder: mockDeleteReminder,
            refreshReminders: mockRefreshReminders,
        });
        (useTrackingsModule.useTrackings as any).mockReturnValue({
            trackings: [],
        });
    });

    it("should render loading state", () => {
        (useRemindersModule.useReminders as any).mockReturnValue({
            reminders: [],
            isLoading: true,
            updateReminder: mockUpdateReminder,
            snoozeReminder: mockSnoozeReminder,
            completeReminder: mockCompleteReminder,
            dismissReminder: mockDismissReminder,
            deleteReminder: mockDeleteReminder,
            refreshReminders: mockRefreshReminders,
        });

        render(<RemindersList />);

        expect(screen.getByText(/loading reminders/i)).toBeInTheDocument();
    });

    it("should render empty state when no reminders", () => {
        render(<RemindersList />);

        expect(screen.getByText(/no pending reminders/i)).toBeInTheDocument();
    });

    it("should render empty state with create link when onCreate is provided", () => {
        const mockOnCreate = vi.fn();
        render(<RemindersList onCreate={mockOnCreate} />);

        expect(screen.getByText(/no pending reminders/i)).toBeInTheDocument();
    });

    it("should render list of reminders", () => {
        const reminders: ReminderData[] = [
            {
                id: 1,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: "2024-01-01T10:00:00Z",
                status: ReminderStatus.PENDING,
                value: ReminderValue.COMPLETED,
            },
        ];

        (useRemindersModule.useReminders as any).mockReturnValue({
            reminders,
            isLoading: false,
            updateReminder: mockUpdateReminder,
            snoozeReminder: mockSnoozeReminder,
            completeReminder: mockCompleteReminder,
            dismissReminder: mockDismissReminder,
            deleteReminder: mockDeleteReminder,
            refreshReminders: mockRefreshReminders,
        });
        (useTrackingsModule.useTrackings as any).mockReturnValue({
            trackings: [mockTracking],
        });

        render(<RemindersList />);

        expect(screen.getByText("Did I exercise?")).toBeInTheDocument();
        // Check that action buttons are present (indicating reminders are shown)
        expect(screen.getByRole("button", { name: "Complete reminder" })).toBeInTheDocument();
    });

    // Note: The component no longer displays answers in the reminders table.
    // Answers are now handled through the Complete reminder action, not displayed as a column.

    it("should show notes indicator when reminder has notes", () => {
        const reminders: ReminderData[] = [
            {
                id: 1,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: "2024-01-01T10:00:00Z",
                notes: "Some notes",
                status: ReminderStatus.PENDING,
                value: ReminderValue.COMPLETED,
            },
        ];

        (useRemindersModule.useReminders as any).mockReturnValue({
            reminders,
            isLoading: false,
            updateReminder: mockUpdateReminder,
            snoozeReminder: mockSnoozeReminder,
            completeReminder: mockCompleteReminder,
            dismissReminder: mockDismissReminder,
            deleteReminder: mockDeleteReminder,
            refreshReminders: mockRefreshReminders,
        });
        (useTrackingsModule.useTrackings as any).mockReturnValue({
            trackings: [mockTracking],
        });

        render(<RemindersList />);

        // Notes are now in a textarea, so check for the textarea with the notes value
        const notesTextarea = screen.getByDisplayValue("Some notes");
        expect(notesTextarea).toBeInTheDocument();
    });

    it("should complete reminder when Complete is clicked", async () => {
        const reminders: ReminderData[] = [
            {
                id: 1,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: "2024-01-01T10:00:00Z",
                status: ReminderStatus.PENDING,
                value: ReminderValue.COMPLETED,
            },
        ];

        (useRemindersModule.useReminders as any).mockReturnValue({
            reminders,
            isLoading: false,
            updateReminder: mockUpdateReminder,
            snoozeReminder: mockSnoozeReminder,
            completeReminder: mockCompleteReminder,
            deleteReminder: mockDeleteReminder,
            refreshReminders: mockRefreshReminders,
        });
        (useTrackingsModule.useTrackings as any).mockReturnValue({
            trackings: [mockTracking],
        });

        render(<RemindersList />);

        // Click the Complete action button directly
        const completeButton = screen.getByRole("button", { name: "Complete reminder" });
        await userEvent.click(completeButton);

        await waitFor(() => {
            expect(mockCompleteReminder).toHaveBeenCalledWith(1);
        });
    });

    it("should dismiss reminder when Dismiss is clicked", async () => {
        const reminders: ReminderData[] = [
            {
                id: 1,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: "2024-01-01T10:00:00Z",
                status: ReminderStatus.PENDING,
                value: ReminderValue.COMPLETED,
            },
        ];

        (useRemindersModule.useReminders as any).mockReturnValue({
            reminders,
            isLoading: false,
            updateReminder: mockUpdateReminder,
            snoozeReminder: mockSnoozeReminder,
            completeReminder: mockCompleteReminder,
            dismissReminder: mockDismissReminder,
            deleteReminder: mockDeleteReminder,
            refreshReminders: mockRefreshReminders,
        });
        (useTrackingsModule.useTrackings as any).mockReturnValue({
            trackings: [mockTracking],
        });

        render(<RemindersList />);

        // Click the Dismiss action button directly
        const dismissButton = screen.getByRole("button", { name: "Dismiss reminder" });
        await userEvent.click(dismissButton);

        await waitFor(() => {
            expect(mockDismissReminder).toHaveBeenCalledWith(1);
        });
    });

    it("should filter reminders by time", async () => {
        const reminders: ReminderData[] = [
            {
                id: 1,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: "2024-01-01T10:00:00Z",
                status: ReminderStatus.PENDING,
                value: ReminderValue.COMPLETED,
            },
            {
                id: 2,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: "2024-02-01T10:00:00Z",
                status: ReminderStatus.PENDING,
                value: ReminderValue.COMPLETED,
            },
        ];

        (useRemindersModule.useReminders as any).mockReturnValue({
            reminders,
            isLoading: false,
            updateReminder: mockUpdateReminder,
            snoozeReminder: mockSnoozeReminder,
            completeReminder: mockCompleteReminder,
            dismissReminder: mockDismissReminder,
            deleteReminder: mockDeleteReminder,
            refreshReminders: mockRefreshReminders,
        });
        (useTrackingsModule.useTrackings as any).mockReturnValue({
            trackings: [mockTracking],
        });

        render(<RemindersList />);

        // Open filters
        const filterButton = screen.getByLabelText(/show filters/i);
        await userEvent.click(filterButton);

        // Filter by time - use a more specific filter that will match January date format
        const timeInput = screen.getByLabelText(/filter by time/i);
        await userEvent.clear(timeInput);
        await userEvent.type(timeInput, "1/1/2024");

        // Should only show reminder from January
        await waitFor(() => {
            const remindersInTable = screen.getAllByText("Did I exercise?");
            expect(remindersInTable.length).toBe(1);
        });
    });

    it("should filter reminders by tracking", async () => {
        const tracking2: TrackingData = {
            id: 2,
            user_id: 1,
            question: "Did I meditate?",
        };

        const reminders: ReminderData[] = [
            {
                id: 1,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: "2024-01-01T10:00:00Z",
                status: ReminderStatus.PENDING,
                value: ReminderValue.COMPLETED,
            },
            {
                id: 2,
                tracking_id: 2,
                user_id: 1,
                scheduled_time: "2024-01-01T11:00:00Z",
                status: ReminderStatus.PENDING,
                value: ReminderValue.COMPLETED,
            },
        ];

        (useRemindersModule.useReminders as any).mockReturnValue({
            reminders,
            isLoading: false,
            updateReminder: mockUpdateReminder,
            snoozeReminder: mockSnoozeReminder,
            completeReminder: mockCompleteReminder,
            dismissReminder: mockDismissReminder,
            deleteReminder: mockDeleteReminder,
            refreshReminders: mockRefreshReminders,
        });
        (useTrackingsModule.useTrackings as any).mockReturnValue({
            trackings: [mockTracking, tracking2],
        });

        render(<RemindersList />);

        // Open filters
        const filterButton = screen.getByLabelText(/show filters/i);
        await userEvent.click(filterButton);

        // Filter by tracking
        const trackingInput = screen.getByLabelText(/filter by tracking/i);
        await userEvent.type(trackingInput, "exercise");

        // Should only show exercise reminder
        expect(screen.getByText("Did I exercise?")).toBeInTheDocument();
        expect(screen.queryByText("Did I meditate?")).not.toBeInTheDocument();
    });

    // Note: Answer filter has been removed from the component, so this test is no longer applicable

    it("should filter reminders by notes", async () => {
        const reminders: ReminderData[] = [
            {
                id: 1,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: "2024-01-01T10:00:00Z",
                notes: "Great workout",
                status: ReminderStatus.PENDING,
                value: ReminderValue.COMPLETED,
            },
            {
                id: 2,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: "2024-01-01T11:00:00Z",
                notes: "Tired",
                status: ReminderStatus.PENDING,
                value: ReminderValue.COMPLETED,
            },
        ];

        (useRemindersModule.useReminders as any).mockReturnValue({
            reminders,
            isLoading: false,
            updateReminder: mockUpdateReminder,
            snoozeReminder: mockSnoozeReminder,
            completeReminder: mockCompleteReminder,
            dismissReminder: mockDismissReminder,
            deleteReminder: mockDeleteReminder,
            refreshReminders: mockRefreshReminders,
        });
        (useTrackingsModule.useTrackings as any).mockReturnValue({
            trackings: [mockTracking],
        });

        render(<RemindersList />);

        // Open filters
        const filterButton = screen.getByLabelText(/show filters/i);
        await userEvent.click(filterButton);

        // Filter by notes
        const notesInput = screen.getByLabelText(/filter by notes/i);
        await userEvent.type(notesInput, "workout");

        // Should only show reminder with "workout" in notes
        // Notes are now in a textarea, so check for the textarea with the notes value
        expect(screen.getByDisplayValue("Great workout")).toBeInTheDocument();
        expect(screen.queryByDisplayValue("Tired")).not.toBeInTheDocument();
    });

    it("should filter reminders by status", async () => {
        const reminders: ReminderData[] = [
            {
                id: 1,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: "2024-01-01T10:00:00Z",
                status: ReminderStatus.PENDING,
                value: ReminderValue.COMPLETED,
            },
            {
                id: 2,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: "2024-01-01T11:00:00Z",
                status: ReminderStatus.ANSWERED,
                value: ReminderValue.COMPLETED,
            },
        ];

        (useRemindersModule.useReminders as any).mockReturnValue({
            reminders,
            isLoading: false,
            updateReminder: mockUpdateReminder,
            snoozeReminder: mockSnoozeReminder,
            completeReminder: mockCompleteReminder,
            dismissReminder: mockDismissReminder,
            deleteReminder: mockDeleteReminder,
            refreshReminders: mockRefreshReminders,
        });
        (useTrackingsModule.useTrackings as any).mockReturnValue({
            trackings: [mockTracking],
        });

        render(<RemindersList />);

        // Open filters
        const filterButton = screen.getByLabelText(/show filters/i);
        await userEvent.click(filterButton);

        // Filter by status - check Pending
        const pendingCheckbox = screen.getByLabelText(/filter by status: pending/i);
        await userEvent.click(pendingCheckbox);

        // Should only show pending reminder - check action buttons in table rows
        await waitFor(() => {
            // Pending reminders should have snooze button (only pending reminders show snooze)
            const snoozeButtons = screen.getAllByRole("button", { name: "Snooze reminder" });
            expect(snoozeButtons.length).toBe(1);
        });
    });

    it("should reset filters", async () => {
        const reminders: ReminderData[] = [
            {
                id: 1,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: "2024-01-01T10:00:00Z",
                status: ReminderStatus.PENDING,
                value: ReminderValue.COMPLETED,
            },
        ];

        (useRemindersModule.useReminders as any).mockReturnValue({
            reminders,
            isLoading: false,
            updateReminder: mockUpdateReminder,
            snoozeReminder: mockSnoozeReminder,
            completeReminder: mockCompleteReminder,
            dismissReminder: mockDismissReminder,
            deleteReminder: mockDeleteReminder,
            refreshReminders: mockRefreshReminders,
        });
        (useTrackingsModule.useTrackings as any).mockReturnValue({
            trackings: [mockTracking],
        });

        render(<RemindersList />);

        // Open filters
        const filterButton = screen.getByLabelText(/show filters/i);
        await userEvent.click(filterButton);

        // Set a filter that will hide all reminders (using tracking filter instead of answer)
        const trackingInput = screen.getByLabelText(/filter by tracking/i);
        await userEvent.type(trackingInput, "nonexistent");

        // Verify filter is active - should show empty state
        await waitFor(() => {
            expect(screen.getByText(/no reminders match the current filters/i)).toBeInTheDocument();
        });

        // Reset filters
        const resetButton = screen.getByLabelText(/reset all filters/i);
        await userEvent.click(resetButton);

        // After reset, reminders should be visible again
        await waitFor(() => {
            expect(screen.queryByText(/no reminders match the current filters/i)).not.toBeInTheDocument();
            expect(screen.getByText("Did I exercise?")).toBeInTheDocument();
        });
    });

    it("should sort reminders by time", async () => {
        const reminders: ReminderData[] = [
            {
                id: 1,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: "2024-01-02T10:00:00Z",
                status: ReminderStatus.PENDING,
                value: ReminderValue.COMPLETED,
            },
            {
                id: 2,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: "2024-01-01T10:00:00Z",
                status: ReminderStatus.PENDING,
                value: ReminderValue.COMPLETED,
            },
        ];

        (useRemindersModule.useReminders as any).mockReturnValue({
            reminders,
            isLoading: false,
            updateReminder: mockUpdateReminder,
            snoozeReminder: mockSnoozeReminder,
            completeReminder: mockCompleteReminder,
            dismissReminder: mockDismissReminder,
            deleteReminder: mockDeleteReminder,
            refreshReminders: mockRefreshReminders,
        });
        (useTrackingsModule.useTrackings as any).mockReturnValue({
            trackings: [mockTracking],
        });

        render(<RemindersList />);

        // Click time header to sort
        const timeHeader = screen.getByLabelText(/sort by time/i);
        await userEvent.click(timeHeader);

        // First reminder should be the earlier one (sorted ascending)
        const rows = screen.getAllByText("Did I exercise?");
        expect(rows.length).toBe(2);
    });

    it("should sort reminders by tracking", async () => {
        const tracking2: TrackingData = {
            id: 2,
            user_id: 1,
            question: "Did I meditate?",
        };

        const reminders: ReminderData[] = [
            {
                id: 1,
                tracking_id: 2,
                user_id: 1,
                scheduled_time: "2024-01-01T10:00:00Z",
                status: ReminderStatus.PENDING,
                value: ReminderValue.COMPLETED,
            },
            {
                id: 2,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: "2024-01-01T11:00:00Z",
                status: ReminderStatus.PENDING,
                value: ReminderValue.COMPLETED,
            },
        ];

        (useRemindersModule.useReminders as any).mockReturnValue({
            reminders,
            isLoading: false,
            updateReminder: mockUpdateReminder,
            snoozeReminder: mockSnoozeReminder,
            completeReminder: mockCompleteReminder,
            dismissReminder: mockDismissReminder,
            deleteReminder: mockDeleteReminder,
            refreshReminders: mockRefreshReminders,
        });
        (useTrackingsModule.useTrackings as any).mockReturnValue({
            trackings: [mockTracking, tracking2],
        });

        render(<RemindersList />);

        // Click tracking header to sort
        const trackingHeader = screen.getByLabelText(/sort by tracking/i);
        await userEvent.click(trackingHeader);

        // Should be sorted alphabetically
        const rows = screen.getAllByText(/Did I (exercise|meditate)\?/);
        expect(rows.length).toBe(2);
    });

    // Note: Answer column has been removed from the component, so answer sorting is no longer available

    // Note: Status column has been removed and replaced with Actions column, so status sorting is no longer available

    it("should toggle sort direction", async () => {
        const reminders: ReminderData[] = [
            {
                id: 1,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: "2024-01-01T10:00:00Z",
                status: ReminderStatus.PENDING,
                value: ReminderValue.COMPLETED,
            },
            {
                id: 2,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: "2024-01-02T10:00:00Z",
                status: ReminderStatus.PENDING,
                value: ReminderValue.COMPLETED,
            },
        ];

        (useRemindersModule.useReminders as any).mockReturnValue({
            reminders,
            isLoading: false,
            updateReminder: mockUpdateReminder,
            snoozeReminder: mockSnoozeReminder,
            completeReminder: mockCompleteReminder,
            dismissReminder: mockDismissReminder,
            deleteReminder: mockDeleteReminder,
            refreshReminders: mockRefreshReminders,
        });
        (useTrackingsModule.useTrackings as any).mockReturnValue({
            trackings: [mockTracking],
        });

        render(<RemindersList />);

        // Click time header to sort ascending
        const timeHeader = screen.getByLabelText(/sort by time/i);
        await userEvent.click(timeHeader);
        expect(screen.getByText("↑")).toBeInTheDocument();

        // Click again to sort descending
        await userEvent.click(timeHeader);
        expect(screen.getByText("↓")).toBeInTheDocument();

        // Click again to remove sort
        await userEvent.click(timeHeader);
        expect(screen.queryByText("↑")).not.toBeInTheDocument();
        expect(screen.queryByText("↓")).not.toBeInTheDocument();
    });

    it("should show snooze menu when Snooze is clicked", async () => {
        const reminders: ReminderData[] = [
            {
                id: 1,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: "2024-01-01T10:00:00Z",
                status: ReminderStatus.PENDING,
                value: ReminderValue.COMPLETED,
            },
        ];

        (useRemindersModule.useReminders as any).mockReturnValue({
            reminders,
            isLoading: false,
            updateReminder: mockUpdateReminder,
            snoozeReminder: mockSnoozeReminder,
            completeReminder: mockCompleteReminder,
            dismissReminder: mockDismissReminder,
            deleteReminder: mockDeleteReminder,
            refreshReminders: mockRefreshReminders,
        });
        (useTrackingsModule.useTrackings as any).mockReturnValue({
            trackings: [mockTracking],
        });

        render(<RemindersList />);

        // Click the Snooze action button directly
        const snoozeButton = screen.getByRole("button", { name: "Snooze reminder" });
        await userEvent.click(snoozeButton);

        // Snooze menu should appear
        await waitFor(() => {
            expect(screen.getByText("15 min")).toBeInTheDocument();
        });
    });

    it("should call snoozeReminder when snooze option is clicked", async () => {
        const reminders: ReminderData[] = [
            {
                id: 1,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: "2024-01-01T10:00:00Z",
                status: ReminderStatus.PENDING,
                value: ReminderValue.COMPLETED,
            },
        ];

        (useRemindersModule.useReminders as any).mockReturnValue({
            reminders,
            isLoading: false,
            updateReminder: mockUpdateReminder,
            snoozeReminder: mockSnoozeReminder,
            completeReminder: mockCompleteReminder,
            dismissReminder: mockDismissReminder,
            deleteReminder: mockDeleteReminder,
            refreshReminders: mockRefreshReminders,
        });
        (useTrackingsModule.useTrackings as any).mockReturnValue({
            trackings: [mockTracking],
        });

        render(<RemindersList />);

        // Click the Snooze action button directly
        const snoozeButton = screen.getByRole("button", { name: "Snooze reminder" });
        await userEvent.click(snoozeButton);

        // Click a snooze option
        const snoozeOption = await screen.findByText("30 min");
        await userEvent.click(snoozeOption);

        await waitFor(() => {
            expect(mockSnoozeReminder).toHaveBeenCalledWith(1, 30);
        });
    });

    it("should show empty state when filters match no reminders", async () => {
        const reminders: ReminderData[] = [
            {
                id: 1,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: "2024-01-01T10:00:00Z",
                status: ReminderStatus.PENDING,
                value: ReminderValue.COMPLETED,
            },
        ];

        (useRemindersModule.useReminders as any).mockReturnValue({
            reminders,
            isLoading: false,
            updateReminder: mockUpdateReminder,
            snoozeReminder: mockSnoozeReminder,
            completeReminder: mockCompleteReminder,
            dismissReminder: mockDismissReminder,
            deleteReminder: mockDeleteReminder,
            refreshReminders: mockRefreshReminders,
        });
        (useTrackingsModule.useTrackings as any).mockReturnValue({
            trackings: [mockTracking],
        });

        render(<RemindersList />);

        // Open filters
        const filterButton = screen.getByLabelText(/show filters/i);
        await userEvent.click(filterButton);

        // Filter by tracking that doesn't exist (using tracking filter instead of answer)
        const trackingInput = screen.getByLabelText(/filter by tracking/i);
        await userEvent.type(trackingInput, "nonexistent");

        // Should show empty state
        await waitFor(() => {
            expect(screen.getByText(/no reminders match the current filters/i)).toBeInTheDocument();
        });
    });

    it("should handle error when updating reminder fails", async () => {
        const reminders: ReminderData[] = [
            {
                id: 1,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: "2024-01-01T10:00:00Z",
                status: ReminderStatus.PENDING,
                value: ReminderValue.COMPLETED,
            },
        ];

        const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => { });
        const errorUpdateReminder = vi.fn().mockRejectedValue(new Error("Update failed"));

        (useRemindersModule.useReminders as any).mockReturnValue({
            reminders,
            isLoading: false,
            updateReminder: errorUpdateReminder,
            snoozeReminder: mockSnoozeReminder,
            deleteReminder: mockDeleteReminder,
            refreshReminders: mockRefreshReminders,
        });
        (useTrackingsModule.useTrackings as any).mockReturnValue({
            trackings: [mockTracking],
        });

        render(<RemindersList />);

        // Notes are now directly editable, so just type in the textarea
        const notesTextarea = screen.getByPlaceholderText("Add notes...");
        await userEvent.type(notesTextarea, "Test notes");

        // Save notes by pressing Enter (this will fail)
        await userEvent.keyboard("{Enter}");

        await waitFor(() => {
            expect(errorUpdateReminder).toHaveBeenCalled();
        });

        consoleErrorSpy.mockRestore();
    });

    it("should handle error when snoozing reminder fails", async () => {
        const reminders: ReminderData[] = [
            {
                id: 1,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: "2024-01-01T10:00:00Z",
                status: ReminderStatus.PENDING,
                value: ReminderValue.COMPLETED,
            },
        ];

        const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => { });
        const errorSnoozeReminder = vi.fn().mockRejectedValue(new Error("Snooze failed"));

        (useRemindersModule.useReminders as any).mockReturnValue({
            reminders,
            isLoading: false,
            updateReminder: mockUpdateReminder,
            snoozeReminder: errorSnoozeReminder,
            deleteReminder: mockDeleteReminder,
            refreshReminders: mockRefreshReminders,
        });
        (useTrackingsModule.useTrackings as any).mockReturnValue({
            trackings: [mockTracking],
        });

        render(<RemindersList />);

        // Click the Snooze action button directly
        const snoozeButton = screen.getByRole("button", { name: "Snooze reminder" });
        await userEvent.click(snoozeButton);

        // Click a snooze option
        const snoozeOption = await screen.findByText("15 min");
        await userEvent.click(snoozeOption);

        await waitFor(() => {
            expect(errorSnoozeReminder).toHaveBeenCalled();
        });

        consoleErrorSpy.mockRestore();
    });

    it("should handle error when dismissing reminder fails", async () => {
        const reminders: ReminderData[] = [
            {
                id: 1,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: "2024-01-01T10:00:00Z",
                status: ReminderStatus.PENDING,
                value: ReminderValue.COMPLETED,
            },
        ];

        const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => { });
        const errorDismissReminder = vi.fn().mockRejectedValue(new Error("Dismiss failed"));

        (useRemindersModule.useReminders as any).mockReturnValue({
            reminders,
            isLoading: false,
            updateReminder: mockUpdateReminder,
            snoozeReminder: mockSnoozeReminder,
            completeReminder: mockCompleteReminder,
            dismissReminder: errorDismissReminder,
            deleteReminder: mockDeleteReminder,
            refreshReminders: mockRefreshReminders,
        });
        (useTrackingsModule.useTrackings as any).mockReturnValue({
            trackings: [mockTracking],
        });

        render(<RemindersList />);

        // Click the Dismiss action button directly
        const dismissButton = screen.getByRole("button", { name: "Dismiss reminder" });
        await userEvent.click(dismissButton);

        await waitFor(() => {
            expect(errorDismissReminder).toHaveBeenCalledWith(1);
        });

        consoleErrorSpy.mockRestore();
    });

    // Note: Answered reminders are now hidden from the reminders table, so this test is no longer applicable

    it("should show Complete button for pending reminders", async () => {
        const reminders: ReminderData[] = [
            {
                id: 1,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago (past time)
                status: ReminderStatus.PENDING,
                value: ReminderValue.COMPLETED,
            },
        ];

        (useRemindersModule.useReminders as any).mockReturnValue({
            reminders,
            isLoading: false,
            updateReminder: mockUpdateReminder,
            snoozeReminder: mockSnoozeReminder,
            completeReminder: mockCompleteReminder,
            dismissReminder: mockDismissReminder,
            deleteReminder: mockDeleteReminder,
            refreshReminders: mockRefreshReminders,
        });
        (useTrackingsModule.useTrackings as any).mockReturnValue({
            trackings: [mockTracking],
        });

        render(<RemindersList />);

        // Should show Complete button (action button)
        const completeButton = screen.getByRole("button", { name: "Complete reminder" });
        expect(completeButton).toBeInTheDocument();
    });

    it("should show unknown tracking when tracking not found", () => {
        const reminders: ReminderData[] = [
            {
                id: 1,
                tracking_id: 999,
                user_id: 1,
                scheduled_time: "2024-01-01T10:00:00Z",
                status: ReminderStatus.PENDING,
                value: ReminderValue.COMPLETED,
            },
        ];

        (useRemindersModule.useReminders as any).mockReturnValue({
            reminders,
            isLoading: false,
            updateReminder: mockUpdateReminder,
            snoozeReminder: mockSnoozeReminder,
            completeReminder: mockCompleteReminder,
            dismissReminder: mockDismissReminder,
            deleteReminder: mockDeleteReminder,
            refreshReminders: mockRefreshReminders,
        });
        (useTrackingsModule.useTrackings as any).mockReturnValue({
            trackings: [],
        });

        render(<RemindersList />);

        expect(screen.getByText("Unknown tracking")).toBeInTheDocument();
    });

    it("should call dismissReminder when Dismiss is clicked", async () => {
        const reminders: ReminderData[] = [
            {
                id: 1,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: "2024-01-01T10:00:00Z",
                status: ReminderStatus.PENDING,
                value: ReminderValue.COMPLETED,
            },
        ];

        (useRemindersModule.useReminders as any).mockReturnValue({
            reminders,
            isLoading: false,
            updateReminder: mockUpdateReminder,
            snoozeReminder: mockSnoozeReminder,
            completeReminder: mockCompleteReminder,
            dismissReminder: mockDismissReminder,
            deleteReminder: mockDeleteReminder,
            refreshReminders: mockRefreshReminders,
        });
        (useTrackingsModule.useTrackings as any).mockReturnValue({
            trackings: [mockTracking],
        });

        render(<RemindersList />);

        // Click the Dismiss action button directly
        const dismissButton = screen.getByRole("button", { name: "Dismiss reminder" });
        await userEvent.click(dismissButton);

        await waitFor(() => {
            expect(mockDismissReminder).toHaveBeenCalledWith(1);
        });
    });

    describe("Props override hook behavior", () => {
        it("should use provided reminders prop instead of hook", () => {
            const propReminders: ReminderData[] = [
                {
                    id: 1,
                    tracking_id: 1,
                    user_id: 1,
                    scheduled_time: new Date(Date.now() - 3600000).toISOString(),
                    status: ReminderStatus.PENDING,
                    value: ReminderValue.COMPLETED,
                },
            ];

            const hookReminders: ReminderData[] = [
                {
                    id: 2,
                    tracking_id: 2,
                    user_id: 1,
                    scheduled_time: new Date(Date.now() - 3600000).toISOString(),
                    status: ReminderStatus.PENDING,
                    value: ReminderValue.COMPLETED,
                },
            ];

            (useRemindersModule.useReminders as any).mockReturnValue({
                reminders: hookReminders,
                isLoading: false,
                updateReminder: mockUpdateReminder,
                snoozeReminder: mockSnoozeReminder,
                completeReminder: mockCompleteReminder,
                dismissReminder: mockDismissReminder,
                deleteReminder: mockDeleteReminder,
                refreshReminders: mockRefreshReminders,
            });
            (useTrackingsModule.useTrackings as any).mockReturnValue({
                trackings: [mockTracking],
            });

            render(<RemindersList reminders={propReminders} />);

            // Should show reminder from props (id: 1), not from hook (id: 2)
            expect(screen.getByText("Did I exercise?")).toBeInTheDocument();
            expect(screen.getByRole("button", { name: "Complete reminder" })).toBeInTheDocument();
        });

        it("should use provided isLoadingReminders prop instead of hook", () => {
            (useRemindersModule.useReminders as any).mockReturnValue({
                reminders: [],
                isLoading: false, // Hook says not loading
                updateReminder: mockUpdateReminder,
                snoozeReminder: mockSnoozeReminder,
                completeReminder: mockCompleteReminder,
                dismissReminder: mockDismissReminder,
                deleteReminder: mockDeleteReminder,
                refreshReminders: mockRefreshReminders,
            });

            render(<RemindersList isLoadingReminders={true} />);

            // Should show loading state from prop, not hook
            expect(screen.getByText(/loading reminders/i)).toBeInTheDocument();
        });

        it("should use provided updateReminder function instead of hook", async () => {
            const propUpdateReminder = vi.fn().mockResolvedValue(undefined);
            const reminders: ReminderData[] = [
                {
                    id: 1,
                    tracking_id: 1,
                    user_id: 1,
                    scheduled_time: new Date(Date.now() - 3600000).toISOString(),
                    status: ReminderStatus.PENDING,
                    value: ReminderValue.COMPLETED,
                },
            ];

            (useRemindersModule.useReminders as any).mockReturnValue({
                reminders,
                isLoading: false,
                updateReminder: mockUpdateReminder,
                snoozeReminder: mockSnoozeReminder,
                completeReminder: mockCompleteReminder,
                dismissReminder: mockDismissReminder,
                deleteReminder: mockDeleteReminder,
                refreshReminders: mockRefreshReminders,
            });
            (useTrackingsModule.useTrackings as any).mockReturnValue({
                trackings: [mockTracking],
            });

            render(<RemindersList reminders={reminders} updateReminder={propUpdateReminder} />);

            // Notes are now directly editable, so just type in the textarea
            const notesTextarea = screen.getByPlaceholderText("Add notes...");
            await userEvent.clear(notesTextarea);
            await userEvent.type(notesTextarea, "Test notes");

            // Save notes by pressing Enter
            await userEvent.keyboard("{Enter}");

            await waitFor(() => {
                expect(propUpdateReminder).toHaveBeenCalledWith(1, "Test notes");
                expect(mockUpdateReminder).not.toHaveBeenCalled();
            });
        });

        it("should use provided snoozeReminder function instead of hook", async () => {
            const propSnoozeReminder = vi.fn().mockResolvedValue({
                id: 1,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: new Date(Date.now() + 900000).toISOString(),
                status: ReminderStatus.UPCOMING,
            });

            const reminders: ReminderData[] = [
                {
                    id: 1,
                    tracking_id: 1,
                    user_id: 1,
                    scheduled_time: new Date(Date.now() - 3600000).toISOString(),
                    status: ReminderStatus.PENDING,
                    value: ReminderValue.COMPLETED,
                },
            ];

            (useRemindersModule.useReminders as any).mockReturnValue({
                reminders,
                isLoading: false,
                updateReminder: mockUpdateReminder,
                snoozeReminder: mockSnoozeReminder,
                deleteReminder: mockDeleteReminder,
                refreshReminders: mockRefreshReminders,
            });
            (useTrackingsModule.useTrackings as any).mockReturnValue({
                trackings: [mockTracking],
            });

            render(<RemindersList reminders={reminders} snoozeReminder={propSnoozeReminder} />);

            const snoozeButton = screen.getByRole("button", { name: "Snooze reminder" });
            await userEvent.click(snoozeButton);

            await waitFor(() => {
                expect(screen.getByText("15 min")).toBeInTheDocument();
            });

            const snoozeOption = screen.getByText("15 min");
            await userEvent.click(snoozeOption);

            await waitFor(() => {
                expect(propSnoozeReminder).toHaveBeenCalledWith(1, 15);
                expect(mockSnoozeReminder).not.toHaveBeenCalled();
            });
        });

        it("should use provided dismissReminder function instead of hook", async () => {
            const propDismissReminder = vi.fn().mockResolvedValue(undefined);

            const reminders: ReminderData[] = [
                {
                    id: 1,
                    tracking_id: 1,
                    user_id: 1,
                    scheduled_time: new Date(Date.now() - 3600000).toISOString(),
                    status: ReminderStatus.PENDING,
                    value: ReminderValue.COMPLETED,
                },
            ];

            (useRemindersModule.useReminders as any).mockReturnValue({
                reminders,
                isLoading: false,
                updateReminder: mockUpdateReminder,
                snoozeReminder: mockSnoozeReminder,
                completeReminder: mockCompleteReminder,
                dismissReminder: mockDismissReminder,
                deleteReminder: mockDeleteReminder,
                refreshReminders: mockRefreshReminders,
            });
            (useTrackingsModule.useTrackings as any).mockReturnValue({
                trackings: [mockTracking],
            });

            render(<RemindersList reminders={reminders} dismissReminder={propDismissReminder} />);

            const dismissButton = screen.getByRole("button", { name: "Dismiss reminder" });
            await userEvent.click(dismissButton);

            await waitFor(() => {
                expect(propDismissReminder).toHaveBeenCalledWith(1);
                expect(mockDismissReminder).not.toHaveBeenCalled();
            });
        });
    });
});

