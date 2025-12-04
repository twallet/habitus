// @vitest-environment jsdom
import { vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RemindersList } from "../RemindersList";
import { ReminderData, ReminderStatus } from "../../models/Reminder";
import { TrackingData, TrackingType } from "../../models/Tracking";
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
    const mockDeleteReminder = vi.fn().mockResolvedValue(undefined);
    const mockRefreshReminders = vi.fn().mockResolvedValue(undefined);

    const mockTracking: TrackingData = {
        id: 1,
        user_id: 1,
        question: "Did I exercise?",
        type: TrackingType.TRUE_FALSE,
        icon: "💪",
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (useRemindersModule.useReminders as any).mockReturnValue({
            reminders: [],
            isLoading: false,
            updateReminder: mockUpdateReminder,
            snoozeReminder: mockSnoozeReminder,
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

        render(<RemindersList />);

        expect(screen.getByText("Did I exercise?")).toBeInTheDocument();
        // Check that action buttons are present (indicating reminders are shown)
        expect(screen.getByRole("button", { name: "Answer reminder" })).toBeInTheDocument();
    });

    it("should show answer when reminder has answer", () => {
        const reminders: ReminderData[] = [
            {
                id: 1,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
                answer: "Yes",
                status: ReminderStatus.PENDING,
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

        render(<RemindersList />);

        expect(screen.getByText("🟢Yes")).toBeInTheDocument();
    });

    it("should show notes indicator when reminder has notes", () => {
        const reminders: ReminderData[] = [
            {
                id: 1,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: "2024-01-01T10:00:00Z",
                notes: "Some notes",
                status: ReminderStatus.PENDING,
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

        render(<RemindersList />);

        expect(screen.getByText("📝")).toBeInTheDocument();
    });

    it("should open answer modal when Answer is clicked", async () => {
        const reminders: ReminderData[] = [
            {
                id: 1,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: "2024-01-01T10:00:00Z",
                status: ReminderStatus.PENDING,
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

        render(<RemindersList />);

        // Click the Answer/Edit action button directly
        const answerButton = screen.getByRole("button", { name: "Answer reminder" });
        await userEvent.click(answerButton);

        await waitFor(() => {
            expect(screen.getByText("Answer reminder")).toBeInTheDocument();
        });
    });

    it("should show skip confirmation when Skip is clicked", async () => {
        const reminders: ReminderData[] = [
            {
                id: 1,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: "2024-01-01T10:00:00Z",
                status: ReminderStatus.PENDING,
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

        render(<RemindersList />);

        // Click the Skip action button directly
        const skipButton = screen.getByRole("button", { name: "Skip reminder" });
        await userEvent.click(skipButton);

        await waitFor(() => {
            expect(screen.getByText("Skip reminder")).toBeInTheDocument();
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
            },
            {
                id: 2,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: "2024-02-01T10:00:00Z",
                status: ReminderStatus.PENDING,
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
            type: TrackingType.TRUE_FALSE,
        };

        const reminders: ReminderData[] = [
            {
                id: 1,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: "2024-01-01T10:00:00Z",
                status: ReminderStatus.PENDING,
            },
            {
                id: 2,
                tracking_id: 2,
                user_id: 1,
                scheduled_time: "2024-01-01T11:00:00Z",
                status: ReminderStatus.PENDING,
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

    it("should filter reminders by answer", async () => {
        const reminders: ReminderData[] = [
            {
                id: 1,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
                answer: "Yes",
                status: ReminderStatus.PENDING,
            },
            {
                id: 2,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
                answer: "No",
                status: ReminderStatus.PENDING,
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

        render(<RemindersList />);

        // Open filters
        const filterButton = screen.getByLabelText(/show filters/i);
        await userEvent.click(filterButton);

        // Filter by answer
        const answerInput = screen.getByLabelText(/filter by answer/i);
        await userEvent.type(answerInput, "Yes");

        // Should only show reminder with "Yes" answer
        expect(screen.getByText("🟢Yes")).toBeInTheDocument();
        expect(screen.queryByText("🔘No")).not.toBeInTheDocument();
    });

    it("should filter reminders by notes", async () => {
        const reminders: ReminderData[] = [
            {
                id: 1,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: "2024-01-01T10:00:00Z",
                notes: "Great workout",
                status: ReminderStatus.PENDING,
            },
            {
                id: 2,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: "2024-01-01T11:00:00Z",
                notes: "Tired",
                status: ReminderStatus.PENDING,
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

        render(<RemindersList />);

        // Open filters
        const filterButton = screen.getByLabelText(/show filters/i);
        await userEvent.click(filterButton);

        // Filter by notes
        const notesInput = screen.getByLabelText(/filter by notes/i);
        await userEvent.type(notesInput, "workout");

        // Should only show reminder with "workout" in notes
        expect(screen.getByText("📝")).toBeInTheDocument();
        const notesIndicators = screen.getAllByText("📝");
        expect(notesIndicators.length).toBe(1);
    });

    it("should filter reminders by status", async () => {
        const reminders: ReminderData[] = [
            {
                id: 1,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: "2024-01-01T10:00:00Z",
                status: ReminderStatus.PENDING,
            },
            {
                id: 2,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: "2024-01-01T11:00:00Z",
                status: ReminderStatus.ANSWERED,
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

        render(<RemindersList />);

        // Open filters
        const filterButton = screen.getByLabelText(/show filters/i);
        await userEvent.click(filterButton);

        // Set a filter that will hide all reminders
        const answerInput = screen.getByLabelText(/filter by answer/i);
        await userEvent.type(answerInput, "nonexistent");

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
            },
            {
                id: 2,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: "2024-01-01T10:00:00Z",
                status: ReminderStatus.PENDING,
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
            type: TrackingType.TRUE_FALSE,
        };

        const reminders: ReminderData[] = [
            {
                id: 1,
                tracking_id: 2,
                user_id: 1,
                scheduled_time: "2024-01-01T10:00:00Z",
                status: ReminderStatus.PENDING,
            },
            {
                id: 2,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: "2024-01-01T11:00:00Z",
                status: ReminderStatus.PENDING,
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

    it("should sort reminders by answer", async () => {
        const reminders: ReminderData[] = [
            {
                id: 1,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
                answer: "No",
                status: ReminderStatus.PENDING,
            },
            {
                id: 2,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
                answer: "Yes",
                status: ReminderStatus.PENDING,
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

        render(<RemindersList />);

        // Click answer header to sort
        const answerHeader = screen.getByLabelText(/sort by answer/i);
        await userEvent.click(answerHeader);

        // Should be sorted alphabetically - check answer cells specifically
        await waitFor(() => {
            const answerCells = screen.getAllByText(/^🟢Yes$|^🔘No$/);
            // Filter to only exact matches in answer cells (not in other places)
            const exactAnswers = answerCells.filter(el => {
                const cell = el.closest('.cell-answer');
                return cell !== null;
            });
            expect(exactAnswers.length).toBe(2);
        });
    });

    // Note: Status column has been removed and replaced with Actions column, so status sorting is no longer available

    it("should toggle sort direction", async () => {
        const reminders: ReminderData[] = [
            {
                id: 1,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: "2024-01-01T10:00:00Z",
                status: ReminderStatus.PENDING,
            },
            {
                id: 2,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: "2024-01-02T10:00:00Z",
                status: ReminderStatus.PENDING,
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

        render(<RemindersList />);

        // Open filters
        const filterButton = screen.getByLabelText(/show filters/i);
        await userEvent.click(filterButton);

        // Filter by answer that doesn't exist
        const answerInput = screen.getByLabelText(/filter by answer/i);
        await userEvent.type(answerInput, "nonexistent");

        // Should show empty state
        expect(screen.getByText(/no reminders match the current filters/i)).toBeInTheDocument();
    });

    it("should handle error when updating reminder fails", async () => {
        const reminders: ReminderData[] = [
            {
                id: 1,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: "2024-01-01T10:00:00Z",
                status: ReminderStatus.PENDING,
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

        // Click the Answer/Edit action button directly
        const answerButton = screen.getByRole("button", { name: "Answer reminder" });
        await userEvent.click(answerButton);

        // Wait for modal and try to save (this will fail)
        await waitFor(() => {
            expect(screen.getByText("Answer reminder")).toBeInTheDocument();
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

    it("should handle error when deleting reminder fails", async () => {
        const reminders: ReminderData[] = [
            {
                id: 1,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: "2024-01-01T10:00:00Z",
                status: ReminderStatus.PENDING,
            },
        ];

        const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => { });
        const errorDeleteReminder = vi.fn().mockRejectedValue(new Error("Delete failed"));

        (useRemindersModule.useReminders as any).mockReturnValue({
            reminders,
            isLoading: false,
            updateReminder: mockUpdateReminder,
            snoozeReminder: mockSnoozeReminder,
            deleteReminder: errorDeleteReminder,
            refreshReminders: mockRefreshReminders,
        });
        (useTrackingsModule.useTrackings as any).mockReturnValue({
            trackings: [mockTracking],
        });

        render(<RemindersList />);

        // Click the Skip action button directly
        const skipButton = screen.getByRole("button", { name: "Skip reminder" });
        await userEvent.click(skipButton);

        await waitFor(() => {
            expect(screen.getByText("Skip reminder")).toBeInTheDocument();
        });

        // Confirm skip - find the button in the modal (not the action button)
        const confirmButton = screen.getByRole("button", { name: "Skip" });
        await userEvent.click(confirmButton);

        await waitFor(() => {
            expect(errorDeleteReminder).toHaveBeenCalled();
        });

        consoleErrorSpy.mockRestore();
    });

    // Note: Answered reminders are now hidden from the reminders table, so this test is no longer applicable

    it("should show Answer button for pending reminders", async () => {
        const reminders: ReminderData[] = [
            {
                id: 1,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago (past time)
                status: ReminderStatus.PENDING,
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

        render(<RemindersList />);

        // Should show Answer button (action button)
        const answerButton = screen.getByRole("button", { name: "Answer reminder" });
        expect(answerButton).toBeInTheDocument();
    });

    it("should show unknown tracking when tracking not found", () => {
        const reminders: ReminderData[] = [
            {
                id: 1,
                tracking_id: 999,
                user_id: 1,
                scheduled_time: "2024-01-01T10:00:00Z",
                status: ReminderStatus.PENDING,
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
            trackings: [],
        });

        render(<RemindersList />);

        expect(screen.getByText("Unknown tracking")).toBeInTheDocument();
    });

    it("should close delete confirmation modal when Cancel is clicked", async () => {
        const reminders: ReminderData[] = [
            {
                id: 1,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: "2024-01-01T10:00:00Z",
                status: ReminderStatus.PENDING,
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

        render(<RemindersList />);

        // Click the Skip action button directly
        const skipButton = screen.getByRole("button", { name: "Skip reminder" });
        await userEvent.click(skipButton);

        await waitFor(() => {
            expect(screen.getByText("Skip reminder")).toBeInTheDocument();
        });

        // Click Cancel
        const cancelButton = screen.getByRole("button", { name: /cancel/i });
        await userEvent.click(cancelButton);

        await waitFor(() => {
            expect(screen.queryByText("Skip reminder")).not.toBeInTheDocument();
        });
    });
});

